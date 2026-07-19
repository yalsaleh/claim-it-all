import type { SourceDocumentStatus, UploadSessionStatus } from '@prisma/client';

const UPLOAD_SESSION_TRANSITIONS: Record<UploadSessionStatus, UploadSessionStatus[]> = {
  INITIATED: ['UPLOAD_AUTHORIZED', 'CANCELLED', 'FAILED', 'EXPIRED'],
  UPLOAD_AUTHORIZED: ['UPLOADED', 'CANCELLED', 'FAILED', 'EXPIRED'],
  UPLOADED: ['VALIDATING', 'FAILED', 'EXPIRED'],
  VALIDATING: ['ACCEPTED', 'REJECTED', 'FAILED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
};

const SOURCE_DOCUMENT_TRANSITIONS: Record<SourceDocumentStatus, SourceDocumentStatus[]> = {
  UPLOADING: ['RECEIVED', 'QUARANTINED', 'REJECTED', 'FAILED'],
  RECEIVED: ['QUARANTINED', 'PROCESSING', 'REJECTED', 'FAILED'],
  QUARANTINED: ['PROCESSING', 'REJECTED', 'FAILED'],
  PROCESSING: ['READY', 'PARTIALLY_PROCESSED', 'FAILED'],
  READY: ['SUPERSEDED', 'ARCHIVED'],
  PARTIALLY_PROCESSED: ['READY', 'PROCESSING', 'FAILED', 'ARCHIVED'],
  FAILED: ['PROCESSING', 'ARCHIVED', 'REJECTED'],
  REJECTED: ['ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionUploadSession(
  from: UploadSessionStatus,
  to: UploadSessionStatus,
): boolean {
  return UPLOAD_SESSION_TRANSITIONS[from].includes(to);
}

export function assertUploadSessionTransition(
  from: UploadSessionStatus,
  to: UploadSessionStatus,
): void {
  if (!canTransitionUploadSession(from, to)) {
    throw new Error(`INVALID_UPLOAD_SESSION_TRANSITION:${from}->${to}`);
  }
}

export function canTransitionSourceDocument(
  from: SourceDocumentStatus,
  to: SourceDocumentStatus,
): boolean {
  return SOURCE_DOCUMENT_TRANSITIONS[from].includes(to);
}

export function assertSourceDocumentTransition(
  from: SourceDocumentStatus,
  to: SourceDocumentStatus,
): void {
  if (!canTransitionSourceDocument(from, to)) {
    throw new Error(`INVALID_SOURCE_DOCUMENT_TRANSITION:${from}->${to}`);
  }
}
