import {
  type AiDraftResponse,
  validateAiDraftOutput,
  type AiValidationInput,
  type AiValidationResult,
} from '@contractradar/notice-drafting';
import { NOTICE_SECTION_TYPES } from '@contractradar/notice-drafting';

/**
 * Provider-neutral notice drafting AI adapter (ADR-066).
 * Fake providers are test-only and rejected in production-like environments.
 */

export type NoticeDraftAiInput = {
  language: 'en' | 'ar';
  noticeType: string;
  title: string;
  approvedFacts: Array<{
    id: string;
    factType: string;
    label: string;
    value: string;
  }>;
  approvedDeadlineIso: string | null;
  promptSchemaVersion: string;
};

export type NoticeDraftAiProvider = {
  readonly name: string;
  readonly testOnly: boolean;
  draftNotice(input: NoticeDraftAiInput): Promise<AiDraftResponse>;
};

export class FakeNoticeDraftAiProvider implements NoticeDraftAiProvider {
  readonly name = 'fake';
  readonly testOnly = true;

  async draftNotice(input: NoticeDraftAiInput): Promise<AiDraftResponse> {
    const factIds = input.approvedFacts.map((f) => f.id);
    const byType = new Map(input.approvedFacts.map((f) => [f.factType, f]));
    const sections = NOTICE_SECTION_TYPES.filter((t) => t !== 'CLOSING').map((sectionType) => {
      let draftedText = '';
      const sourceFactIds: string[] = [];
      if (sectionType === 'EVENT_DESCRIPTION' && byType.has('DESCRIPTION_OF_EVENT')) {
        const f = byType.get('DESCRIPTION_OF_EVENT')!;
        draftedText = f.value;
        sourceFactIds.push(f.id);
      } else if (sectionType === 'TRIGGER_DATE' && byType.has('EVENT_DATE')) {
        const f = byType.get('EVENT_DATE')!;
        draftedText = f.value;
        sourceFactIds.push(f.id);
      } else if (sectionType === 'DEADLINE_STATEMENT' && input.approvedDeadlineIso) {
        draftedText = input.approvedDeadlineIso;
      } else if (sectionType === 'PROJECT_CONTRACT_REFERENCE' && byType.has('PROJECT_NAME')) {
        const f = byType.get('PROJECT_NAME')!;
        draftedText = f.value;
        sourceFactIds.push(f.id);
      } else if (sectionType === 'NOTICE_TITLE') {
        draftedText = input.title;
      } else {
        const related = input.approvedFacts.find((f) =>
          sectionType.includes('FACT') ? f.factType.startsWith('DESCRIPTION') : false,
        );
        if (related) {
          draftedText = related.value;
          sourceFactIds.push(related.id);
        }
      }
      if (!draftedText.trim()) {
        draftedText = `[${sectionType}] — no approved fact available (test-only stub)`;
      }
      return {
        sectionType,
        draftedText,
        sourceFactIds,
        sourceEvidenceIds: [],
        sourceClauseIds: [],
        warnings: factIds.length === 0 ? ['NO_APPROVED_FACTS'] : [],
        unsupportedContentFlags: [],
      };
    });
    return {
      language: input.language,
      sections: sections.filter((s) => s.draftedText.length > 0),
      overallWarnings: ['Test-only AI draft — human review required'],
    };
  }
}

export function assertNoticeAiProviderAllowed(provider: NoticeDraftAiProvider): void {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const productionLike = appEnv === 'production' || appEnv === 'staging';
  if (productionLike && provider.testOnly) {
    throw new Error(
      `Notice draft AI provider "${provider.name}" is test-only and cannot run in ${appEnv}`,
    );
  }
}

export function createNoticeDraftAiProvider(): NoticeDraftAiProvider | null {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const configured = process.env.NOTICE_DRAFT_AI_PROVIDER?.trim();
  const isTest = appEnv === 'test' || process.env.NODE_ENV === 'test';

  if (!configured || configured === 'none' || configured === 'deterministic') {
    return null;
  }
  if (configured === 'fake') {
    if (!isTest) {
      throw new Error(
        `Notice draft AI provider "fake" is only available when APP_ENV=test or NODE_ENV=test (current: ${appEnv})`,
      );
    }
    const provider = new FakeNoticeDraftAiProvider();
    assertNoticeAiProviderAllowed(provider);
    return provider;
  }
  throw new Error(
    `Unknown NOTICE_DRAFT_AI_PROVIDER "${configured}" — no hardcoded commercial provider`,
  );
}

export function validateNoticeAiDraftOutput(input: AiValidationInput): AiValidationResult {
  return validateAiDraftOutput(input);
}
