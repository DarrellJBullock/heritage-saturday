'use client';

// Client Component: set or clear a player's headshot photo URL. PATCHes through the proxy, then
// refreshes the server-rendered page so the new photo appears. Only rendered when the viewer owns
// the player (PlayerDetailDto.canEditHeadshot).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function HeadshotEditor({
  playerId,
  currentUrl,
}: {
  playerId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(currentUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/players/${playerId}/headshot`, { headshotUrl: next });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/photo.jpg"
          className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
        />
        <Button size="sm" disabled={busy} onClick={() => save(url.trim() || null)}>
          {busy ? 'Saving…' : 'Save photo'}
        </Button>
        {currentUrl && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(null)}>
            Remove
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">Paste an https link to an image.</p>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t update photo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
