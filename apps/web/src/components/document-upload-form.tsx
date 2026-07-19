'use client';

import { useState } from 'react';
import { Button, Label, TextInput } from '@/components/ui';

const DOCUMENT_TYPES = [
  'CONTRACT',
  'LETTER',
  'EMAIL',
  'RFI',
  'ENGINEER_INSTRUCTION',
  'MEETING_MINUTES',
  'DRAWING',
  'SCHEDULE',
  'SPREADSHEET',
  'PHOTOGRAPH',
  'OTHER',
] as const;

export function DocumentUploadForm({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<string>('Idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setStatus('Starting upload session…');
    try {
      const file = formData.get('file');
      if (!(file instanceof File) || file.size === 0) {
        throw new Error('Choose a non-empty file.');
      }

      const initiateRes = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: String(formData.get('title') || file.name),
          documentType: String(formData.get('documentType') || 'OTHER'),
          filename: file.name,
          declaredMediaType: file.type || 'application/octet-stream',
          declaredSizeBytes: file.size,
          documentNumber: String(formData.get('documentNumber') || '') || undefined,
          language: String(formData.get('language') || 'UNKNOWN'),
          confidentiality: String(formData.get('confidentiality') || 'STANDARD'),
          correspondenceDate: formData.get('correspondenceDate')
            ? new Date(String(formData.get('correspondenceDate'))).toISOString()
            : undefined,
        }),
      });
      const initiate = await initiateRes.json();
      if (!initiateRes.ok) {
        throw new Error(initiate?.error?.message ?? 'Failed to initiate upload');
      }

      setStatus('Uploading to secure storage…');
      const putRes = await fetch(initiate.uploadUrl, {
        method: 'PUT',
        headers: initiate.uploadHeaders,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Direct upload to object storage failed');
      }

      setStatus('Verifying checksum and file type…');
      const completeRes = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadSessionId: initiate.uploadSessionId,
          duplicateDecision: formData.get('duplicateDecision') || undefined,
        }),
      });
      const complete = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(complete?.error?.message ?? 'Upload completion failed');
      }

      if (complete.status === 'DUPLICATE_CONTENT') {
        setStatus(
          `Exact duplicate detected (SHA-256 matches version ${complete.existingVersion?.versionNumber}). Choose a duplicate decision and retry completion, or cancel.`,
        );
        setError('Duplicate content — not accepted yet.');
        return;
      }

      setStatus(
        `Accepted for quarantine/malware scan. Document ${complete.sourceDocumentId}. Processing queued.`,
      );
      window.location.href = `/projects/${projectId}/documents/${complete.sourceDocumentId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <div>
        <Label htmlFor="title">Title</Label>
        <TextInput id="title" name="title" required maxLength={500} />
      </div>
      <div>
        <Label htmlFor="documentType">Document type</Label>
        <select
          id="documentType"
          name="documentType"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
          defaultValue="LETTER"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="documentNumber">Document number (optional)</Label>
        <TextInput id="documentNumber" name="documentNumber" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="correspondenceDate">Correspondence date (optional)</Label>
        <TextInput id="correspondenceDate" name="correspondenceDate" type="date" />
      </div>
      <div>
        <Label htmlFor="language">Language</Label>
        <select
          id="language"
          name="language"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
          defaultValue="UNKNOWN"
        >
          <option value="UNKNOWN">Unknown</option>
          <option value="EN">English</option>
          <option value="AR">Arabic</option>
          <option value="MIXED">Mixed</option>
        </select>
      </div>
      <div>
        <Label htmlFor="confidentiality">Confidentiality</Label>
        <select
          id="confidentiality"
          name="confidentiality"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
          defaultValue="STANDARD"
        >
          <option value="STANDARD">Standard</option>
          <option value="CONFIDENTIAL">Confidential</option>
          <option value="RESTRICTED">Restricted</option>
        </select>
      </div>
      <div>
        <Label htmlFor="file">File</Label>
        <TextInput
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.docx,.xlsx,.csv,.txt,.eml,.xml,.xer,.png,.jpg,.jpeg,.tif,.tiff"
        />
      </div>
      <p className="text-sm text-ink-700" role="status" aria-live="polite">
        Status: {status}
      </p>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-ink-600">
        Supported: PDF, DOCX, XLSX, CSV, TXT, EML, XML/XER, PNG/JPEG/TIFF. Max size configured
        server-side. MSG is not supported. Files are not marked clean until malware scanning
        completes.
      </p>
      <Button type="submit" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload evidence'}
      </Button>
    </form>
  );
}
