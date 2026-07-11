'use client';

// Client Component: the commissioner's rivalries panel. Lists live secondary rivals and emerging
// pairs; Approve promotes an emerging pair to a secondary rival, Dismiss hides it. Both POST
// through the proxy and refresh. Only rendered for roles with the `rivalries:manage` capability.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { RivalriesResponseDto, RivalryDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const pairLabel = (r: RivalryDto) => `${r.teamA.teamName} vs ${r.teamB.teamName}`;

export function RivalriesPanel({
  leagueId,
  rivalries,
}: {
  leagueId: string;
  rivalries: RivalriesResponseDto;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(rivalryId: string, action: 'approve' | 'dismiss') {
    setBusy(rivalryId);
    setError(null);
    try {
      await apiClient.post(`/leagues/${leagueId}/rivalries/${rivalryId}/${action}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rivalries</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {rivalries.active.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Secondary rivals
            </p>
            {rivalries.active.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span>{pairLabel(r)}</span>
                <Badge variant="secondary">score {r.score}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Emerging</p>
          {rivalries.emerging.length === 0 ? (
            <p className="text-muted-foreground">
              None yet — rivalries form from close, repeated games.
            </p>
          ) : (
            rivalries.emerging.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {pairLabel(r)} <span className="text-muted-foreground">· score {r.score}</span>
                </span>
                <span className="flex gap-1">
                  <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, 'dismiss')}
                  >
                    Dismiss
                  </Button>
                </span>
              </div>
            ))
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
