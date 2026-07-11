'use client';

// Client Component: edit a team's depth chart. Per position it shows a starter + up to three
// backup slots, each a dropdown of that position's players (a player already used at another slot
// of the same position is hidden, so you can't pick them twice). Saves the whole chart via
// PUT /depth-charts/:teamId, then refreshes. Only rendered for the owner.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { DepthChartEntryDto } from '@heritage-saturday/shared';
import { REQUIRED_STARTING_POSITIONS } from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SLOTS = 4; // starter + 3 backups (MAX_DEPTH_SLOTS_PER_POSITION)
const SLOT_LABELS = ['Starter', '2nd', '3rd', '4th'];

interface EditorPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  overallRating: number;
}

function label(p: EditorPlayer): string {
  return `#${p.jerseyNumber} ${p.firstName} ${p.lastName} (${p.overallRating})`;
}

export function DepthChartEditor({
  teamId,
  players,
  initialEntries,
}: {
  teamId: string;
  players: EditorPlayer[];
  initialEntries: DepthChartEntryDto[];
}) {
  const router = useRouter();

  // Positions to show: the required ones first (in canonical order), then any others the team has.
  const positions = useMemo(() => {
    const present = new Set(players.map((p) => p.position));
    const ordered = REQUIRED_STARTING_POSITIONS.filter((p) => present.has(p));
    const extras = [...present].filter((p) => !ordered.includes(p as never)).sort();
    return [...ordered, ...extras];
  }, [players]);

  const playersByPosition = useMemo(() => {
    const map = new Map<string, EditorPlayer[]>();
    for (const p of players) {
      const list = map.get(p.position) ?? [];
      list.push(p);
      map.set(p.position, list);
    }
    return map;
  }, [players]);

  // State: position -> playerId (or '') per slot.
  const [chart, setChart] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const pos of positions) initial[pos] = Array.from({ length: SLOTS }, () => '');
    for (const e of initialEntries) {
      if (initial[e.position] && e.slot < SLOTS) initial[e.position][e.slot] = e.playerId;
    }
    return initial;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setSlot(position: string, slot: number, playerId: string) {
    setSaved(false);
    setChart((prev) => {
      const next = { ...prev, [position]: [...(prev[position] ?? [])] };
      next[position][slot] = playerId;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const entries: DepthChartEntryDto[] = [];
    for (const position of positions) {
      (chart[position] ?? []).forEach((playerId, slot) => {
        if (playerId) entries.push({ position: position as never, slot, playerId });
      });
    }
    try {
      await apiClient.put(`/depth-charts/${teamId}`, { entries });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {positions.map((position) => {
          const candidates = playersByPosition.get(position) ?? [];
          const chosen = chart[position] ?? [];
          return (
            <Card key={position}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold tracking-wide">{position}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pb-3">
                {Array.from({ length: SLOTS }, (_, slot) => {
                  const usedElsewhere = new Set(chosen.filter((_, s) => s !== slot).filter(Boolean));
                  return (
                    <label key={slot} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-14 shrink-0 text-xs">
                        {SLOT_LABELS[slot]}
                      </span>
                      <select
                        value={chosen[slot] ?? ''}
                        onChange={(e) => setSlot(position, slot, e.target.value)}
                        className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                      >
                        <option value="">— none —</option>
                        {candidates
                          .filter((p) => !usedElsewhere.has(p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {label(p)}
                            </option>
                          ))}
                      </select>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save depth chart'}
        </Button>
        {saved && !error && <span className="text-muted-foreground text-sm">Saved.</span>}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save the depth chart</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
