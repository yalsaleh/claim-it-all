import { afterEach, describe, expect, it } from 'vitest';
import {
  FakeEventDetectionAiProvider,
  assertProviderAllowedForEnvironment,
  resolveEventDetectionAiProvider,
  validateEventDetectionAiResponse,
} from './ai-provider';

describe('event detection AI provider boundary', () => {
  const prevProvider = process.env.EVENT_DETECTION_AI_PROVIDER;
  const prevAppEnv = process.env.APP_ENV;

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.EVENT_DETECTION_AI_PROVIDER;
    else process.env.EVENT_DETECTION_AI_PROVIDER = prevProvider;
    if (prevAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevAppEnv;
  });

  it('returns null when provider is unset or deterministic', () => {
    process.env.EVENT_DETECTION_AI_PROVIDER = 'deterministic';
    process.env.APP_ENV = 'test';
    expect(resolveEventDetectionAiProvider()).toBeNull();
  });

  it('rejects fake provider in production-like environments', () => {
    process.env.APP_ENV = 'production';
    expect(() => assertProviderAllowedForEnvironment(new FakeEventDetectionAiProvider())).toThrow(
      /test-only/,
    );
  });

  it('allows fake provider in test and labels output as test-only', async () => {
    process.env.APP_ENV = 'test';
    process.env.EVENT_DETECTION_AI_PROVIDER = 'fake';
    const provider = resolveEventDetectionAiProvider();
    expect(provider?.testOnly).toBe(true);
    const response = await provider!.analyzeSegments({
      segments: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          text: 'The Employer issued a stop work order yesterday.',
        },
      ],
      promptSchemaVersion: 'v1',
    });
    expect(response.testOnly).toBe(true);
    expect(response.suggestions.length).toBeGreaterThan(0);
  });

  it('fails closed on malformed AI output', () => {
    expect(() => validateEventDetectionAiResponse({ provider: 'x' })).toThrow(/Malformed/);
  });

  it('rejects testOnly payloads in staging', () => {
    process.env.APP_ENV = 'staging';
    expect(() =>
      validateEventDetectionAiResponse({
        provider: 'fake',
        model: 'fake-v0',
        promptSchemaVersion: 'v1',
        suggestions: [],
        testOnly: true,
      }),
    ).toThrow(/Test-only/);
  });
});
