'use client';

// Client Component: the owner's league membership controls — list members with their role, add
// by email with a role, change a member's role, and remove.

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { LeagueMemberDto, MemberRole } from '@heritage-saturday/shared';
import { MEMBER_ROLES } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const selectClass = 'rounded-md border bg-transparent px-2 py-1 text-sm';

export function MembersPanel({ leagueId }: { leagueId: string }) {
  const [members, setMembers] = useState<LeagueMemberDto[] | null>(null);
  const [email, setEmail] = useState('');
  const [addRole, setAddRole] = useState<MemberRole>('VIEWER');
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

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Membership action failed.');
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
          A <strong>commissioner</strong> can run the league; a <strong>manager</strong> can import
          rosters and set visibility; a <strong>viewer</strong> can only read League-visible rosters.
        </p>

        <ul className="flex flex-col gap-1">
          {(members ?? []).map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{m.email}</span>
              {m.role === 'OWNER' ? (
                <Badge>OWNER</Badge>
              ) : (
                <span className="flex items-center gap-2">
                  <select
                    className={selectClass}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) =>
                      act(() =>
                        apiClient.patch(`/leagues/${leagueId}/members/${m.userId}`, {
                          role: e.target.value as MemberRole,
                        }),
                      )
                    }
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act(() => apiClient.delete(`/leagues/${leagueId}/members/${m.userId}`))}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            void act(async () => {
              await apiClient.post(`/leagues/${leagueId}/members`, { email: email.trim(), role: addRole });
              setEmail('');
            });
          }}
          className="flex flex-wrap items-end gap-2"
        >
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
          <select
            aria-label="Role"
            className={`${selectClass} py-1.5`}
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as MemberRole)}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
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
