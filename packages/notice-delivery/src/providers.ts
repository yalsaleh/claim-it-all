import { createHash } from 'node:crypto';
import type { AttachmentSnapshot, CoverMessageSnapshot, RecipientSnapshot } from './types';

export type DeliveryProviderKind = 'fake' | 'local_capture' | 'smtp' | 'api';

export type PrepareMessageInput = {
  snapshotId: string;
  recipients: RecipientSnapshot[];
  cover: CoverMessageSnapshot;
  artifactChecksum: string;
  attachmentSnapshots: AttachmentSnapshot[];
  idempotencyKey: string;
  correlationId: string;
};

export type ProviderRecipientResult = {
  preparationId: string;
  status: 'SUBMITTED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'REJECTED' | 'FAILED' | 'UNKNOWN';
  providerRecipientId?: string | null;
  failureReason?: string | null;
};

export type ProviderSendResult = {
  providerMessageId: string | null;
  providerSubmissionId: string | null;
  acceptedAt: string | null;
  sentAt: string | null;
  recipients: ProviderRecipientResult[];
  retryable: boolean;
  safeMetadata: Record<string, string | number | boolean | null>;
  outcome:
    | 'ACCEPTED'
    | 'REJECTED'
    | 'PARTIAL'
    | 'CONNECTION_FAILURE'
    | 'TIMEOUT_BEFORE_SUBMIT'
    | 'TIMEOUT_AFTER_POSSIBLE_SUBMIT'
    | 'UNKNOWN';
};

export type WebhookParseResult = {
  providerEventId: string;
  providerMessageId: string;
  eventType: string;
  occurredAt: string;
  recipientStatuses: ProviderRecipientResult[];
  redactedPayload: Record<string, unknown>;
};

export interface NoticeDeliveryProvider {
  readonly kind: DeliveryProviderKind;
  readonly testOnly?: boolean;
  validateConfiguration(): Promise<{ ok: boolean; reason?: string }>;
  prepareMessage(input: PrepareMessageInput): Promise<{ prepared: true }>;
  sendMessage(input: PrepareMessageInput): Promise<ProviderSendResult>;
  getDeliveryStatus?(providerMessageId: string): Promise<ProviderSendResult>;
  verifyWebhook?(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{ ok: boolean; reason?: string }>;
  parseWebhookEvent?(rawBody: Buffer): Promise<WebhookParseResult>;
  cancelIfSupported?(providerMessageId: string): Promise<{ cancelled: boolean }>;
}

export class FakeNoticeDeliveryProvider implements NoticeDeliveryProvider {
  readonly kind = 'fake' as const;
  readonly testOnly = true;
  private readonly mode: 'success' | 'reject' | 'partial' | 'timeout_after' | 'connection';

  constructor(mode: FakeNoticeDeliveryProvider['mode'] = 'success') {
    this.mode = mode;
  }

  async validateConfiguration() {
    return { ok: true };
  }

  async prepareMessage() {
    return { prepared: true as const };
  }

  async sendMessage(input: PrepareMessageInput): Promise<ProviderSendResult> {
    if (this.mode === 'connection') {
      return {
        providerMessageId: null,
        providerSubmissionId: null,
        acceptedAt: null,
        sentAt: null,
        recipients: input.recipients.map((r) => ({
          preparationId: r.preparationId,
          status: 'FAILED',
          failureReason: 'CONNECTION_FAILURE',
        })),
        retryable: true,
        safeMetadata: { mode: this.mode },
        outcome: 'CONNECTION_FAILURE',
      };
    }
    if (this.mode === 'timeout_after') {
      return {
        providerMessageId: `fake-maybe-${input.idempotencyKey.slice(0, 12)}`,
        providerSubmissionId: null,
        acceptedAt: new Date().toISOString(),
        sentAt: null,
        recipients: input.recipients.map((r) => ({
          preparationId: r.preparationId,
          status: 'UNKNOWN',
        })),
        retryable: false,
        safeMetadata: { mode: this.mode },
        outcome: 'TIMEOUT_AFTER_POSSIBLE_SUBMIT',
      };
    }
    if (this.mode === 'reject') {
      return {
        providerMessageId: null,
        providerSubmissionId: null,
        acceptedAt: null,
        sentAt: null,
        recipients: input.recipients.map((r) => ({
          preparationId: r.preparationId,
          status: 'REJECTED',
          failureReason: 'PROVIDER_REJECTION',
        })),
        retryable: false,
        safeMetadata: { mode: this.mode },
        outcome: 'REJECTED',
      };
    }
    if (this.mode === 'partial') {
      return {
        providerMessageId: `fake-partial-${input.idempotencyKey.slice(0, 8)}`,
        providerSubmissionId: `sub-${input.correlationId.slice(0, 8)}`,
        acceptedAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        recipients: input.recipients.map((r, i) => ({
          preparationId: r.preparationId,
          status: i === 0 ? 'SENT' : 'FAILED',
          failureReason: i === 0 ? null : 'RECIPIENT_REJECTED',
        })),
        retryable: false,
        safeMetadata: { mode: this.mode },
        outcome: 'PARTIAL',
      };
    }
    return {
      providerMessageId: `fake-${input.idempotencyKey.slice(0, 16)}`,
      providerSubmissionId: `sub-${input.correlationId.slice(0, 12)}`,
      acceptedAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      recipients: input.recipients.map((r) => ({
        preparationId: r.preparationId,
        status: 'SENT',
        providerRecipientId: `rcpt-${r.preparationId.slice(0, 8)}`,
      })),
      retryable: false,
      safeMetadata: { mode: this.mode, artifactChecksum: input.artifactChecksum },
      outcome: 'ACCEPTED',
    };
  }

  async verifyWebhook(headers: Record<string, string>, rawBody: Buffer) {
    const sig = headers['x-cr-fake-signature'] || headers['X-Cr-Fake-Signature'];
    const expected = `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    return { ok: sig === expected, reason: sig === expected ? undefined : 'INVALID_SIGNATURE' };
  }

  async parseWebhookEvent(rawBody: Buffer) {
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      eventId: string;
      messageId: string;
      eventType: string;
      occurredAt: string;
      recipients?: Array<{ preparationId: string; status: string }>;
    };
    return {
      providerEventId: parsed.eventId,
      providerMessageId: parsed.messageId,
      eventType: parsed.eventType,
      occurredAt: parsed.occurredAt,
      recipientStatuses: (parsed.recipients ?? []).map((r) => ({
        preparationId: r.preparationId,
        status: r.status as 'DELIVERED',
      })),
      redactedPayload: {
        eventId: parsed.eventId,
        messageId: parsed.messageId,
        eventType: parsed.eventType,
      },
    };
  }
}

/** Dev capture provider — never opens a network socket. */
export class LocalCaptureNoticeDeliveryProvider implements NoticeDeliveryProvider {
  readonly kind = 'local_capture' as const;
  readonly captures: PrepareMessageInput[] = [];

  async validateConfiguration() {
    return { ok: true };
  }

  async prepareMessage(input: PrepareMessageInput) {
    this.captures.push(input);
    return { prepared: true as const };
  }

  async sendMessage(input: PrepareMessageInput): Promise<ProviderSendResult> {
    this.captures.push(input);
    return {
      providerMessageId: `local-${input.idempotencyKey.slice(0, 16)}`,
      providerSubmissionId: `local-sub-${input.correlationId.slice(0, 8)}`,
      acceptedAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      recipients: input.recipients.map((r) => ({
        preparationId: r.preparationId,
        status: 'SENT',
      })),
      retryable: false,
      safeMetadata: { captured: true },
      outcome: 'ACCEPTED',
    };
  }
}

export function assertDeliveryProviderAllowed(
  provider: NoticeDeliveryProvider,
  appEnv: string | undefined,
): void {
  if (provider.testOnly && (appEnv === 'production' || appEnv === 'staging')) {
    throw new Error('Test-only delivery provider is not allowed in this environment');
  }
}

export function createNoticeDeliveryProvider(env: {
  NOTICE_DELIVERY_PROVIDER?: string;
  APP_ENV?: string;
}): NoticeDeliveryProvider | null {
  const kind = (env.NOTICE_DELIVERY_PROVIDER || 'deterministic').toLowerCase();
  if (kind === 'deterministic' || kind === 'none' || kind === '') return null;
  if (kind === 'fake') {
    const provider = new FakeNoticeDeliveryProvider('success');
    assertDeliveryProviderAllowed(provider, env.APP_ENV);
    return provider;
  }
  if (kind === 'local_capture' || kind === 'local') {
    return new LocalCaptureNoticeDeliveryProvider();
  }
  if (kind === 'smtp' || kind === 'api') {
    // Interface reserved — no live credentials required for Slice 7 CI.
    throw new Error(`Provider ${kind} requires approved configuration and is not auto-enabled`);
  }
  throw new Error(`Unknown NOTICE_DELIVERY_PROVIDER: ${kind}`);
}
