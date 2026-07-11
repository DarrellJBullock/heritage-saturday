import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { serverApiClient } from '@/lib/api-client.server';
import type { ImportHistoryItemDto } from '@heritage-saturday/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ImportRollback } from './import-rollback';

/**
 * Server Component: read-only history list, no client interactivity needed —
 * fetched directly on the server via the shared apiClient (works the same in
 * RSC as in the browser since it's just `fetch`).
 */
export default async function ImportsHistoryPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  let imports: ImportHistoryItemDto[] = [];
  let loadError: string | null = null;

  try {
    imports = await serverApiClient.get<ImportHistoryItemDto[]>(`/leagues/${leagueId}/imports`);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Failed to load import history.';
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Import History</h1>
        <Button size="sm" render={<Link href={`/leagues/${leagueId}/imports/new`} />}>
          New Import
        </Button>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load import history</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loadError && imports.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No imports yet. Start by uploading a roster file.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {imports.map((item) => (
          <Card key={item.importId}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{item.fileName}</CardTitle>
              <Badge
                variant={
                  item.status === 'COMMITTED'
                    ? 'default'
                    : item.status === 'FAILED'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {item.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </span>
              <span>
                created {item.summary.created} · updated {item.summary.updated} · skipped{' '}
                {item.summary.skipped} · failed {item.summary.failed}
              </span>
              {item.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/leagues/${leagueId}/imports/${item.importId}/preview`} />}
                >
                  Review
                </Button>
              )}
              {item.status === 'COMMITTED' && (
                <ImportRollback leagueId={leagueId} importId={item.importId} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
