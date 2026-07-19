const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'js',
  'jar',
  'ps1',
  'sh',
  'dll',
  'vbs',
]);

/** Normalize a user-supplied filename for safe display — never used as storage key. */
export function normalizeFilename(raw: string): string {
  const withoutControls = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  // Take basename before rewriting separators so path segments cannot survive.
  const base = withoutControls.split(/[/\\]/).filter(Boolean).pop() ?? 'upload';
  const cleaned = base.replace(/\.\.+/g, '.').replace(/^\.+/, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 180) || 'upload';
}

export function extractExtension(filename: string): string {
  const normalized = normalizeFilename(filename);
  const idx = normalized.lastIndexOf('.');
  if (idx <= 0 || idx === normalized.length - 1) return '';
  return normalized.slice(idx + 1).toLowerCase();
}

export function assertSafeFilename(raw: string): { normalized: string; extension: string } {
  if (!raw || !raw.trim()) {
    throw new Error('FILENAME_REQUIRED');
  }
  if (raw.includes('\0') || raw.includes('..')) {
    throw new Error('FILENAME_UNSAFE');
  }
  const normalized = normalizeFilename(raw);
  const extension = extractExtension(normalized);
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw new Error('FILENAME_EXECUTABLE_REJECTED');
  }
  return { normalized, extension };
}
