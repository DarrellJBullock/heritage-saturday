'use client';

// Client Component: fetches preview data on mount, holds commit-in-progress
// state, and triggers a client-side commit action + redirect.

import { useEffect, useState, use as usePromise } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  ImportPreviewResponseDto,
  CommitImportResponseDto,
  ImportRowStatus,
} from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

function statusBadgeVariant(status: ImportRowStatus) {
  if (status === 'OK') return 'default' as const;
  if (status === 'WARNING') return 'secondary' as const;
  return 'destructive' as const;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ImportPreviewPage({ params }: PageProps) {
  const { id } = usePromise(params);

  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitImportResponseDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ImportPreviewResponseDto>(`/imports/${id}/preview`)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load preview.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasBlockingErrors = preview?.rows.some((row) => row.status === 'ERROR') ?? false;

  // WARNING rows are valid but undeliverable: an orphaned player/coach/depth-chart row
  // whose team or player will not be created, or a depth chart that cannot cover the
  // required lineup. Commit drops them and counts them as `skipped`. Surface them, and
  // deduplicate the messages — one missing team orphans every one of its rows, and
  // repeating the same sentence twenty times buries the signal.
  const warningRows = preview?.rows.filter((row) => row.status === 'WARNING') ?? [];
  const warningMessages = Array.from(new Set(warningRows.flatMap((row) => row.messages)));

  async function handleCommit() {
    setIsCommitting(true);
    setCommitError(null);
    try {
      const result = await apiClient.post<CommitImportResponseDto>(`/imports/${id}/commit`);
      setCommitResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'IMPORT_ALREADY_COMMITTED') {
          setCommitError('This import has already been committed.');
        } else {
          setCommitError(err.message);
        }
      } else {
        setCommitError('An unexpected error occurred while committing.');
      }
    } finally {
      setIsCommitting(false);
    }
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load preview</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (!preview) {
    return <p className="text-muted-foreground text-sm">Loading preview…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Preview: {preview.fileName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review each row before committing. Rows marked ERROR or WARNING are excluded
          from the import — only OK rows are created.
        </p>
      </div>

      {commitResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Import Committed</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              created {commitResult.summary.created} · updated {commitResult.summary.updated} ·
              skipped {commitResult.summary.skipped} · failed {commitResult.summary.failed}
            </p>
            <div className="flex gap-2">
              <Button render={<a href="/games/new" />}>Set Up a Game</Button>
              <Button variant="outline" render={<a href="/imports" />}>
                Back to Import History
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Projected Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              created {preview.summary.created} · updated {preview.summary.updated} · skipped{' '}
              {preview.summary.skipped} · failed {preview.summary.failed}
            </p>
            {commitError && (
              <Alert variant="destructive">
                <AlertTitle>Commit failed</AlertTitle>
                <AlertDescription>{commitError}</AlertDescription>
              </Alert>
            )}
            {warningRows.length > 0 && (
              <Alert>
                <AlertTitle>
                  {warningRows.length} {warningRows.length === 1 ? 'row' : 'rows'} will not be
                  created
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    These rows are valid, but reference something this import will not create,
                    or belong to a depth chart that cannot be used. Committing is safe — they
                    are skipped, not failed. Fix the cause and re-upload to include them.
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    {warningMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {hasBlockingErrors && (
              <p className="text-xs text-muted-foreground">
                Rows with ERROR status are excluded automatically and reported as failed.
              </p>
            )}
            <Button onClick={handleCommit} disabled={isCommitting} className="w-fit">
              {isCommitting ? 'Committing…' : 'Commit Import'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sheet</TableHead>
              <TableHead>Row</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={`${row.sheet}-${row.rowIndex}`}>
                <TableCell className="capitalize">{row.sheet}</TableCell>
                <TableCell>{row.rowIndex}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.messages.length > 0 ? row.messages.join('; ') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
