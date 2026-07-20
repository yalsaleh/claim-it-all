import { z } from 'zod';

/**
 * Provider-neutral contract-analysis adapter (ADR-034).
 * No provider is hardcoded. Fake providers are test-only and rejected in production-like envs.
 */

export const ContractAiSuggestionSchema = z.object({
  suggestionType: z.enum([
    'CLAUSE',
    'DEFINED_TERM',
    'PARTY',
    'ROLE',
    'CROSS_REFERENCE',
    'OBLIGATION',
    'NOTICE_RULE',
    'PRECEDENCE',
    'AMENDMENT_RELATIONSHIP',
    'ISSUE',
    'OTHER',
  ]),
  proposedData: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(2000).optional(),
  evidenceSegmentId: z.string().uuid().optional(),
});

export type ContractAiSuggestion = z.infer<typeof ContractAiSuggestionSchema>;

export const ContractAiResponseSchema = z.object({
  provider: z.string().min(1),
  model: z.string().nullable(),
  promptSchemaVersion: z.string().min(1),
  suggestions: z.array(ContractAiSuggestionSchema),
  testOnly: z.boolean().optional(),
});

export type ContractAiResponse = z.infer<typeof ContractAiResponseSchema>;

export type ContractAiProvider = {
  readonly name: string;
  readonly testOnly: boolean;
  analyzeSegments(input: {
    segments: Array<{ id: string; text: string }>;
    promptSchemaVersion: string;
  }): Promise<ContractAiResponse>;
};

export class FakeContractAiProvider implements ContractAiProvider {
  readonly name = 'fake';
  readonly testOnly = true;

  async analyzeSegments(input: {
    segments: Array<{ id: string; text: string }>;
    promptSchemaVersion: string;
  }): Promise<ContractAiResponse> {
    const text = input.segments.map((s) => s.text).join('\n');
    const suggestions: ContractAiSuggestion[] = [];
    if (/Employer|Contractor|المقاول|صاحب العمل/i.test(text)) {
      suggestions.push({
        suggestionType: 'PARTY',
        proposedData: {
          legalName: 'Synthetic Party (test-only)',
          partyType: 'OTHER',
          testOnly: true,
        },
        confidence: 0.4,
        rationale: 'Fixture party candidate — not approved.',
        evidenceSegmentId: input.segments[0]?.id,
      });
    }
    return {
      provider: this.name,
      model: 'fake-v0',
      promptSchemaVersion: input.promptSchemaVersion,
      suggestions,
      testOnly: true,
    };
  }
}

export function assertProviderAllowedForEnvironment(provider: ContractAiProvider): void {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const productionLike = appEnv === 'production' || appEnv === 'staging';
  if (productionLike && provider.testOnly) {
    throw new Error(
      `Contract AI provider "${provider.name}" is test-only and cannot run in ${appEnv}`,
    );
  }
}

export function resolveContractAiProvider(): ContractAiProvider | null {
  const configured = process.env.CONTRACT_AI_PROVIDER?.trim();
  if (!configured || configured === 'none' || configured === 'deterministic') {
    return null;
  }
  if (configured === 'fake') {
    const provider = new FakeContractAiProvider();
    assertProviderAllowedForEnvironment(provider);
    return provider;
  }
  throw new Error(
    `Unknown CONTRACT_AI_PROVIDER "${configured}" — no hardcoded commercial provider`,
  );
}

export function validateAiResponse(raw: unknown): ContractAiResponse {
  const parsed = ContractAiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Malformed contract AI response: ${parsed.error.message}`);
  }
  if (parsed.data.testOnly) {
    const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
    if (appEnv === 'production' || appEnv === 'staging') {
      throw new Error('Test-only AI response rejected in production-like environment');
    }
  }
  return parsed.data;
}
