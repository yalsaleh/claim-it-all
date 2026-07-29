import { createHash } from 'node:crypto';
import type {
  AttachmentSnapshot,
  AttemptStatus,
  CoverMessageSnapshot,
  DispatchChannel,
  RecipientSnapshot,
  RecipientStatus,
  RetryClass,
  RiskLevel,
} from './types';
import { OPERATIONAL_CHANNELS } from './types';

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function isOperationalChannel(channel: string): channel is DispatchChannel {
  return (OPERATIONAL_CHANNELS as string[]).includes(channel);
}

export function isFutureChannel(channel: string): boolean {
  return channel.startsWith('FUTURE_');
}

/** Aggregate attempt status from recipient-level outcomes. Never hides failures. */
export function aggregateRecipientStatus(statuses: RecipientStatus[]): AttemptStatus {
  if (statuses.length === 0) return 'FAILED';
  const set = new Set(statuses);
  if (
    [...set].every((s) => s === 'DELIVERED' || s === 'ACKNOWLEDGED' || s === 'MANUALLY_CONFIRMED')
  ) {
    return 'DELIVERED';
  }
  if (
    [...set].every(
      (s) =>
        s === 'SENT' || s === 'DELIVERED' || s === 'ACKNOWLEDGED' || s === 'MANUALLY_CONFIRMED',
    )
  ) {
    return 'SENT';
  }
  if ([...set].every((s) => s === 'FAILED' || s === 'BOUNCED' || s === 'REJECTED')) {
    return 'FAILED';
  }
  if (
    statuses.some(
      (s) =>
        s === 'DELIVERED' || s === 'SENT' || s === 'ACKNOWLEDGED' || s === 'MANUALLY_CONFIRMED',
    ) &&
    statuses.some(
      (s) =>
        s === 'FAILED' || s === 'BOUNCED' || s === 'REJECTED' || s === 'PENDING' || s === 'UNKNOWN',
    )
  ) {
    return 'PARTIALLY_DELIVERED';
  }
  if (statuses.every((s) => s === 'SUBMITTED')) return 'SUBMITTED';
  if (statuses.every((s) => s === 'PENDING')) return 'PREPARED';
  return 'DELIVERY_PENDING';
}

export function buildIdempotencyKey(input: {
  authorizationId: string;
  channel: string;
  attemptNumber: number;
  recipientPreparationIds: string[];
}): string {
  const recipients = [...input.recipientPreparationIds].sort().join(',');
  return sha256Hex(
    `${input.authorizationId}|${input.channel}|${input.attemptNumber}|${recipients}`,
  );
}

export function classifyRetry(input: {
  providerAccepted: boolean;
  providerMessageId: string | null;
  failureCode: string | null;
  timedOutAfterSubmit: boolean;
  checksumMismatch: boolean;
  authorizationValid: boolean;
  artifactPresent: boolean;
}): RetryClass {
  if (!input.authorizationValid || !input.artifactPresent || input.checksumMismatch) {
    return 'TERMINAL';
  }
  if (input.timedOutAfterSubmit || (input.providerAccepted && input.providerMessageId)) {
    return 'MANUAL_REVIEW_REQUIRED';
  }
  if (
    input.failureCode &&
    [
      'INVALID_RECIPIENT',
      'UNAUTHORIZED_PROVIDER',
      'UNSUPPORTED_ATTACHMENT',
      'PROVIDER_REJECTION',
      'REVOKED',
    ].includes(input.failureCode)
  ) {
    return 'TERMINAL';
  }
  if (!input.providerAccepted && !input.providerMessageId) {
    return 'SAFE_AUTO_BEFORE_SUBMISSION';
  }
  return 'MANUAL_REVIEW_REQUIRED';
}

export function sanitizeDispatchHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
}

export function validateCoverMessage(input: {
  subject: string;
  plainText: string;
  htmlSafe?: string | null;
}): { ok: true; snapshot: CoverMessageSnapshot } | { ok: false; reason: string } {
  const subject = input.subject.trim();
  const plainText = input.plainText.trim();
  if (!subject) return { ok: false, reason: 'SUBJECT_REQUIRED' };
  if (subject.length > 500) return { ok: false, reason: 'SUBJECT_TOO_LONG' };
  if (/[\r\n]/.test(subject)) return { ok: false, reason: 'SUBJECT_HEADER_INJECTION' };
  if (!plainText) return { ok: false, reason: 'BODY_REQUIRED' };
  if (/\[INTERNAL\]/i.test(plainText) || /confidence/i.test(plainText)) {
    return { ok: false, reason: 'INTERNAL_CONTENT_FORBIDDEN' };
  }
  const htmlSafe = input.htmlSafe ? sanitizeDispatchHtml(input.htmlSafe) : null;
  return {
    ok: true,
    snapshot: {
      subject,
      plainText,
      htmlSafe,
      checksumSha256: sha256Hex(`${subject}\n${plainText}\n${htmlSafe ?? ''}`),
    },
  };
}

export function validateRecipientsForDispatch(
  recipients: RecipientSnapshot[],
): { ok: true } | { ok: false; reason: string } {
  if (recipients.length === 0) return { ok: false, reason: 'NO_RECIPIENTS' };
  const required = recipients.filter((r) => r.required);
  if (required.length === 0) return { ok: false, reason: 'NO_REQUIRED_RECIPIENT' };
  for (const r of required) {
    if (!r.displayName.trim()) return { ok: false, reason: 'MISSING_DISPLAY_NAME' };
    if (!r.emailAddress && !r.physicalAddress && !r.platformAddress) {
      return { ok: false, reason: 'MISSING_CONTACT' };
    }
    if (!r.method) return { ok: false, reason: 'MISSING_METHOD' };
  }
  return { ok: true };
}

export function validateAttachmentChecksums(
  attachments: AttachmentSnapshot[],
  expected: AttachmentSnapshot[],
): { ok: true } | { ok: false; reason: string } {
  if (attachments.length !== expected.length)
    return { ok: false, reason: 'ATTACHMENT_COUNT_MISMATCH' };
  const byId = new Map(attachments.map((a) => [a.attachmentId, a]));
  for (const e of expected) {
    const a = byId.get(e.attachmentId);
    if (!a) return { ok: false, reason: 'ATTACHMENT_MISSING' };
    if (a.checksumSha256 !== e.checksumSha256)
      return { ok: false, reason: 'ATTACHMENT_CHECKSUM_MISMATCH' };
    if (a.filename !== e.filename) return { ok: false, reason: 'ATTACHMENT_FILENAME_MISMATCH' };
  }
  return { ok: true };
}

export function computeDeliveryRisk(input: {
  deadlineAt: Date | null;
  now?: Date;
  missingVerifiedRecipient: boolean;
  providerConfigured: boolean;
  attachmentOverLimit: boolean;
  requiredRecipientFailed: boolean;
  receiptUnconfirmed: boolean;
  authorizationExpired: boolean;
  manualProofMissing: boolean;
  dispatchedAfterDeadline: boolean;
  methodNotPermitted: boolean;
}): { level: RiskLevel; indicators: string[] } {
  const now = input.now ?? new Date();
  const indicators: string[] = [];
  let level: RiskLevel = 'LOW';

  const bump = (next: RiskLevel, code: string) => {
    indicators.push(code);
    const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'];
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };

  if (input.missingVerifiedRecipient) bump('CRITICAL', 'MISSING_VERIFIED_RECIPIENT');
  if (input.authorizationExpired) bump('CRITICAL', 'AUTHORIZATION_EXPIRED');
  if (input.methodNotPermitted) bump('HIGH', 'METHOD_NOT_PERMITTED');
  if (input.attachmentOverLimit) bump('HIGH', 'ATTACHMENT_OVER_LIMIT');
  if (!input.providerConfigured) bump('HIGH', 'PROVIDER_UNAVAILABLE');
  if (input.requiredRecipientFailed) bump('HIGH', 'REQUIRED_RECIPIENT_FAILED');
  if (input.manualProofMissing) bump('MEDIUM', 'MANUAL_PROOF_MISSING');
  if (input.receiptUnconfirmed) bump('MEDIUM', 'RECEIPT_UNCONFIRMED');
  if (input.dispatchedAfterDeadline) bump('CRITICAL', 'DISPATCHED_AFTER_DEADLINE');
  if (input.deadlineAt) {
    const hours = (input.deadlineAt.getTime() - now.getTime()) / 3_600_000;
    if (hours < 0) bump('CRITICAL', 'DEADLINE_PASSED');
    else if (hours <= 24) bump('HIGH', 'DEADLINE_WITHIN_24H');
  }
  return { level, indicators };
}

/** Advisory only — never definitive without human review. */
export function assessDeemedReceipt(input: {
  rule:
    | 'ACTUAL_DELIVERY'
    | 'ON_TRANSMISSION'
    | 'NEXT_WORKING_DAY'
    | 'POSTAL_PERIOD'
    | 'PLATFORM_SUBMISSION'
    | 'NONE';
  sentAt: Date | null;
  deliveredAt: Date | null;
  postalDays?: number;
  isWorkingDay?: (d: Date) => boolean;
}): {
  advisoryAt: Date | null;
  ambiguity: string | null;
  trace: string[];
} {
  const trace: string[] = [`rule=${input.rule}`];
  if (input.rule === 'NONE') {
    return { advisoryAt: null, ambiguity: 'NO_DEEMED_RULE', trace };
  }
  if (input.rule === 'ACTUAL_DELIVERY') {
    if (!input.deliveredAt) return { advisoryAt: null, ambiguity: 'DELIVERY_TIME_UNKNOWN', trace };
    trace.push(`deliveredAt=${input.deliveredAt.toISOString()}`);
    return { advisoryAt: input.deliveredAt, ambiguity: null, trace };
  }
  if (input.rule === 'ON_TRANSMISSION' || input.rule === 'PLATFORM_SUBMISSION') {
    if (!input.sentAt) return { advisoryAt: null, ambiguity: 'SENT_TIME_UNKNOWN', trace };
    trace.push(`sentAt=${input.sentAt.toISOString()}`);
    return { advisoryAt: input.sentAt, ambiguity: null, trace };
  }
  if (input.rule === 'NEXT_WORKING_DAY') {
    if (!input.sentAt) return { advisoryAt: null, ambiguity: 'SENT_TIME_UNKNOWN', trace };
    const isWorking = input.isWorkingDay ?? ((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6);
    let cursor = new Date(input.sentAt.getTime() + 24 * 3600 * 1000);
    let guard = 0;
    while (!isWorking(cursor) && guard < 14) {
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
      guard += 1;
    }
    if (guard >= 14) return { advisoryAt: null, ambiguity: 'WORKING_DAY_LOOKUP_FAILED', trace };
    trace.push(`nextWorkingDay=${cursor.toISOString()}`);
    return { advisoryAt: cursor, ambiguity: 'REQUIRES_HUMAN_REVIEW', trace };
  }
  if (input.rule === 'POSTAL_PERIOD') {
    if (!input.sentAt) return { advisoryAt: null, ambiguity: 'SENT_TIME_UNKNOWN', trace };
    const days = input.postalDays ?? 3;
    const advisoryAt = new Date(input.sentAt.getTime() + days * 24 * 3600 * 1000);
    trace.push(`postalDays=${days}`, `advisoryAt=${advisoryAt.toISOString()}`);
    return { advisoryAt, ambiguity: 'REQUIRES_HUMAN_REVIEW', trace };
  }
  return { advisoryAt: null, ambiguity: 'UNKNOWN_RULE', trace };
}

export function assertAuthorizationDispatchable(input: {
  status: string;
  expiresAt: Date | null;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  if (input.status !== 'AUTHORIZED') {
    throw new Error(`AUTHORIZATION_NOT_DISPATCHABLE:${input.status}`);
  }
  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) {
    throw new Error('AUTHORIZATION_EXPIRED');
  }
}

export function buildDispatchSnapshotChecksum(parts: {
  noticeChecksum: string;
  bundleChecksum: string;
  attachmentManifestChecksum: string;
  recipientSnapshotJson: string;
  coverChecksum: string;
  channel: string;
}): string {
  return sha256Hex(
    [
      parts.noticeChecksum,
      parts.bundleChecksum,
      parts.attachmentManifestChecksum,
      sha256Hex(parts.recipientSnapshotJson),
      parts.coverChecksum,
      parts.channel,
    ].join('|'),
  );
}
