import { describe, expect, it } from 'vitest';
import { assembleDeterministicDraft, renderPlainText } from './drafting';
import { validateAiDraftOutput } from './ai-schema';
import { assessEvidenceCompleteness } from './evidence';
import { buildAttachmentZip, exportApprovedNotice, sha256Hex } from './export';
import { isNonWaivableException, validateNoticeDraft } from './validation';
import type { DraftContext } from './types';

function baseCtx(overrides?: Partial<DraftContext>): DraftContext {
  return {
    language: 'en',
    noticeType: 'INITIAL_NOTICE',
    title: 'Notice of late drawing',
    projectName: 'Demo Tower',
    projectCode: 'DT-1',
    contractReference: 'CONTRACT-001',
    eventTitle: 'Late IFC drawings',
    eventDescription: 'IFC drawings for Level 12 were issued late.',
    facts: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        factType: 'EVENT_DATE',
        label: 'Event date',
        value: '2026-07-01',
        approvedForDrafting: true,
        verificationStatus: 'HUMAN_CONFIRMED',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        factType: 'DESCRIPTION_OF_EVENT',
        label: 'Description',
        value: 'Late issue of IFC drawings for Level 12.',
        approvedForDrafting: true,
        verificationStatus: 'EVIDENCE_BACKED',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        factType: 'PARTY_NAME',
        label: 'Sender',
        value: 'Demo Contractor LLC',
        approvedForDrafting: true,
        verificationStatus: 'HUMAN_CONFIRMED',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        factType: 'REQUESTED_ACTION',
        label: 'Action',
        value: 'Please acknowledge receipt.',
        approvedForDrafting: true,
        verificationStatus: 'HUMAN_CONFIRMED',
      },
    ],
    requirement: {
      id: 'req-1',
      sourceClauseId: '55555555-5555-5555-5555-555555555555',
      sourceClauseReference: 'Clause 20.1',
      contentRequirements: 'Describe event and reserve rights',
      consequenceText: 'Time-bar risk',
      reservationLanguage: 'All rights reserved.',
      requiredDeliveryMethods: 'EMAIL',
      requiredRecipients: 'Engineer',
      verifiedDeadlineAt: '2026-07-08T17:00:00.000Z',
      verifiedDeadlineTimezone: 'Asia/Dubai',
      timeBarClassification: 'STRICT',
      continuingEventRequirements: null,
      interimParticularsRequirements: null,
      finalParticularsRequirements: null,
    },
    recipients: [
      {
        id: 'rec-1',
        recipientLabel: 'The Engineer',
        selectedMethod: 'EMAIL',
        permittedMethod: 'EMAIL',
        emailAddress: 'engineer@example.com',
        physicalAddress: null,
        verificationStatus: 'VERIFIED',
        copiedRecipient: false,
      },
    ],
    attachments: [
      {
        id: 'att-1',
        externalFilename: 'drawing-transmittal.pdf',
        description: 'Transmittal',
        inclusionStatus: 'INCLUDED',
        checksum: 'abc',
      },
    ],
    templateVersion: 'synthetic-notice-template-v1',
    ...overrides,
  };
}

describe('deterministic drafting', () => {
  it('assembles core sections with provenance and excludes internal from plain export', () => {
    const draft = assembleDeterministicDraft(baseCtx());
    expect(draft.sections.some((s) => s.sectionType === 'DEADLINE_STATEMENT')).toBe(true);
    expect(draft.sections.some((s) => s.sectionType === 'CONTRACTUAL_BASIS')).toBe(true);
    const external = renderPlainText(draft.sections);
    expect(external).toContain('Clause 20.1');
    expect(external).toContain('2026-07-08');
    expect(external).not.toMatch(/\[INTERNAL\]/);
    expect(draft.sections.some((s) => s.internalOnly)).toBe(true);
  });

  it('assembles Arabic headings', () => {
    const draft = assembleDeterministicDraft(baseCtx({ language: 'ar' }));
    expect(draft.sections.find((s) => s.sectionType === 'NOTICE_TITLE')?.heading).toBe('إشعار');
  });

  it('does not use unapproved facts', () => {
    const draft = assembleDeterministicDraft(
      baseCtx({
        facts: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            factType: 'EVENT_DATE',
            label: 'Event date',
            value: '2099-01-01',
            approvedForDrafting: false,
            verificationStatus: 'UNVERIFIED',
          },
        ],
      }),
    );
    const trigger = draft.sections.find((s) => s.sectionType === 'TRIGGER_DATE');
    expect(trigger?.body).not.toContain('2099-01-01');
    expect(trigger?.warnings).toContain('MISSING_EVENT_DATE_FACT');
  });
});

describe('evidence completeness', () => {
  it('blocks missing contractual evidence and keeps waiver contractual', () => {
    const blocked = assessEvidenceCompleteness(
      [
        {
          category: 'TRIGGER_DATE',
          mandatoryStatus: 'CONTRACTUALLY_REQUIRED',
          satisfactionStatus: 'MISSING',
        },
      ],
      { assessed: true },
    );
    expect(blocked.status).toBe('BLOCKED');

    const waived = assessEvidenceCompleteness(
      [
        {
          category: 'COST_IMPACT',
          mandatoryStatus: 'CONTRACTUALLY_REQUIRED',
          satisfactionStatus: 'WAIVED_BY_REVIEWER',
          waiverReason: 'Initial notice only',
        },
      ],
      { assessed: true },
    );
    expect(waived.status).toBe('CONDITIONALLY_READY');
    expect(waived.warnings.some((w) => w.includes('WAIVED_STILL_CONTRACTUAL'))).toBe(true);
  });
});

describe('validation', () => {
  it('blocks stale calculation and unverified recipients', () => {
    const result = validateNoticeDraft({
      contractPackageId: 'a',
      expectedContractPackageId: 'a',
      configurationRevisionId: 'b',
      expectedConfigurationRevisionId: 'b',
      approvedRuleSnapshotId: 'c',
      expectedApprovedRuleSnapshotId: 'c',
      projectEventId: 'd',
      expectedProjectEventId: 'd',
      calculationStatus: 'VERIFIED',
      calculationId: 'e',
      expectedCalculationId: 'e',
      hasVerifiedTriggerDate: true,
      hasVerifiedDeadline: true,
      clauseReferencePresent: true,
      language: 'en',
      recipients: [
        {
          verificationStatus: 'UNVERIFIED',
          copiedRecipient: false,
          hasContact: false,
          selectedMethod: null,
          permittedMethod: 'EMAIL',
        },
      ],
      openBlockingQuestions: 0,
      completenessStatus: 'READY',
      unapprovedFactsInDraft: 0,
      hasInternalOnlyInExportCandidate: false,
      controlledExceptionsForBlockers: 0,
      nonWaivableBlockers: [],
      staleEvidenceAssessment: false,
      supersededCalculation: true,
      reservationPresent: true,
      reservationRequired: true,
      attachmentMissingRequired: false,
    });
    expect(result.ok).toBe(false);
    expect(result.blocking.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        'STALE_CALCULATION',
        'UNVERIFIED_RECIPIENT',
        'MISSING_CONTACT_POINT',
      ]),
    );
  });

  it('recognizes non-waivable exceptions', () => {
    expect(isNonWaivableException('INVENTED_RECIPIENT')).toBe(true);
    expect(isNonWaivableException('MISSING_EMAIL')).toBe(false);
  });
});

describe('AI output validation', () => {
  it('accepts valid structured sections and rejects invented clause/date/deadline', () => {
    const factId = '11111111-1111-1111-1111-111111111111';
    const clauseId = '55555555-5555-5555-5555-555555555555';
    const ok = validateAiDraftOutput({
      response: {
        language: 'en',
        sections: [
          {
            sectionType: 'EVENT_DESCRIPTION',
            draftedText: 'Late drawings issued on 2026-07-01.',
            sourceFactIds: [factId],
            sourceEvidenceIds: [],
            sourceClauseIds: [clauseId],
            warnings: [],
            unsupportedContentFlags: [],
          },
        ],
        overallWarnings: [],
      },
      allowedFactIds: new Set([factId]),
      allowedEvidenceIds: new Set(),
      allowedClauseIds: new Set([clauseId]),
      approvedDeadlineIso: '2026-07-08T17:00:00.000Z',
      approvedFactValuesByType: new Map([['EVENT_DATE', '2026-07-01']]),
    });
    expect(ok.ok).toBe(true);

    const bad = validateAiDraftOutput({
      response: {
        language: 'en',
        sections: [
          {
            sectionType: 'DEADLINE_STATEMENT',
            draftedText: 'Deadline is 2026-07-09.',
            sourceFactIds: [factId],
            sourceEvidenceIds: [],
            sourceClauseIds: ['99999999-9999-9999-9999-999999999999'],
            warnings: [],
            unsupportedContentFlags: [],
          },
        ],
      },
      allowedFactIds: new Set([factId]),
      allowedEvidenceIds: new Set(),
      allowedClauseIds: new Set([clauseId]),
      approvedDeadlineIso: '2026-07-08T17:00:00.000Z',
      approvedFactValuesByType: new Map([['EVENT_DATE', '2026-07-01']]),
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(
        bad.errors.some((e) => e.startsWith('UNKNOWN_CLAUSE') || e.startsWith('DEADLINE_MISMATCH')),
      ).toBe(true);
    }
  });

  it('rejects internal comments and malformed JSON shape', () => {
    const factId = '11111111-1111-1111-1111-111111111111';
    const internal = validateAiDraftOutput({
      response: {
        language: 'en',
        sections: [
          {
            sectionType: 'CLOSING',
            draftedText: '[INTERNAL] hide this',
            sourceFactIds: [factId],
            sourceEvidenceIds: [],
            sourceClauseIds: [],
          },
        ],
      },
      allowedFactIds: new Set([factId]),
      allowedEvidenceIds: new Set(),
      allowedClauseIds: new Set(),
      approvedDeadlineIso: null,
      approvedFactValuesByType: new Map(),
    });
    expect(internal.ok).toBe(false);

    const malformed = validateAiDraftOutput({
      response: { nope: true },
      allowedFactIds: new Set(),
      allowedEvidenceIds: new Set(),
      allowedClauseIds: new Set(),
      approvedDeadlineIso: null,
      approvedFactValuesByType: new Map(),
    });
    expect(malformed.ok).toBe(false);
  });
});

describe('export', () => {
  it('exports pdf/docx/manifest/zip without internal comments and rejects traversal', () => {
    const draft = assembleDeterministicDraft(baseCtx());
    const exported = exportApprovedNotice({
      title: 'Notice',
      sections: draft.sections,
      noticePackageId: 'pkg',
      draftRevisionId: 'rev',
      revisionNumber: 2,
      language: 'en',
      generatorVersion: draft.generatorVersion,
      attachments: [
        {
          id: 'a1',
          filename: 'evidence.txt',
          content: Buffer.from('hello'),
          checksumSha256: sha256Hex('hello'),
          sequence: 1,
        },
      ],
    });
    expect(exported.manifest.deliveryAuthorized).toBe(false);
    expect(exported.manifest.excludesInternalComments).toBe(true);
    expect(exported.plainText).not.toMatch(/\[INTERNAL\]/);
    expect(exported.pdf.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(exported.docx.length).toBeGreaterThan(100);
    expect(exported.zip.length).toBeGreaterThan(100);
    expect(() =>
      buildAttachmentZip([{ filename: '../evil.txt', content: Buffer.from('x') }]),
    ).toThrow(/PATH_TRAVERSAL/);
  });
});
