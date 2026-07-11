'use client';

// Client Component: roll back a committed import — deletes the roster it created and returns the
// import to a re-committable state. Confirmed, and blocked by the API if the roster has games.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export function ImportRollback({ leagueId, importId }: { leagueId: string; importId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rollback() {
    if (!confirm('Roll back this import? The roster it created will be permanently deleted.')) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/leagues/${leagueId}/imports/${importId}/rollback`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not roll back.');
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-destructive text-xs">{error}</span>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={rollback}>
        Roll back
      </Button>
    </span>
  );
}
