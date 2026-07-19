import { DEFAULT_INGESTION_LIMITS, EXTENSION_MEDIA_TYPE } from '@contractradar/shared';
import { assertSafeFilename } from './filename';

export type FilePolicyResult =
  | { ok: true; normalizedFilename: string; extension: string; mediaType: string }
  | { ok: false; code: string; message: string };

const MAGIC: Array<{ mediaType: string; bytes: number[]; offset?: number }> = [
  { mediaType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mediaType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mediaType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mediaType: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mediaType: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  // ZIP-based office: PK
  { mediaType: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export function validateDeclaredUpload(input: {
  filename: string;
  declaredMediaType: string;
  declaredSizeBytes: number;
  maxBytes?: number;
}): FilePolicyResult {
  const maxBytes = input.maxBytes ?? DEFAULT_INGESTION_LIMITS.maxUploadBytes;
  if (!Number.isFinite(input.declaredSizeBytes) || input.declaredSizeBytes <= 0) {
    return { ok: false, code: 'ZERO_BYTE', message: 'File size must be greater than zero.' };
  }
  if (input.declaredSizeBytes > maxBytes) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `File exceeds maximum size of ${maxBytes} bytes.`,
    };
  }

  let normalizedFilename: string;
  let extension: string;
  try {
    ({ normalized: normalizedFilename, extension } = assertSafeFilename(input.filename));
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error ? error.message : 'FILENAME_UNSAFE',
      message: 'Filename is not allowed.',
    };
  }

  if (extension === 'msg') {
    return {
      ok: false,
      code: 'FORMAT_UNSUPPORTED',
      message: 'MSG files are not supported in this release. Export as EML or PDF.',
    };
  }

  const expected = EXTENSION_MEDIA_TYPE[extension];
  if (!expected) {
    return {
      ok: false,
      code: 'FORMAT_UNSUPPORTED',
      message: `Extension .${extension || '(none)'} is not supported for upload.`,
    };
  }

  if (input.declaredMediaType && input.declaredMediaType !== expected) {
    // Allow browser quirks for xer/xml/csv
    const looseOk =
      (expected === 'text/plain' && input.declaredMediaType.startsWith('text/')) ||
      (expected === 'application/xml' && input.declaredMediaType.includes('xml')) ||
      (expected.startsWith('image/') && input.declaredMediaType === 'application/octet-stream');
    if (!looseOk && input.declaredMediaType !== 'application/octet-stream') {
      return {
        ok: false,
        code: 'MEDIA_TYPE_MISMATCH',
        message: 'Declared media type does not match file extension.',
      };
    }
  }

  return { ok: true, normalizedFilename, extension, mediaType: expected };
}

export function detectMediaTypeFromBytes(
  bytes: Uint8Array,
  extension: string,
): { mediaType: string; matchedMagic: boolean } {
  for (const candidate of MAGIC) {
    const offset = candidate.offset ?? 0;
    if (bytes.length < offset + candidate.bytes.length) continue;
    const ok = candidate.bytes.every((b, i) => bytes[offset + i] === b);
    if (!ok) continue;
    if (candidate.mediaType === 'application/zip') {
      if (extension === 'docx') {
        return {
          mediaType: EXTENSION_MEDIA_TYPE.docx as string,
          matchedMagic: true,
        };
      }
      if (extension === 'xlsx') {
        return {
          mediaType: EXTENSION_MEDIA_TYPE.xlsx as string,
          matchedMagic: true,
        };
      }
      return { mediaType: 'application/zip', matchedMagic: true };
    }
    return { mediaType: candidate.mediaType, matchedMagic: true };
  }

  // Text-ish formats have no strong magic
  const textExt = new Set(['txt', 'csv', 'eml', 'xml', 'xer']);
  if (textExt.has(extension)) {
    return { mediaType: EXTENSION_MEDIA_TYPE[extension] ?? 'text/plain', matchedMagic: false };
  }

  return { mediaType: 'application/octet-stream', matchedMagic: false };
}

export function assertMagicMatchesPolicy(input: {
  bytes: Uint8Array;
  extension: string;
  expectedMediaType: string;
}): { ok: true; mediaType: string } | { ok: false; code: string; message: string } {
  const detected = detectMediaTypeFromBytes(input.bytes, input.extension);
  if (detected.mediaType === 'application/octet-stream') {
    return {
      ok: false,
      code: 'SIGNATURE_UNKNOWN',
      message: 'Could not verify file content signature.',
    };
  }
  if (detected.matchedMagic && detected.mediaType !== input.expectedMediaType) {
    // docx/xlsx both zip
    const officeZip =
      detected.mediaType === 'application/zip' &&
      (input.expectedMediaType.includes('wordprocessingml') ||
        input.expectedMediaType.includes('spreadsheetml'));
    if (!officeZip) {
      return {
        ok: false,
        code: 'SIGNATURE_MISMATCH',
        message: 'File content does not match the declared format.',
      };
    }
  }
  if (
    !detected.matchedMagic &&
    detected.mediaType !== input.expectedMediaType &&
    input.extension !== 'xer'
  ) {
    return {
      ok: false,
      code: 'SIGNATURE_MISMATCH',
      message: 'File content does not match the declared format.',
    };
  }
  return { ok: true, mediaType: input.expectedMediaType };
}
