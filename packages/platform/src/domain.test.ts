import { describe, expect, it } from 'vitest';
import { parseAppEnvironment, policyForEnvironment, resolveAppEnvironment } from './environment';
import { isSecretReference, parseSecretReference, redactSecretLike } from './secrets';
import { validateProductionConfig } from './production-validate';
import { assertSafeMetricLabels, MetricsRegistry } from './metrics';
import { defaultPilotChecklist, evaluatePilotReadiness } from './pilot-readiness';
import { evaluateTenantLimit } from './tenant-limits';
import { isKillSwitchActive } from './kill-switches';

describe('environment', () => {
  it('parses canonical environments only', () => {
    expect(parseAppEnvironment('PILOT')).toBe('PILOT');
    expect(parseAppEnvironment('production')).toBe('PRODUCTION');
    expect(() => parseAppEnvironment('whatever')).toThrow(/Invalid/);
  });

  it('resolves CI when CI=true', () => {
    expect(resolveAppEnvironment({ ci: 'true' })).toBe('CI');
  });

  it('forbids fake providers in PILOT/PRODUCTION', () => {
    expect(policyForEnvironment('PILOT').allowFakeProviders).toBe(false);
    expect(policyForEnvironment('PRODUCTION').allowTestPurgeGucs).toBe(false);
    expect(policyForEnvironment('TEST').allowFakeProviders).toBe(true);
  });
});

describe('secrets', () => {
  it('accepts reference formats and redacts values', () => {
    expect(isSecretReference('env://BETTER_AUTH_SECRET')).toBe(true);
    expect(parseSecretReference('vault://tenants/a/connectors/b').backend).toBe('vault');
    expect(redactSecretLike({ password: 'x', token: 'y', ok: 1 })).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      ok: 1,
    });
  });
});

describe('production validate', () => {
  it('rejects fake providers and weak secrets in PRODUCTION', () => {
    const report = validateProductionConfig({
      environment: 'PRODUCTION',
      databaseUrl: 'postgresql://contractradar_app:x@db/app',
      migrateDatabaseUrl: 'postgresql://contractradar:x@db/app',
      redisUrl: 'redis://redis:6379',
      s3Endpoint: 'https://s3.example',
      s3AccessKeyId: 'minioadmin',
      betterAuthSecret: 'ci-test-secret-with-sufficient-length-32',
      malwareScanner: 'fake_test',
      connectorProvider: 'fake',
      allowDevDefaults: true,
      cookieSecure: false,
      backupConfigured: false,
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === 'CFG_FAKE_PROVIDER')).toBe(true);
    expect(report.findings.some((f) => f.code === 'CFG_AUTH_SECRET_PLACEHOLDER')).toBe(true);
    expect(report.findings.some((f) => f.code === 'CFG_INSECURE_COOKIE')).toBe(true);
    expect(JSON.stringify(report.redactedConfig)).not.toContain('minioadmin');
  });

  it('accepts a hardened pilot template', () => {
    const report = validateProductionConfig({
      environment: 'PILOT',
      databaseUrl: 'postgresql://contractradar_app:strong@db/app',
      migrateDatabaseUrl: 'postgresql://migrator_role:strong@db/app',
      redisUrl: 'redis://redis:6379',
      s3Endpoint: 'https://s3.example',
      s3AccessKeyId: 'AKIA_NOT_DEFAULT',
      s3SecretAccessKey: 'not-default-secret-value',
      betterAuthSecret: 'a'.repeat(48),
      documentIntelligenceToken: 'a'.repeat(40),
      malwareScanner: 'clamav',
      clamavHost: 'clamav',
      connectorProvider: 'microsoft',
      noticeDeliveryProvider: 'smtp',
      contractAiProvider: 'approved_vendor',
      allowDevDefaults: false,
      allowTestPurge: false,
      cookieSecure: true,
      backupConfigured: true,
    });
    expect(report.ok).toBe(true);
  });

  it('rejects ALLOW_TEST_PURGE in STAGING/PILOT/PRODUCTION', () => {
    for (const environment of ['STAGING', 'PILOT', 'PRODUCTION'] as const) {
      const report = validateProductionConfig({
        environment,
        databaseUrl: 'postgresql://contractradar_app:strong@db/app',
        migrateDatabaseUrl: 'postgresql://migrator_role:strong@db/app',
        redisUrl: 'redis://redis:6379',
        s3Endpoint: 'https://s3.example',
        s3AccessKeyId: 'AKIA_NOT_DEFAULT',
        s3SecretAccessKey: 'not-default-secret-value',
        betterAuthSecret: 'a'.repeat(48),
        documentIntelligenceToken: 'a'.repeat(40),
        malwareScanner: 'clamav',
        clamavHost: 'clamav',
        connectorProvider: 'microsoft',
        noticeDeliveryProvider: 'smtp',
        allowDevDefaults: false,
        allowTestPurge: true,
        cookieSecure: true,
        backupConfigured: true,
      });
      expect(report.ok).toBe(false);
      expect(report.findings.some((f) => f.code === 'CFG_TEST_PURGE_ENABLED')).toBe(true);
    }
  });
});

describe('metrics', () => {
  it('rejects sensitive labels', () => {
    expect(() => assertSafeMetricLabels({ email: 'a@b.com' })).toThrow();
    const reg = new MetricsRegistry();
    reg.increment('http_requests_total', { route: 'health' });
    expect(reg.get('http_requests_total', { route: 'health' })).toBe(1);
  });
});

describe('pilot readiness', () => {
  it('blocks activation when non-waivable items fail', () => {
    const items = defaultPilotChecklist();
    const blocked = evaluatePilotReadiness({ items });
    expect(blocked.canActivate).toBe(false);
    expect(blocked.status).toBe('BLOCKED');

    const readyItems = items.map((i) => ({ ...i, status: 'READY' as const }));
    expect(evaluatePilotReadiness({ items: readyItems }).canActivate).toBe(true);

    const waived = items.map((i) => ({
      ...i,
      status: 'BLOCKED' as const,
      approvedException: true,
    }));
    const result = evaluatePilotReadiness({ items: waived });
    expect(result.canActivate).toBe(false);
    expect(result.blockers.some((b) => b.includes('cannot be waived'))).toBe(true);
  });
});

describe('tenant limits + kill switches', () => {
  it('enforces hard limits and kill switches', () => {
    expect(evaluateTenantLimit({ key: 'users', limit: 10, used: 10 }).allowed).toBe(false);
    expect(
      isKillSwitchActive(
        [{ key: 'ai_calls', enabled: true, scope: 'tenant', tenantId: 't1' }],
        'ai_calls',
        't1',
      ),
    ).toBe(true);
  });
});
