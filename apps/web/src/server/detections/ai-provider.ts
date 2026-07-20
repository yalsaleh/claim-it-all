import {
  AiDetectionResponseSchema,
  type AiDetectionResponse,
} from '@contractradar/event-detection';

/**
 * Provider-neutral event-detection AI adapter (ADR-050).
 * No provider is hardcoded. Fake providers are test-only and rejected in production-like envs.
 */

export type EventDetectionAiProvider = {
  readonly name: string;
  readonly testOnly: boolean;
  analyzeSegments(input: {
    segments: Array<{ id: string; text: string }>;
    promptSchemaVersion: string;
  }): Promise<AiDetectionResponse>;
};

export class FakeEventDetectionAiProvider implements EventDetectionAiProvider {
  readonly name = 'fake';
  readonly testOnly = true;

  async analyzeSegments(input: {
    segments: Array<{ id: string; text: string }>;
    promptSchemaVersion: string;
  }): Promise<AiDetectionResponse> {
    const text = input.segments.map((s) => s.text).join('\n');
    const suggestions: AiDetectionResponse['suggestions'] = [];
    if (/stop work|suspension|وقف العمل/i.test(text)) {
      suggestions.push({
        category: 'SUSPENSION_OR_RESTRICTED_ACCESS',
        subcategory: 'SUSPENSION',
        title: 'Synthetic suspension candidate (test-only)',
        factualStatements: ['Fixture text mentioned stop-work language.'],
        inferredStatements: [],
        evidenceSegmentIds: input.segments[0] ? [input.segments[0].id] : [],
        evidenceRoles: input.segments[0]
          ? [
              {
                segmentId: input.segments[0].id,
                role: 'PRIMARY_SUPPORT',
                quote: text.slice(0, 200),
              },
            ]
          : [],
        dateCandidates: [],
        assumptions: ['Test-only fixture; not a confirmed fact.'],
        contradictions: [],
        missingEvidence: ['Human confirmation of instruction date'],
        candidateRuleSnapshotIds: [],
        confidenceBand: 'LOW',
        rationale: 'Fixture detection candidate — not approved.',
      });
    }
    return {
      provider: this.name,
      model: 'fake-detection-v0',
      promptSchemaVersion: input.promptSchemaVersion,
      suggestions,
      testOnly: true,
    };
  }
}

export function assertProviderAllowedForEnvironment(provider: EventDetectionAiProvider): void {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const productionLike = appEnv === 'production' || appEnv === 'staging';
  if (productionLike && provider.testOnly) {
    throw new Error(
      `Event detection AI provider "${provider.name}" is test-only and cannot run in ${appEnv}`,
    );
  }
}

export function resolveEventDetectionAiProvider(): EventDetectionAiProvider | null {
  const configured = process.env.EVENT_DETECTION_AI_PROVIDER?.trim();
  if (!configured || configured === 'none' || configured === 'deterministic') {
    return null;
  }
  if (configured === 'fake') {
    const provider = new FakeEventDetectionAiProvider();
    assertProviderAllowedForEnvironment(provider);
    return provider;
  }
  throw new Error(
    `Unknown EVENT_DETECTION_AI_PROVIDER "${configured}" — no hardcoded commercial provider`,
  );
}

export function validateEventDetectionAiResponse(raw: unknown): AiDetectionResponse {
  const parsed = AiDetectionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Malformed event detection AI response: ${parsed.error.message}`);
  }
  if (parsed.data.testOnly) {
    const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
    if (appEnv === 'production' || appEnv === 'staging') {
      throw new Error('Test-only AI response rejected in production-like environment');
    }
  }
  return parsed.data;
}
