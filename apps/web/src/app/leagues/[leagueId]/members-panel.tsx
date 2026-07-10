'use client';

// Client Component: the owner's league membership controls — list members, add by email, remove.

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { LeagueMemberDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function MembersPanel({ leagueId }: { leagueId: string }) {
  const [members, setMembers] = useState<LeagueMemberDto[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setMembers(await apiClient.get<LeagueMemberDto[]>(`/leagues/${leagueId}/members`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load members.');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/leagues/${leagueId}/members`, { email: email.trim() });
      setEmail('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/leagues/${leagueId}/members/${userId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove member.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Members can view rosters you&apos;ve promoted to <strong>League</strong> visibility.
        </p>

        <ul className="flex flex-col gap-1">
          {(members ?? []).map((m) => (
            <li key={m.userId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {m.email}
                <Badge variant={m.role === 'OWNER' ? 'default' : 'secondary'}>{m.role}</Badge>
              </span>
              {m.role === 'MEMBER' && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(m.userId)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="member-email">Add a member by email</Label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="rounded-md border bg-transparent px-3 py-1.5 text-sm"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || !email.trim()}>
            Add
          </Button>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Membership error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
