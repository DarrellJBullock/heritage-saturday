'use client';

// Client Component: the owner's per-roster visibility control. Promoting to LEAGUE lets league
// members read the roster; demoting to PRIVATE hides it again.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { RosterListItemDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function RosterVisibility({ rosters }: { rosters: RosterListItemDto[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(roster: RosterListItemDto) {
    const next = roster.visibility === 'LEAGUE' ? 'PRIVATE' : 'LEAGUE';
    setBusyId(roster.id);
    setError(null);
    try {
      await apiClient.patch(`/rosters/${roster.id}/visibility`, { visibility: next });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change visibility.');
    } finally {
      setBusyId(null);
    }
  }

  if (rosters.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rosters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rosters.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {r.name}
              <Badge variant={r.visibility === 'LEAGUE' ? 'default' : 'secondary'}>
                {r.visibility === 'LEAGUE' ? 'League' : 'Private'}
              </Badge>
            </span>
            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => toggle(r)}>
              {r.visibility === 'LEAGUE' ? 'Make Private' : 'Promote to League'}
            </Button>
          </div>
        ))}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Visibility error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
