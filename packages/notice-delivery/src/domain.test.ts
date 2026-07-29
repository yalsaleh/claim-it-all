import { describe, expect, it } from 'vitest';
import {
  aggregateRecipientStatus,
  assertAuthorizationDispatchable,
  assessDeemedReceipt,
  buildIdempotencyKey,
  classifyRetry,
  computeDeliveryRisk,
  sanitizeDispatchHtml,
  validateAttachmentChecksums,
  validateCoverMessage,
  validateRecipientsForDispatch,
} from './domain';
import {
  FakeNoticeDeliveryProvider,
  assertDeliveryProviderAllowed,
  createNoticeDeliveryProvider,
} from './providers';
import type { AttachmentSnapshot, RecipientSnapshot } from './types';

const recipient = (id: string, required = true): RecipientSnapshot => ({
  preparationId: id,
  displayName: 'Engineer',
  emailAddress: 'e@example.com',
  physicalAddress: null,
  platformAddress: null,
  attentionLine: 'Attn: Engineer',
  method: 'EMAIL',
  copiedRecipient: !required,
  required,
});

describe('cover + recipients + attachments', () => {
  it('rejects header injection and internal content', () => {
    expect(validateCoverMessage({ subject: 'A\nB', plainText: 'hi' }).ok).toBe(false);
    expect(validateCoverMessage({ subject: 'Notice', plainText: '[INTERNAL] x' }).ok).toBe(false);
    const ok = validateCoverMessage({ subject: 'Notice', plainText: 'Please find attached.' });
    expect(ok.ok).toBe(true);
  });

  it('requires verified contact details', () => {
    expect(validateRecipientsForDispatch([]).ok).toBe(false);
    expect(
      validateRecipientsForDispatch([
        { ...recipient('a'), emailAddress: null, physicalAddress: null, platformAddress: null },
      ]).ok,
    ).toBe(false);
    expect(validateRecipientsForDispatch([recipient('a')]).ok).toBe(true);
  });

  it('detects checksum mismatch', () => {
    const expected: AttachmentSnapshot[] = [
      {
        attachmentId: '1',
        filename: 'a.pdf',
        checksumSha256: 'abc',
        sequence: 1,
        mimeType: 'application/pdf',
      },
    ];
    expect(
      validateAttachmentChecksums([{ ...expected[0]!, checksumSha256: 'zzz' }], expected).ok,
    ).toBe(false);
  });

  it('sanitizes html', () => {
    expect(sanitizeDispatchHtml('<p onclick="x">Hi</p><script>alert(1)</script>')).not.toMatch(
      /script|onclick/i,
    );
  });
});

describe('status + retry + risk', () => {
  it('aggregates partial delivery', () => {
    expect(aggregateRecipientStatus(['SENT', 'FAILED'])).toBe('PARTIALLY_DELIVERED');
    expect(aggregateRecipientStatus(['DELIVERED', 'ACKNOWLEDGED'])).toBe('DELIVERED');
  });

  it('classifies retries', () => {
    expect(
      classifyRetry({
        providerAccepted: false,
        providerMessageId: null,
        failureCode: null,
        timedOutAfterSubmit: false,
        checksumMismatch: false,
        authorizationValid: true,
        artifactPresent: true,
      }),
    ).toBe('SAFE_AUTO_BEFORE_SUBMISSION');
    expect(
      classifyRetry({
        providerAccepted: true,
        providerMessageId: 'm1',
        failureCode: null,
        timedOutAfterSubmit: true,
        checksumMismatch: false,
        authorizationValid: true,
        artifactPresent: true,
      }),
    ).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('computes delivery risk', () => {
    const risk = computeDeliveryRisk({
      deadlineAt: new Date(Date.now() + 2 * 3600_000),
      missingVerifiedRecipient: false,
      providerConfigured: true,
      attachmentOverLimit: false,
      requiredRecipientFailed: false,
      receiptUnconfirmed: true,
      authorizationExpired: false,
      manualProofMissing: false,
      dispatchedAfterDeadline: false,
      methodNotPermitted: false,
    });
    expect(risk.level).toBe('HIGH');
    expect(risk.indicators).toContain('DEADLINE_WITHIN_24H');
  });

  it('blocks expired authorization', () => {
    expect(() =>
      assertAuthorizationDispatchable({
        status: 'AUTHORIZED',
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toThrow(/EXPIRED/);
  });

  it('builds stable idempotency keys', () => {
    const a = buildIdempotencyKey({
      authorizationId: 'auth',
      channel: 'CONTROLLED_EMAIL',
      attemptNumber: 1,
      recipientPreparationIds: ['b', 'a'],
    });
    const b = buildIdempotencyKey({
      authorizationId: 'auth',
      channel: 'CONTROLLED_EMAIL',
      attemptNumber: 1,
      recipientPreparationIds: ['a', 'b'],
    });
    expect(a).toBe(b);
  });
});

describe('deemed receipt advisory', () => {
  it('requires human review for postal period', () => {
    const r = assessDeemedReceipt({
      rule: 'POSTAL_PERIOD',
      sentAt: new Date('2026-07-01T10:00:00.000Z'),
      deliveredAt: null,
      postalDays: 3,
    });
    expect(r.advisoryAt).not.toBeNull();
    expect(r.ambiguity).toBe('REQUIRES_HUMAN_REVIEW');
  });
});

describe('providers', () => {
  it('rejects fake provider in production', () => {
    expect(() =>
      assertDeliveryProviderAllowed(new FakeNoticeDeliveryProvider(), 'production'),
    ).toThrow(/Test-only/);
  });

  it('sends via fake provider without network', async () => {
    const provider = new FakeNoticeDeliveryProvider('success');
    const result = await provider.sendMessage({
      snapshotId: 'snap',
      recipients: [recipient('p1')],
      cover: {
        subject: 'Notice',
        plainText: 'Attached',
        htmlSafe: null,
        checksumSha256: 'x',
      },
      artifactChecksum: 'abc',
      attachmentSnapshots: [],
      idempotencyKey: 'idem-1234567890abcdef',
      correlationId: 'corr-1234567890',
    });
    expect(result.outcome).toBe('ACCEPTED');
    expect(result.providerMessageId).toBeTruthy();
  });

  it('does not auto-enable smtp', () => {
    expect(() =>
      createNoticeDeliveryProvider({ NOTICE_DELIVERY_PROVIDER: 'smtp', APP_ENV: 'test' }),
    ).toThrow(/not auto-enabled/);
  });

  it('returns null for deterministic (no send)', () => {
    expect(createNoticeDeliveryProvider({ NOTICE_DELIVERY_PROVIDER: 'deterministic' })).toBeNull();
  });
});
