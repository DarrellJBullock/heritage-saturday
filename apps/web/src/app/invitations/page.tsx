import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { InvitationDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InvitationActions } from './invitation-actions';

/**
 * Server Component: the caller's invitation inbox — leagues they've been invited to, each with
 * accept/decline. Invitations are matched to the signed-in user's email.
 */
export default async function InvitationsPage() {
  let invitations: InvitationDto[] = [];
  let loadError: string | null = null;
  try {
    invitations = await serverApiClient.get<InvitationDto[]>('/invitations');
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Failed to load invitations.';
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Invitations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Leagues you&apos;ve been invited to join.
        </p>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load invitations</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loadError && invitations.length === 0 && (
        <p className="text-muted-foreground text-sm">No pending invitations.</p>
      )}

      <div className="flex flex-col gap-3">
        {invitations.map((inv) => (
          <Card key={inv.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{inv.leagueName}</CardTitle>
              <Badge variant="secondary">{inv.role}</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">Invited by {inv.invitedByEmail}</span>
              <InvitationActions invitationId={inv.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
