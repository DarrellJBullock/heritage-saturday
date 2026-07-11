import Link from 'next/link';
import { auth } from '@/auth';
import { SignOutButton } from '@/components/sign-out-button';
import { Logo } from '@/components/logo';
import { NavLinks } from '@/components/nav-links';

/**
 * Server Component — the brand lockup and navigation, plus the current session's identity.
 *
 * Reading the session here is what makes the nav reflect who is signed in; it is not an access
 * check. Pages are gated by the request interceptor (src/proxy.ts), and the API by
 * app/api/proxy/[...path]. It's sticky with a translucent, blurred backdrop so it stays present
 * as pages scroll.
 */
export async function SiteNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="bg-card/80 supports-[backdrop-filter]:bg-card/70 sticky top-0 z-40 border-b backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
        <Link href="/leagues" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        {user?.id && (
          <>
            <NavLinks />
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
