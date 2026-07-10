// Sheets that create entities on commit. "headshots"/"bands"/"rivalries" are
// parsed/stored but never committed to entities in Cap 1 (architecture.md §5).
export const ENTITY_SHEETS = ['teams', 'players', 'coaches', 'depthchart'] as const;
