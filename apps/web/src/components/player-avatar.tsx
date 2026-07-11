// A player's headshot, or an initials placeholder when there's no photo. Plain <img> (not
// next/image) on purpose: headshot URLs point at arbitrary external hosts, which next/image
// would require every host be allow-listed in next.config.

export function PlayerAvatar({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const dimensions = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        style={dimensions}
        className="bg-muted shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{ ...dimensions, fontSize: Math.max(10, Math.round(size * 0.35)) }}
      className="bg-muted text-muted-foreground shrink-0 flex items-center justify-center rounded-full font-medium"
      aria-label={name}
    >
      {initials}
    </div>
  );
}
