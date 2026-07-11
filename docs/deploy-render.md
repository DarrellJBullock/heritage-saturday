# Deploying Heritage Saturday to Render

This deploys the playable app — the Next.js web front end, the NestJS API, and a managed
Postgres database — from the `render.yaml` blueprint at the repo root. The whole stack fits on
Render's free tier.

## What gets created

| Resource | Render type | Plan | Public? |
|---|---|---|---|
| `heritage-postgres` | Postgres | free | no (internal only) |
| `heritage-api` | Web Service (Docker) | free | yes, but gated by `API_SHARED_SECRET` |
| `heritage-web` | Web Service (Docker) | free | yes — the app people visit |

The browser only ever talks to `heritage-web`. It proxies API calls server-side through its own
`/api/proxy` route and reaches `heritage-api` over Render's internal network
(`http://heritage-api:3001`), attaching the shared secret. So even though the API has a public
URL, it's unusable without the secret, and the API address never reaches a client bundle.

The **worker** (`apps/worker`) and **Redis** are intentionally not deployed: nothing user-facing
uses them yet (games simulate synchronously and the API has no Redis dependency). Add them when
async multi-game runs get wired up — Render has a Background Worker type and a Key Value (Redis)
add-on, both paid.

## One-time setup

### 1. Create the Google OAuth client

Sign-in uses Google. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):

1. **Create Credentials → OAuth client ID → Web application.**
2. Leave the redirect URI for now — you need the deployed web URL first (step 3). You'll come back.
3. Copy the **Client ID** and **Client secret**.

### 2. Launch the blueprint

1. In Render: **New → Blueprint**, and connect this GitHub repo.
2. Render reads `render.yaml` and shows the three resources. Approve it.
3. First build takes a few minutes (both Docker images build from the monorepo root). Render
   generates `API_SHARED_SECRET` and `AUTH_SECRET` automatically and runs the database
   migrations on the API's first boot.

### 3. Finish the Google wiring

Once `heritage-web` has a URL, note its exact origin — Render may add a random suffix, so it's
something like `https://heritage-web-xxxx.onrender.com`, not necessarily `heritage-web.onrender.com`.
Use that exact origin everywhere below.

1. In the Google console, add the **authorized redirect URI**, exactly (no trailing slash,
   `https`, path exactly `/api/auth/callback/google`):
   `https://<your-heritage-web-origin>/api/auth/callback/google`
2. In Render, open **heritage-web → Environment** and set:
   - `AUTH_GOOGLE_ID` = your Client ID
   - `AUTH_GOOGLE_SECRET` = your Client secret
   - `AUTH_URL` = `https://<your-heritage-web-origin>` (just the origin — no path, no trailing slash)
3. Save — Render redeploys `heritage-web`. You can now sign in with Google.

> **Why `AUTH_URL` is required here (the `redirect_uri_mismatch` trap).** Render terminates HTTPS
> at its edge and forwards **HTTP** to your container. With only `AUTH_TRUST_HOST=true`, Auth.js
> can build the OAuth callback as `http://…`, which won't match the `https://…` URI you registered
> with Google — sign-in then fails with `Error 400: redirect_uri_mismatch`. Setting `AUTH_URL` to
> the canonical `https` origin pins the callback and fixes it. If Google still rejects the attempt,
> click **"see error details"** on its error page: it shows the exact `redirect_uri` it received,
> which must appear character-for-character in the Authorized redirect URIs list. Google edits can
> take a couple of minutes to propagate.

## Notes and caveats

- **Free-tier spin-down.** Free web services sleep after ~15 minutes idle. The first request
  after a nap cold-starts the service (~30–60s), including a web→API hop that may wake the API
  too. Upgrade both services to a paid instance type to keep them warm.
- **Free Postgres expires after 90 days** and is then deleted. For anything you want to keep,
  switch `heritage-postgres` to a paid plan (~$7/mo) before then.
- **Migrations** run at API start (`prisma migrate deploy`). That's safe on the single free
  instance. If you scale `heritage-api` to multiple replicas, move the migrate step to a Render
  **preDeploy command** (paid feature) so replicas don't race the migration table.
- **No dev-login on the deployed host.** The web image runs with `NODE_ENV=production`, and the
  app refuses to boot if `ALLOW_DEV_LOGIN` is set there — Google sign-in is the only way in.
- **Changing the internal wiring.** If internal DNS (`http://heritage-api:3001`) ever fails to
  resolve, set `heritage-web`'s `API_URL` to the API's public URL
  (`https://<your-heritage-api-url>`) instead — the shared secret still protects it.
