'use client';

// The primary nav links, with the current route highlighted (a gold underline). Client-only
// because active state needs the pathname; the surrounding nav stays a Server Component.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/leagues', label: 'Leagues' },
  { href: '/leagues/new', label: 'New League' },
  { href: '/invitations', label: 'Invitations' },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/leagues/new') return pathname === '/leagues/new';
  if (href === '/leagues') {
    return pathname === '/leagues' || (pathname.startsWith('/leagues/') && pathname !== '/leagues/new');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = isActive(l.href, pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`relative rounded-md px-2 py-1 transition-colors ${
              active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {l.label}
            {active && (
              <span className="bg-brand-accent absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
