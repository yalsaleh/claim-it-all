/** Shared types for deterministic notice drafting (Slice 6). */

export const NOTICE_DRAFTING_RULESET_VERSION = 'notice-drafting-ruleset-v1';
export const NOTICE_VALIDATION_RULESET_VERSION = 'notice-validation-ruleset-v1';
export const NOTICE_TEMPLATE_VERSION = 'synthetic-notice-template-v1';
export const NOTICE_GENERATOR_VERSION = 'deterministic-assembler-v1';

export const NOTICE_SECTION_TYPES = [
  'SENDER',
  'RECIPIENT',
  'PROJECT_CONTRACT_REFERENCE',
  'NOTICE_TITLE',
  'CONTRACTUAL_BASIS',
  'FACTUAL_BACKGROUND',
  'EVENT_DESCRIPTION',
  'TRIGGER_DATE',
  'DEADLINE_STATEMENT',
  'IMPACT_STATEMENT',
  'RESERVATION_OF_RIGHTS',
  'REQUESTED_ACTION',
  'RECORDS_EVIDENCE',
  'CONTINUING_EVENT',
  'ATTACHMENTS',
  'CLOSING',
] as const;

export type NoticeSectionType = (typeof NOTICE_SECTION_TYPES)[number];

export type NoticeFactInput = {
  id: string;
  factType: string;
  label: string;
  value: string;
  approvedForDrafting: boolean;
  verificationStatus: string;
};

export type RequirementSnapshotInput = {
  id: string;
  sourceClauseId: string | null;
  sourceClauseReference: string | null;
  contentRequirements: string | null;
  consequenceText: string | null;
  reservationLanguage: string | null;
  requiredDeliveryMethods: string | null;
  requiredRecipients: string | null;
  verifiedDeadlineAt: string | null;
  verifiedDeadlineTimezone: string | null;
  timeBarClassification: string | null;
  continuingEventRequirements: string | null;
  interimParticularsRequirements: string | null;
  finalParticularsRequirements: string | null;
};

export type DeliveryPreparationInput = {
  id: string;
  recipientLabel: string;
  selectedMethod: string | null;
  permittedMethod: string | null;
  emailAddress: string | null;
  physicalAddress: string | null;
  verificationStatus: string;
  copiedRecipient: boolean;
};

export type AttachmentInput = {
  id: string;
  externalFilename: string;
  description: string | null;
  inclusionStatus: string;
  checksum: string | null;
};

export type DraftContext = {
  language: 'en' | 'ar';
  noticeType: string;
  title: string;
  projectName: string;
  projectCode: string;
  contractReference: string;
  eventTitle: string;
  eventDescription: string | null;
  facts: NoticeFactInput[];
  requirement: RequirementSnapshotInput;
  recipients: DeliveryPreparationInput[];
  attachments: AttachmentInput[];
  templateVersion: string;
};

export type AssembledSection = {
  sectionType: NoticeSectionType;
  sequence: number;
  heading: string;
  body: string;
  language: string;
  sourceFactIds: string[];
  sourceEvidenceIds: string[];
  sourceClauseIds: string[];
  machineGenerated: boolean;
  humanEdited: boolean;
  internalOnly: boolean;
  warnings: string[];
};

export type ValidationIssue = {
  code: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
  field?: string;
};

export type ValidationResult = {
  rulesetVersion: string;
  ok: boolean;
  blocking: ValidationIssue[];
  warnings: ValidationIssue[];
  notes: ValidationIssue[];
};
