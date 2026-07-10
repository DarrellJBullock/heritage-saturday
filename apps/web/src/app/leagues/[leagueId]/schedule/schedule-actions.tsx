'use client';

// Client Component: the schedule's mutating actions (generate a schedule, simulate the next
// week). It POSTs through the proxy, then refreshes the server-rendered page to show new results.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ScheduleActions({
  leagueId,
  hasSchedule,
  nextWeek,
}: {
  leagueId: string;
  hasSchedule: boolean;
  nextWeek: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(path);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!hasSchedule && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(`/leagues/${leagueId}/schedule`)}
          >
            {busy ? 'Generating…' : 'Generate Schedule'}
          </Button>
        )}
        {hasSchedule && nextWeek !== null && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(`/leagues/${leagueId}/schedule/simulate-week`)}
          >
            {busy ? 'Simulating…' : `Simulate Week ${nextWeek}`}
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
