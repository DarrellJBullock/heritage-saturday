import Link from 'next/link';

/**
 * Server Component — static navigation links only, no client state or
 * interactivity needed.
 */
export function SiteNav() {
  return (
    <header className="border-b bg-card">
      <nav className="mx-auto max-w-3xl px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/" className="font-semibold">
          Heritage Saturday
        </Link>
        <Link href="/imports" className="text-muted-foreground hover:text-foreground">
          Imports
        </Link>
        <Link href="/imports/new" className="text-muted-foreground hover:text-foreground">
          Import Roster
        </Link>
        <Link href="/games/new" className="text-muted-foreground hover:text-foreground">
          New Game
        </Link>
      </nav>
    </header>
  );
}
