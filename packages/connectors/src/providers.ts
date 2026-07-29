import { createHash } from 'node:crypto';
import { buildExternalRecordKey, checksumContent } from './identity';
import { recordMatchesScope } from './scope-rules';
import type {
  AttachmentRef,
  ConnectorCheckpoint,
  ConnectorProviderKind,
  ConnectorScopeRules,
  ExternalRecordContent,
  ExternalRecordMetadata,
  ExternalRecordRef,
  ListChangedRecordsResult,
  ParsedWebhookEvent,
  ScopeAccessResult,
  WebhookValidationResult,
} from './types';

export interface ConnectorProvider {
  readonly kind: ConnectorProviderKind;
  readonly testOnly?: boolean;
  validateConfiguration(): Promise<{ ok: boolean; reason?: string }>;
  testScopeAccess(scope: ConnectorScopeRules): Promise<ScopeAccessResult>;
  listChangedRecords(checkpoint: ConnectorCheckpoint | null): Promise<ListChangedRecordsResult>;
  fetchRecordMetadata(externalId: string): Promise<ExternalRecordMetadata | null>;
  fetchRecordContent(externalId: string): Promise<ExternalRecordContent | null>;
  fetchAttachment(externalId: string, attachmentId: string): Promise<AttachmentRef | null>;
  getCheckpoint(): Promise<ConnectorCheckpoint>;
  validateWebhook?(
    headers: Record<string, string>,
    rawBody: Buffer,
    seenEventIds?: Set<string>,
  ): Promise<WebhookValidationResult>;
  parseWebhook?(rawBody: Buffer): Promise<ParsedWebhookEvent>;
  revoke(): Promise<{ revoked: true }>;
}

type FakeFixture = {
  externalId: string;
  recordType: ExternalRecordRef['recordType'];
  title: string;
  body: string;
  mimeType: string;
  modifiedAt: string;
  projectReferences: string[];
  attachments: AttachmentRef[];
};

const DEFAULT_FAKE_FIXTURES: FakeFixture[] = [
  {
    externalId: 'mail-001',
    recordType: 'EMAIL',
    title: 'RE: PRJ-ALPHA delay notice',
    body: 'Please review the attached letter regarding contract no. CR-2024-001.',
    mimeType: 'message/rfc822',
    modifiedAt: '2026-07-15T09:00:00.000Z',
    projectReferences: ['PRJ-ALPHA', 'CR-2024-001'],
    attachments: [
      {
        attachmentId: 'att-1',
        filename: 'delay-letter.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        checksumSha256: checksumContent('fake-pdf-body'),
      },
    ],
  },
  {
    externalId: 'doc-002',
    recordType: 'DOCUMENT',
    title: 'Variation instruction JOB-7781',
    body: 'Scope change for mechanical works.',
    mimeType: 'application/pdf',
    modifiedAt: '2026-07-20T14:30:00.000Z',
    projectReferences: ['JOB-7781'],
    attachments: [],
  },
  {
    externalId: 'mail-spam',
    recordType: 'EMAIL',
    title: 'Unrelated newsletter',
    body: 'Marketing content with no project reference.',
    mimeType: 'message/rfc822',
    modifiedAt: '2026-07-10T08:00:00.000Z',
    projectReferences: [],
    attachments: [],
  },
];

export class FakeConnectorProvider implements ConnectorProvider {
  readonly kind = 'fake' as const;
  readonly testOnly = true;
  private readonly fixtures: FakeFixture[];
  private cursor = 0;
  private checkpoint: ConnectorCheckpoint = {
    cursor: null,
    lastSyncedAt: null,
    recordCount: 0,
    safeMetadata: { provider: 'fake' },
  };
  private readonly seenWebhookEvents = new Set<string>();

  constructor(fixtures: FakeFixture[] = DEFAULT_FAKE_FIXTURES) {
    this.fixtures = fixtures;
  }

  async validateConfiguration() {
    return { ok: true };
  }

  async testScopeAccess(scope: ConnectorScopeRules): Promise<ScopeAccessResult> {
    const accessible = this.fixtures.filter(
      (f) =>
        recordMatchesScope(scope, {
          subjectOrTitle: f.title,
          bodyPreview: f.body,
          modifiedAt: f.modifiedAt,
          mimeType: f.mimeType,
          projectReferences: f.projectReferences,
        }).ok,
    );
    return { ok: accessible.length > 0, accessibleCount: accessible.length };
  }

  async listChangedRecords(
    checkpoint: ConnectorCheckpoint | null,
  ): Promise<ListChangedRecordsResult> {
    if (checkpoint?.cursor) {
      this.cursor = Number.parseInt(checkpoint.cursor, 10) || 0;
    }
    const slice = this.fixtures.slice(this.cursor, this.cursor + 2);
    const records: ExternalRecordRef[] = slice.map((f) => ({
      externalId: f.externalId,
      recordType: f.recordType,
      changeKind: 'CREATED',
      modifiedAt: f.modifiedAt,
      checksumHint: checksumContent(f.body).slice(0, 16),
    }));
    this.cursor += slice.length;
    const hasMore = this.cursor < this.fixtures.length;
    this.checkpoint = {
      cursor: String(this.cursor),
      lastSyncedAt: new Date().toISOString(),
      recordCount: this.cursor,
      safeMetadata: { provider: 'fake', pageSize: 2 },
    };
    return { records, nextCheckpoint: this.checkpoint, hasMore };
  }

  async fetchRecordMetadata(externalId: string): Promise<ExternalRecordMetadata | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    if (!f) return null;
    return {
      externalId: f.externalId,
      recordType: f.recordType,
      title: f.title,
      mimeType: f.mimeType,
      sizeBytes: Buffer.byteLength(f.body, 'utf8'),
      modifiedAt: f.modifiedAt,
      projectReferences: f.projectReferences,
      sender: 'engineer@example.com',
      recipients: ['pm@example.com'],
      checksumSha256: checksumContent(f.body),
      safeMetadata: { fixture: true },
    };
  }

  async fetchRecordContent(externalId: string): Promise<ExternalRecordContent | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    if (!f) return null;
    return {
      externalId: f.externalId,
      recordType: f.recordType,
      contentType: f.mimeType,
      checksumSha256: checksumContent(f.body),
      sizeBytes: Buffer.byteLength(f.body, 'utf8'),
      previewText: f.body.slice(0, 200),
    };
  }

  async fetchAttachment(externalId: string, attachmentId: string): Promise<AttachmentRef | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    return f?.attachments.find((a) => a.attachmentId === attachmentId) ?? null;
  }

  async getCheckpoint(): Promise<ConnectorCheckpoint> {
    return this.checkpoint;
  }

  async validateWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
    seenEventIds: Set<string> = this.seenWebhookEvents,
  ): Promise<WebhookValidationResult> {
    const sig = headers['x-cr-fake-signature'] || headers['X-Cr-Fake-Signature'];
    const expected = `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    if (sig !== expected) {
      return { ok: false, reason: 'INVALID_SIGNATURE' };
    }
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as { eventId?: string };
      if (parsed.eventId && seenEventIds.has(parsed.eventId)) {
        return { ok: false, reason: 'REPLAY_DETECTED', replayDetected: true };
      }
      if (parsed.eventId) seenEventIds.add(parsed.eventId);
    } catch {
      return { ok: false, reason: 'INVALID_PAYLOAD' };
    }
    return { ok: true };
  }

  async parseWebhook(rawBody: Buffer): Promise<ParsedWebhookEvent> {
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      eventId: string;
      eventType: string;
      occurredAt: string;
      records?: Array<{ externalId: string; recordType: string; modifiedAt: string }>;
    };
    return {
      providerEventId: parsed.eventId,
      eventType: parsed.eventType,
      occurredAt: parsed.occurredAt,
      externalRecordRefs: (parsed.records ?? []).map((r) => ({
        externalId: r.externalId,
        recordType: r.recordType as ExternalRecordRef['recordType'],
        changeKind: 'UPDATED',
        modifiedAt: r.modifiedAt,
      })),
      redactedPayload: {
        eventId: parsed.eventId,
        eventType: parsed.eventType,
      },
    };
  }

  async revoke() {
    this.cursor = 0;
    this.checkpoint = {
      cursor: null,
      lastSyncedAt: null,
      recordCount: 0,
      safeMetadata: { revoked: true },
    };
    return { revoked: true as const };
  }
}

/** Dev fixture provider — reads from injected in-memory records, never opens network. */
export class LocalFixtureConnectorProvider implements ConnectorProvider {
  readonly kind = 'local_fixture' as const;
  private readonly fixtures: FakeFixture[];
  private checkpoint: ConnectorCheckpoint = {
    cursor: '0',
    lastSyncedAt: null,
    recordCount: 0,
    safeMetadata: { provider: 'local_fixture' },
  };

  constructor(fixtures: FakeFixture[] = []) {
    this.fixtures = fixtures;
  }

  async validateConfiguration() {
    return this.fixtures.length > 0
      ? { ok: true }
      : { ok: false, reason: 'NO_FIXTURES_CONFIGURED' };
  }

  async testScopeAccess(scope: ConnectorScopeRules): Promise<ScopeAccessResult> {
    const accessible = this.fixtures.filter(
      (f) =>
        recordMatchesScope(scope, {
          subjectOrTitle: f.title,
          bodyPreview: f.body,
          modifiedAt: f.modifiedAt,
          mimeType: f.mimeType,
          projectReferences: f.projectReferences,
        }).ok,
    );
    return { ok: accessible.length > 0, accessibleCount: accessible.length };
  }

  async listChangedRecords(
    checkpoint: ConnectorCheckpoint | null,
  ): Promise<ListChangedRecordsResult> {
    const offset = checkpoint?.cursor ? Number.parseInt(checkpoint.cursor, 10) : 0;
    const records: ExternalRecordRef[] = this.fixtures.slice(offset).map((f) => ({
      externalId: f.externalId,
      recordType: f.recordType,
      changeKind: 'CREATED',
      modifiedAt: f.modifiedAt,
    }));
    this.checkpoint = {
      cursor: String(this.fixtures.length),
      lastSyncedAt: new Date().toISOString(),
      recordCount: this.fixtures.length,
      safeMetadata: { captured: true },
    };
    return { records, nextCheckpoint: this.checkpoint, hasMore: false };
  }

  async fetchRecordMetadata(externalId: string): Promise<ExternalRecordMetadata | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    if (!f) return null;
    return {
      externalId: f.externalId,
      recordType: f.recordType,
      title: f.title,
      mimeType: f.mimeType,
      sizeBytes: Buffer.byteLength(f.body, 'utf8'),
      modifiedAt: f.modifiedAt,
      projectReferences: f.projectReferences,
      sender: null,
      recipients: [],
      checksumSha256: checksumContent(f.body),
      safeMetadata: { local: true },
    };
  }

  async fetchRecordContent(externalId: string): Promise<ExternalRecordContent | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    if (!f) return null;
    return {
      externalId: f.externalId,
      recordType: f.recordType,
      contentType: f.mimeType,
      checksumSha256: checksumContent(f.body),
      sizeBytes: Buffer.byteLength(f.body, 'utf8'),
      previewText: f.body.slice(0, 120),
    };
  }

  async fetchAttachment(externalId: string, attachmentId: string): Promise<AttachmentRef | null> {
    const f = this.fixtures.find((x) => x.externalId === externalId);
    return f?.attachments.find((a) => a.attachmentId === attachmentId) ?? null;
  }

  async getCheckpoint(): Promise<ConnectorCheckpoint> {
    return this.checkpoint;
  }

  async revoke() {
    this.checkpoint = {
      cursor: '0',
      lastSyncedAt: null,
      recordCount: 0,
      safeMetadata: { revoked: true },
    };
    return { revoked: true as const };
  }
}

export function assertConnectorProviderAllowed(
  provider: ConnectorProvider,
  appEnv: string | undefined,
): void {
  if (provider.testOnly && (appEnv === 'production' || appEnv === 'staging')) {
    throw new Error('Test-only connector provider is not allowed in this environment');
  }
}

export function createConnectorProvider(env: {
  CONNECTOR_PROVIDER?: string;
  APP_ENV?: string;
}): ConnectorProvider | null {
  const kind = (env.CONNECTOR_PROVIDER || 'none').toLowerCase();
  if (kind === 'none' || kind === '') return null;
  if (kind === 'fake') {
    const provider = new FakeConnectorProvider();
    assertConnectorProviderAllowed(provider, env.APP_ENV);
    return provider;
  }
  if (kind === 'local_fixture' || kind === 'local') {
    return new LocalFixtureConnectorProvider();
  }
  if (kind === 'microsoft' || kind === 'gmail' || kind === 'edms') {
    throw new Error(`Provider ${kind} requires approved configuration and is not auto-enabled`);
  }
  throw new Error(`Unknown CONNECTOR_PROVIDER: ${kind}`);
}

export function buildExternalRecordKeyForProvider(
  provider: ConnectorProvider,
  tenantId: string,
  recordType: ExternalRecordRef['recordType'],
  externalId: string,
): string {
  return buildExternalRecordKey({
    providerKind: provider.kind,
    tenantId,
    recordType,
    externalId,
  });
}
