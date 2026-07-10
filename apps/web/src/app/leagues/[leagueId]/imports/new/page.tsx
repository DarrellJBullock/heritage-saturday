'use client';

// Client Component: needs a controlled file input, local upload/loading
// state, and a client-side fetch + router redirect on success.

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type { UploadRosterResponseDto } from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

const ACCEPTED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls'];

export default function NewImportPage() {
  const router = useRouter();
  const { leagueId } = useParams<{ leagueId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    const form = new FormData();
    form.append('file', selectedFile);

    try {
      const result = await apiClient.postForm<UploadRosterResponseDto>(
        `/leagues/${leagueId}/imports/roster`,
        form,
      );
      router.push(`/leagues/${leagueId}/imports/${result.importId}/preview`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'UNSUPPORTED_FILE_FORMAT') {
          // Per the known 422 ambiguity: the top-level parse-failure message
          // lives at detail.topLevelError, not just err.message.
          setError({
            title: 'Unsupported or unreadable file',
            detail: err.topLevelError ?? err.message,
          });
        } else {
          setError({ title: 'Upload failed', detail: err.message });
        }
      } else {
        setError({ title: 'Upload failed', detail: 'An unexpected error occurred.' });
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Import Roster</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV, JSON, XLSX, or XLS file containing Players and Teams sheets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>
            Don&apos;t have a file ready? Download the{' '}
            <a
              href="/templates/roster-template.csv"
              download
              className="underline underline-offset-2"
            >
              blank CSV template
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roster-file">Roster file</Label>
              <input
                id="roster-file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: {ACCEPTED_EXTENSIONS.join(', ')}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error.title}</AlertTitle>
                <AlertDescription>{error.detail}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={!selectedFile || isUploading}>
              {isUploading ? 'Uploading…' : 'Upload & Preview'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
