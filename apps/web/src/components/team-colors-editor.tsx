'use client';

// Client Component: edit a team's colors. Each field has a native color picker and a HEX text
// box (kept in sync); PATCHes through the proxy and refreshes. Only rendered for the owner
// (TeamDetailDto.canEditColors). The server re-validates every value.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { TeamColorsDto } from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FIELDS: { key: keyof TeamColorsDto; label: string }[] = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'helmetColor', label: 'Helmet' },
  { key: 'homeJerseyColor', label: 'Home jersey' },
  { key: 'awayJerseyColor', label: 'Away jersey' },
];

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function TeamColorsEditor({ teamId, colors }: { teamId: string; colors: TeamColorsDto }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, colors[f.key] ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        FIELDS.map((f) => [f.key, values[f.key]?.trim() || null]),
      );
      await apiClient.patch(`/teams/${teamId}/colors`, payload);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const val = values[f.key] ?? '';
          return (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="color"
                value={HEX.test(val) ? val : '#000000'}
                onChange={(e) => set(f.key, e.target.value)}
                aria-label={`${f.label} color`}
                className="border-input h-8 w-8 shrink-0 cursor-pointer rounded border bg-transparent p-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-xs">{f.label}</div>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="#1a2b3c"
                  className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <Button size="sm" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save colors'}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save colors</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
