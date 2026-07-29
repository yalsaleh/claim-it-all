import {
  assertConnectorProviderAllowed,
  createConnectorProvider,
  type ConnectorProvider,
} from '@contractradar/connectors';

function resolveAppEnv(): string {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
}

export function getConnectorProviderEnv(): {
  CONNECTOR_PROVIDER?: string;
  APP_ENV?: string;
} {
  return {
    CONNECTOR_PROVIDER: process.env.CONNECTOR_PROVIDER,
    APP_ENV: resolveAppEnv(),
  };
}

/** Returns configured provider or null when CONNECTOR_PROVIDER is unset/none. */
export function tryCreateConnectorProvider(): ConnectorProvider | null {
  const provider = createConnectorProvider(getConnectorProviderEnv());
  if (!provider) return null;
  assertConnectorProviderAllowed(provider, resolveAppEnv());
  return provider;
}

/** Production guard wrapper — rejects fake/test providers outside test/dev. */
export function requireConnectorProvider(): ConnectorProvider {
  const provider = tryCreateConnectorProvider();
  if (!provider) {
    throw new Error('Connector provider is not configured (set CONNECTOR_PROVIDER)');
  }
  return provider;
}
