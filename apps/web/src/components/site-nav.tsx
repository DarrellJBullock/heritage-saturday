import Link from 'next/link';
import { auth } from '@/auth';
import { SignOutButton } from '@/components/sign-out-button';

/**
 * Server Component — static navigation links, plus the current session's identity.
 *
 * Reading the session here is what makes the nav reflect who is signed in; it is not an access
 * check. Pages are gated by the request interceptor (src/proxy.ts), and the API by
 * app/api/proxy/[...path].
 */
export async function SiteNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b bg-card">
      <nav className="mx-auto max-w-3xl px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/" className="font-semibold">
          Heritage Saturday
        </Link>
        {user?.id && (
          <>
            <Link href="/imports" className="text-muted-foreground hover:text-foreground">
              Imports
            </Link>
            <Link href="/imports/new" className="text-muted-foreground hover:text-foreground">
              Import Roster
            </Link>
            <Link href="/games/new" className="text-muted-foreground hover:text-foreground">
              New Game
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground hidden sm:inline">{user.email}</span>
              <SignOutButton />
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
