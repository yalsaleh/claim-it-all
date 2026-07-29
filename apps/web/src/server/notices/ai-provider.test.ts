import { afterEach, describe, expect, it } from 'vitest';
import {
  FakeNoticeDraftAiProvider,
  assertNoticeAiProviderAllowed,
  createNoticeDraftAiProvider,
  validateNoticeAiDraftOutput,
} from './ai-provider';

describe('notice draft AI provider boundary', () => {
  const prevProvider = process.env.NOTICE_DRAFT_AI_PROVIDER;
  const prevAppEnv = process.env.APP_ENV;

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.NOTICE_DRAFT_AI_PROVIDER;
    else process.env.NOTICE_DRAFT_AI_PROVIDER = prevProvider;
    if (prevAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevAppEnv;
  });

  it('returns null when provider is unset or deterministic', () => {
    process.env.NOTICE_DRAFT_AI_PROVIDER = 'deterministic';
    process.env.APP_ENV = 'test';
    expect(createNoticeDraftAiProvider()).toBeNull();
  });

  it('rejects fake provider when APP_ENV=production', () => {
    process.env.APP_ENV = 'production';
    process.env.NOTICE_DRAFT_AI_PROVIDER = 'fake';
    expect(() => createNoticeDraftAiProvider()).toThrow(/test|fake/i);
  });

  it('allows fake provider in test and validates structured output path', async () => {
    process.env.APP_ENV = 'test';
    process.env.NOTICE_DRAFT_AI_PROVIDER = 'fake';
    const provider = createNoticeDraftAiProvider();
    expect(provider?.testOnly).toBe(true);

    const factId = '00000000-0000-4000-8000-000000000001';
    const response = await provider!.draftNotice({
      language: 'en',
      noticeType: 'INITIAL_NOTICE',
      title: 'Delay notice',
      approvedFacts: [
        {
          id: factId,
          factType: 'DESCRIPTION_OF_EVENT',
          label: 'Event',
          value: 'Access was restricted on site.',
        },
      ],
      approvedDeadlineIso: '2026-01-08T00:00:00.000Z',
      promptSchemaVersion: 'v1',
    });
    expect(response.sections.length).toBeGreaterThan(0);

    const validated = validateNoticeAiDraftOutput({
      response,
      allowedFactIds: new Set([factId]),
      allowedEvidenceIds: new Set(),
      allowedClauseIds: new Set(),
      approvedDeadlineIso: '2026-01-08T00:00:00.000Z',
      approvedFactValuesByType: new Map([
        ['DESCRIPTION_OF_EVENT', 'Access was restricted on site.'],
      ]),
    });
    expect(validated.ok).toBe(true);
  });

  it('rejects test-only provider in production-like environments via assert', () => {
    process.env.APP_ENV = 'production';
    expect(() => assertNoticeAiProviderAllowed(new FakeNoticeDraftAiProvider())).toThrow(
      /test-only/,
    );
  });
});
