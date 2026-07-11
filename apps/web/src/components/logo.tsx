// Heritage Saturday brand mark — original fiction, no real-team logos. A navy badge with a gold
// football and laces, drawn as inline SVG so it stays crisp from 24px in the nav up to a hero and
// needs no external asset. The badge keeps its own colors in light and dark; the wordmark uses
// theme text color.

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Heritage Saturday"
      className={className}
    >
      <defs>
        <linearGradient id="hs-badge" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c4372" />
          <stop offset="1" stopColor="#16233f" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="11" fill="url(#hs-badge)" />
      {/* Football: a gold ellipse tilted along the badge's diagonal, with navy laces. */}
      <g transform="rotate(-32 20 20)">
        <ellipse cx="20" cy="20" rx="13" ry="7.4" fill="#f2c24e" stroke="#16233f" strokeWidth="1.1" />
        <line x1="13.6" y1="20" x2="26.4" y2="20" stroke="#16233f" strokeWidth="1.5" strokeLinecap="round" />
        <g stroke="#16233f" strokeWidth="1.5" strokeLinecap="round">
          <line x1="15.8" y1="17.8" x2="15.8" y2="22.2" />
          <line x1="18.6" y1="17.5" x2="18.6" y2="22.5" />
          <line x1="21.4" y1="17.5" x2="21.4" y2="22.5" />
          <line x1="24.2" y1="17.8" x2="24.2" y2="22.2" />
        </g>
      </g>
    </svg>
  );
}

/** Full lockup: badge + wordmark. `tone="onBrand"` for use on a dark/navy background. */
export function Logo({
  size = 30,
  tone = 'default',
  className = '',
}: {
  size?: number;
  tone?: 'default' | 'onBrand';
  className?: string;
}) {
  const text = tone === 'onBrand' ? 'text-white' : 'text-foreground';
  const accent = tone === 'onBrand' ? 'text-[#f2c24e]' : 'text-brand-accent';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className={`text-sm font-bold uppercase leading-none tracking-wider ${text}`}>
        Heritage <span className={accent}>Saturday</span>
      </span>
    </span>
  );
}
