/**
 * Body of `POST /auth/session`, sent by apps/web's Auth.js `jwt` callback on first sign-in.
 *
 * `subject` is the provider's stable subject claim (Google's `sub`) — deliberately not the
 * email, which providers allow users to change and reassign.
 */
export class ResolveSessionDto {
  provider!: string;
  subject!: string;
  email!: string;
}
