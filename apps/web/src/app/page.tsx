import { redirect } from 'next/navigation';

/**
 * The app's home is the league dashboard — every roster, game, and import lives inside a league
 * (Capability 2). A signed-out visitor is redirected to /signin by the request interceptor
 * (src/proxy.ts) before reaching here.
 */
export default function Home() {
  redirect('/leagues');
}
