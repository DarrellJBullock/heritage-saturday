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
        <Link href="/leagues" className="font-semibold">
          Heritage Saturday
        </Link>
        {user?.id && (
          <>
            <Link href="/leagues" className="text-muted-foreground hover:text-foreground">
              Leagues
            </Link>
            <Link href="/leagues/new" className="text-muted-foreground hover:text-foreground">
              New League
            </Link>
            <Link href="/invitations" className="text-muted-foreground hover:text-foreground">
              Invitations
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
