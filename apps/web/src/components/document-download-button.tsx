'use client';

import { useState } from 'react';
import { SecondaryButton } from '@/components/ui';

export function DownloadButton({
  projectId,
  documentId,
  versionId,
}: {
  projectId: string;
  documentId: string;
  versionId: string;
}) {
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentVersionId: versionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message ?? 'Download authorization failed');
      return;
    }
    window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <SecondaryButton type="button" onClick={onClick}>
        Secure download
      </SecondaryButton>
      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
