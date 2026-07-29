export const NOTICE_DELIVERY_RULESET_VERSION = 'notice-delivery-ruleset-v1';

export const DISPATCH_CHANNELS = [
  'MANUAL_COURIER',
  'MANUAL_HAND_DELIVERY',
  'MANUAL_REGISTERED_POST',
  'MANUAL_EMAIL',
  'MANUAL_EDMS',
  'MANUAL_LETTER',
  'CONTROLLED_EMAIL',
  'FUTURE_ACONEX',
  'FUTURE_ASITE',
  'FUTURE_PROCORE',
  'FUTURE_ACC',
  'FUTURE_SHAREPOINT',
  'FUTURE_EDMS',
  'FUTURE_PORTAL',
] as const;
export type DispatchChannel = (typeof DISPATCH_CHANNELS)[number];

export const OPERATIONAL_CHANNELS: DispatchChannel[] = [
  'MANUAL_COURIER',
  'MANUAL_HAND_DELIVERY',
  'MANUAL_REGISTERED_POST',
  'MANUAL_EMAIL',
  'MANUAL_EDMS',
  'MANUAL_LETTER',
  'CONTROLLED_EMAIL',
];

export const AUTHORIZATION_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'UNDER_REVIEW',
  'AUTHORIZED',
  'REJECTED',
  'EXPIRED',
  'REVOKED',
  'USED',
  'CANCELLED',
] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export const ATTEMPT_STATUSES = [
  'PREPARED',
  'QUEUED',
  'SENDING',
  'SUBMITTED',
  'SENT',
  'DELIVERY_PENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_DELIVERED',
  'MANUAL_DISPATCH_RECORDED',
  'AWAITING_EVIDENCE',
  'UNCERTAIN_MANUAL_REVIEW',
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const RECIPIENT_STATUSES = [
  'PENDING',
  'SUBMITTED',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'REJECTED',
  'FAILED',
  'ACKNOWLEDGED',
  'UNKNOWN',
  'MANUALLY_CONFIRMED',
] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export const RECEIPT_STATUSES = [
  'UNKNOWN',
  'PROVIDER_ACCEPTED',
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'BOUNCED',
  'REFUSED',
  'DISPUTED',
  'MANUALLY_CONFIRMED',
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const CONTRACTUAL_SERVICE_STATUSES = [
  'NOT_ASSESSED',
  'EVIDENCE_INCOMPLETE',
  'POTENTIALLY_SATISFIED',
  'REVIEW_REQUIRED',
  'HUMAN_CONFIRMED',
  'DISPUTED',
] as const;
export type ContractualServiceStatus = (typeof CONTRACTUAL_SERVICE_STATUSES)[number];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RETRY_CLASSES = [
  'SAFE_AUTO_BEFORE_SUBMISSION',
  'MANUAL_REVIEW_REQUIRED',
  'TERMINAL',
] as const;
export type RetryClass = (typeof RETRY_CLASSES)[number];

export type RecipientSnapshot = {
  preparationId: string;
  displayName: string;
  emailAddress: string | null;
  physicalAddress: string | null;
  platformAddress: string | null;
  attentionLine: string | null;
  method: string;
  copiedRecipient: boolean;
  required: boolean;
};

export type AttachmentSnapshot = {
  attachmentId: string;
  filename: string;
  checksumSha256: string;
  sequence: number;
  mimeType: string | null;
};

export type CoverMessageSnapshot = {
  subject: string;
  plainText: string;
  htmlSafe: string | null;
  checksumSha256: string;
};
