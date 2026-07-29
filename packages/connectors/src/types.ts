export const CONNECTOR_RULESET_VERSION = 'connectors-ruleset-v1';

export const CONNECTOR_PROVIDER_KINDS = [
  'fake',
  'local_fixture',
  'microsoft',
  'gmail',
  'edms',
] as const;
export type ConnectorProviderKind = (typeof CONNECTOR_PROVIDER_KINDS)[number];

export const CONNECTOR_STATUSES = [
  'DRAFT',
  'CONFIGURED',
  'ACTIVE',
  'PAUSED',
  'ERROR',
  'REVOKED',
] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const EXTERNAL_RECORD_TYPES = [
  'EMAIL',
  'DOCUMENT',
  'ATTACHMENT',
  'FOLDER',
  'THREAD',
] as const;
export type ExternalRecordType = (typeof EXTERNAL_RECORD_TYPES)[number];

export const SYNC_RUN_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PARTIAL',
] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

export const SYNC_DIRECTIONS = ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const RECORD_CHANGE_KINDS = ['CREATED', 'UPDATED', 'DELETED', 'UNCHANGED'] as const;
export type RecordChangeKind = (typeof RECORD_CHANGE_KINDS)[number];

export type ConnectorScopeRules = {
  includePatterns: string[];
  excludePatterns: string[];
  dateFrom: string | null;
  dateTo: string | null;
  projectReferencePatterns: string[];
  mimeAllowlist: string[];
};

export type ExternalRecordRef = {
  externalId: string;
  recordType: ExternalRecordType;
  parentExternalId?: string | null;
  changeKind: RecordChangeKind;
  modifiedAt: string;
  checksumHint?: string | null;
};

export type ExternalRecordMetadata = {
  externalId: string;
  recordType: ExternalRecordType;
  title: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  modifiedAt: string;
  projectReferences: string[];
  sender: string | null;
  recipients: string[];
  checksumSha256: string | null;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export type ExternalRecordContent = {
  externalId: string;
  recordType: ExternalRecordType;
  contentType: string;
  checksumSha256: string;
  sizeBytes: number;
  /** Redacted preview only — never full document text in provider metadata paths. */
  previewText: string | null;
};

export type AttachmentRef = {
  attachmentId: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
};

export type ConnectorCheckpoint = {
  cursor: string | null;
  lastSyncedAt: string | null;
  recordCount: number;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export type WebhookValidationResult = {
  ok: boolean;
  reason?: string;
  replayDetected?: boolean;
};

export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  externalRecordRefs: ExternalRecordRef[];
  redactedPayload: Record<string, unknown>;
};

export type ScopeAccessResult = {
  ok: boolean;
  reason?: string;
  accessibleCount?: number;
};

export type ListChangedRecordsResult = {
  records: ExternalRecordRef[];
  nextCheckpoint: ConnectorCheckpoint;
  hasMore: boolean;
};
