import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildExternalRecordKey, checksumContent, sha256Hex } from './identity';
import {
  FakeConnectorProvider,
  assertConnectorProviderAllowed,
  createConnectorProvider,
} from './providers';
import {
  extractProjectReferences,
  isMimeAllowed,
  isWithinDateRange,
  matchesIncludeExclude,
  matchesProjectReference,
  recordMatchesScope,
} from './scope-rules';
import type { ConnectorScopeRules } from './types';

const defaultScope: ConnectorScopeRules = {
  includePatterns: ['*delay*', '*PRJ*'],
  excludePatterns: ['*newsletter*'],
  dateFrom: '2026-07-01T00:00:00.000Z',
  dateTo: '2026-07-31T23:59:59.999Z',
  projectReferencePatterns: ['PRJ-*', 'JOB-*', 'CR-*'],
  mimeAllowlist: ['message/*', 'application/pdf'],
};

describe('scope rules', () => {
  it('applies include/exclude matching', () => {
    expect(matchesIncludeExclude(['*delay*'], ['*newsletter*'], 'RE: delay notice')).toBe(true);
    expect(matchesIncludeExclude(['*delay*'], [], 'unrelated topic')).toBe(false);
    expect(matchesIncludeExclude([], ['*spam*'], 'buy spam today')).toBe(false);
  });

  it('checks date ranges', () => {
    expect(isWithinDateRange('2026-07-15T10:00:00.000Z', '2026-07-01T00:00:00.000Z', null)).toBe(
      true,
    );
    expect(isWithinDateRange('2026-06-01T10:00:00.000Z', '2026-07-01T00:00:00.000Z', null)).toBe(
      false,
    );
  });

  it('extracts and matches project references', () => {
    const refs = extractProjectReferences('Contract no. CR-2024-001 for PRJ-ALPHA');
    expect(refs).toContain('CR-2024-001');
    expect(refs).toContain('PRJ-ALPHA');
    expect(matchesProjectReference(['PRJ-*'], refs)).toBe(true);
    expect(matchesProjectReference(['JOB-*'], refs)).toBe(false);
  });

  it('enforces MIME allowlist', () => {
    expect(isMimeAllowed('application/pdf', ['application/pdf'])).toBe(true);
    expect(isMimeAllowed('application/json', ['application/pdf'])).toBe(false);
    expect(isMimeAllowed('message/rfc822', ['message/*'])).toBe(true);
  });

  it('evaluates full scope match', () => {
    const ok = recordMatchesScope(defaultScope, {
      subjectOrTitle: 'RE: PRJ-ALPHA delay notice',
      bodyPreview: 'Contract CR-2024-001',
      modifiedAt: '2026-07-15T09:00:00.000Z',
      mimeType: 'message/rfc822',
      projectReferences: ['PRJ-ALPHA'],
    });
    expect(ok.ok).toBe(true);

    const blocked = recordMatchesScope(defaultScope, {
      subjectOrTitle: 'Unrelated newsletter',
      modifiedAt: '2026-07-15T09:00:00.000Z',
      mimeType: 'message/rfc822',
    });
    expect(blocked.ok).toBe(false);
  });
});

describe('identity', () => {
  it('builds stable external record keys', () => {
    const a = buildExternalRecordKey({
      providerKind: 'fake',
      tenantId: 'tenant-1',
      recordType: 'EMAIL',
      externalId: 'mail-001',
    });
    const b = buildExternalRecordKey({
      providerKind: 'fake',
      tenantId: 'tenant-1',
      recordType: 'EMAIL',
      externalId: 'mail-001',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('checksums content deterministically', () => {
    expect(checksumContent('hello')).toBe(sha256Hex('hello'));
  });
});

describe('providers', () => {
  it('rejects fake provider in production', () => {
    expect(() => assertConnectorProviderAllowed(new FakeConnectorProvider(), 'production')).toThrow(
      /Test-only/,
    );
  });

  it('syncs via fake provider without network', async () => {
    const provider = new FakeConnectorProvider();
    const page1 = await provider.listChangedRecords(null);
    expect(page1.records.length).toBeGreaterThan(0);
    expect(page1.hasMore).toBe(true);

    const meta = await provider.fetchRecordMetadata('mail-001');
    expect(meta?.title).toMatch(/PRJ-ALPHA/);

    const content = await provider.fetchRecordContent('mail-001');
    expect(content?.checksumSha256).toBeTruthy();

    const att = await provider.fetchAttachment('mail-001', 'att-1');
    expect(att?.filename).toBe('delay-letter.pdf');
  });

  it('does not auto-enable microsoft/gmail/edms', () => {
    expect(() =>
      createConnectorProvider({ CONNECTOR_PROVIDER: 'microsoft', APP_ENV: 'test' }),
    ).toThrow(/not auto-enabled/);
    expect(() => createConnectorProvider({ CONNECTOR_PROVIDER: 'gmail', APP_ENV: 'test' })).toThrow(
      /not auto-enabled/,
    );
    expect(() => createConnectorProvider({ CONNECTOR_PROVIDER: 'edms', APP_ENV: 'test' })).toThrow(
      /not auto-enabled/,
    );
  });

  it('returns null when connector disabled', () => {
    expect(createConnectorProvider({ CONNECTOR_PROVIDER: 'none' })).toBeNull();
  });

  it('validates webhook signatures and detects replay', async () => {
    const provider = new FakeConnectorProvider();
    const body = Buffer.from(
      JSON.stringify({
        eventId: 'evt-1',
        eventType: 'record.updated',
        occurredAt: '2026-07-29T12:00:00.000Z',
        records: [
          { externalId: 'mail-001', recordType: 'EMAIL', modifiedAt: '2026-07-29T12:00:00.000Z' },
        ],
      }),
    );
    const sig = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    const seen = new Set<string>();

    const first = await provider.validateWebhook!({ 'x-cr-fake-signature': sig }, body, seen);
    expect(first.ok).toBe(true);

    const replay = await provider.validateWebhook!({ 'x-cr-fake-signature': sig }, body, seen);
    expect(replay.ok).toBe(false);
    expect(replay.replayDetected).toBe(true);

    const parsed = await provider.parseWebhook!(body);
    expect(parsed.providerEventId).toBe('evt-1');
    expect(parsed.externalRecordRefs).toHaveLength(1);
  });
});
