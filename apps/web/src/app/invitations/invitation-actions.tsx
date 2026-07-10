'use client';

// Client Component: Accept / Decline buttons for a pending invitation. Accept lands you on the
// league; decline refreshes the inbox.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { leagueId } = await apiClient.post<{ leagueId: string }>(
        `/invitations/${invitationId}/accept`,
      );
      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept.');
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/invitations/${invitationId}/decline`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline.');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-destructive text-xs">{error}</span>}
      <Button size="sm" disabled={busy} onClick={accept}>
        Accept
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={decline}>
        Decline
      </Button>
    </div>
  );
}
