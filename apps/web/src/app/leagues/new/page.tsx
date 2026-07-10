'use client';

// Client Component: a small controlled form (name, size, generate-or-empty) that POSTs to
// /leagues and redirects to the new league.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { LEAGUE_SIZES } from '@heritage-saturday/shared';
import type { CreateLeagueRequestDto, LeagueListItemDto, LeagueSize } from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// The single generation template available today. More flavors can be added without changing
// this form — the value just needs to be a key the league-generator accepts.
const TEMPLATE_KEY = 'heritage-classic';

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [size, setSize] = useState<LeagueSize>(8);
  const [mode, setMode] = useState<'template' | 'empty'>('template');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    const body: CreateLeagueRequestDto = {
      name: name.trim(),
      size,
      ...(mode === 'template' ? { templateKey: TEMPLATE_KEY } : {}),
    };

    try {
      const league = await apiClient.post<LeagueListItemDto>('/leagues', body);
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the league.');
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">New League</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate a full, playable league from a template, or start empty and import your own
          rosters.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>League details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="league-name">Name</Label>
              <input
                id="league-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My League"
                className="rounded-md border bg-transparent px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Teams</Label>
              <Select value={String(size)} onValueChange={(v) => setSize(Number(v) as LeagueSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAGUE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>How to fill it</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'template' | 'empty')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Generate teams (playable immediately)</SelectItem>
                  <SelectItem value="empty">Start empty (import my own rosters)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Could not create league</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={!name.trim() || isCreating} className="w-fit">
              {isCreating ? 'Creating…' : 'Create League'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
