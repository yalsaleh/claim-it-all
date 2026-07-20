import { afterEach, describe, expect, it } from 'vitest';
import {
  FakeContractAiProvider,
  assertProviderAllowedForEnvironment,
  resolveContractAiProvider,
  validateAiResponse,
} from './ai-provider';

describe('contract AI provider boundary', () => {
  const prevProvider = process.env.CONTRACT_AI_PROVIDER;
  const prevAppEnv = process.env.APP_ENV;

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.CONTRACT_AI_PROVIDER;
    else process.env.CONTRACT_AI_PROVIDER = prevProvider;
    if (prevAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevAppEnv;
  });

  it('returns null when provider is unset or deterministic', () => {
    process.env.CONTRACT_AI_PROVIDER = 'deterministic';
    process.env.APP_ENV = 'test';
    expect(resolveContractAiProvider()).toBeNull();
  });

  it('rejects fake provider in production-like environments', () => {
    process.env.APP_ENV = 'production';
    expect(() => assertProviderAllowedForEnvironment(new FakeContractAiProvider())).toThrow(
      /test-only/,
    );
  });

  it('allows fake provider in test and labels output as test-only', async () => {
    process.env.APP_ENV = 'test';
    process.env.CONTRACT_AI_PROVIDER = 'fake';
    const provider = resolveContractAiProvider();
    expect(provider?.testOnly).toBe(true);
    const response = await provider!.analyzeSegments({
      segments: [{ id: '00000000-0000-4000-8000-000000000001', text: 'The Employer shall…' }],
      promptSchemaVersion: 'v1',
    });
    expect(response.testOnly).toBe(true);
    expect(response.suggestions.every((s) => s.suggestionType)).toBe(true);
  });

  it('fails closed on malformed AI output', () => {
    expect(() => validateAiResponse({ provider: 'x' })).toThrow(/Malformed/);
  });

  it('rejects testOnly payloads in staging', () => {
    process.env.APP_ENV = 'staging';
    expect(() =>
      validateAiResponse({
        provider: 'fake',
        model: 'fake-v0',
        promptSchemaVersion: 'v1',
        suggestions: [],
        testOnly: true,
      }),
    ).toThrow(/Test-only/);
  });
});
