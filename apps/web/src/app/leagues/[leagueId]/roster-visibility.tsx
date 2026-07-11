'use client';

// Client Component: the owner's per-roster controls — visibility (League/Private), archive,
// restore, and permanent delete. Active and archived rosters are shown separately.

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

  async function act(rosterId: string, fn: () => Promise<unknown>) {
    setBusyId(rosterId);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (rosters.length === 0) return null;

  const active = rosters.filter((r) => !r.archived);
  const archived = rosters.filter((r) => r.archived);

  const row = (r: RosterListItemDto) => (
    <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 truncate">
        {r.name}
        <Badge variant={r.visibility === 'LEAGUE' ? 'default' : 'secondary'}>
          {r.visibility === 'LEAGUE' ? 'League' : 'Private'}
        </Badge>
      </span>
      <span className="flex items-center gap-1">
        {!r.archived && (
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === r.id}
            onClick={() =>
              act(r.id, () =>
                apiClient.patch(`/rosters/${r.id}/visibility`, {
                  visibility: r.visibility === 'LEAGUE' ? 'PRIVATE' : 'LEAGUE',
                }),
              )
            }
          >
            {r.visibility === 'LEAGUE' ? 'Make Private' : 'Promote'}
          </Button>
        )}
        {r.archived ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === r.id}
            onClick={() => act(r.id, () => apiClient.patch(`/rosters/${r.id}/restore`))}
          >
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === r.id}
            onClick={() => act(r.id, () => apiClient.patch(`/rosters/${r.id}/archive`))}
          >
            Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busyId === r.id}
          onClick={() => {
            if (!confirm(`Permanently delete "${r.name}"? This cannot be undone.`)) return;
            void act(r.id, () => apiClient.delete(`/rosters/${r.id}`));
          }}
        >
          Delete
        </Button>
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rosters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {active.map(row)}
        {archived.length > 0 && (
          <>
            <p className="text-muted-foreground text-xs font-medium uppercase mt-2">Archived</p>
            {archived.map(row)}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Roster action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
