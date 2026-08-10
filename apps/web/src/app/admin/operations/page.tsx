import Link from 'next/link';
import { requireTenantCapability } from '@/server/authz/context';
import { getPlatformOperationsDashboard } from '@/server/services/platform';

export default async function AdminOperationsPage() {
  await requireTenantCapability('platform_operations.read');
  const dashboard = await getPlatformOperationsDashboard();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm text-neutral-600">
        <Link href="/projects">Projects</Link> / Admin operations
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Operations</h1>
      <p className="mt-2 max-w-2xl text-neutral-700">
        Environment and dependency health for authorized operators. No secrets or document contents
        are shown.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-neutral-500">Environment</dt>
          <dd className="text-lg">{dashboard.environment}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Open alerts</dt>
          <dd className="text-lg">{dashboard.openAlertCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Active support sessions</dt>
          <dd className="text-lg">{dashboard.activeSupportSessions}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Last successful backup</dt>
          <dd className="text-lg">{dashboard.lastSuccessfulBackupAt ?? 'none recorded'}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Last restore test</dt>
          <dd className="text-lg">{dashboard.lastSuccessfulRestoreTestAt ?? 'none recorded'}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Pilot readiness summary</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Release identity from environment only. Does not claim cloud deploy health.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-neutral-500">RELEASE_SHA</dt>
            <dd className="font-mono text-sm">
              {process.env.RELEASE_SHA ?? process.env.GITHUB_SHA ?? 'unset'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">RELEASE_ID</dt>
            <dd className="font-mono text-sm">{process.env.RELEASE_ID ?? 'unset'}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">CONTRACTRADAR_ENV</dt>
            <dd className="text-lg">{dashboard.environment}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">AI / delivery defaults</dt>
            <dd className="text-sm text-neutral-700">
              AI {process.env.FEATURE_AI_ENABLED === 'true' ? 'ON' : 'off'}; delivery{' '}
              {process.env.FEATURE_NOTICE_DELIVERY_ENABLED === 'true' ? 'ON' : 'off'}; connectors{' '}
              {process.env.FEATURE_REAL_CONNECTORS_ENABLED === 'true' ? 'ON' : 'off'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Kill switches</h2>
        <ul className="mt-3 space-y-2">
          {dashboard.killSwitches.length === 0 ? (
            <li className="text-neutral-600">No kill switches configured.</li>
          ) : (
            dashboard.killSwitches.map((k) => (
              <li key={`${k.scope}-${k.key}`}>
                <span className="font-medium">{k.key}</span> — {k.enabled ? 'ON' : 'off'} ({k.scope}
                )
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
