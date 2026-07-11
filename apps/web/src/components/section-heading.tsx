// A section heading with a small gold accent bar — the brand motif used to break up the longer
// detail pages (box score, etc.) consistently.

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span className="bg-brand-accent h-4 w-1 rounded-full" aria-hidden />
      {children}
    </h2>
  );
}
