export const KILL_SWITCH_KEYS = [
  'connector_ingestion',
  'ai_calls',
  'email_delivery',
  'webhook_processing',
  'scheduled_synchronization',
  'background_detection',
  'export_generation',
] as const;

export type KillSwitchKey = (typeof KILL_SWITCH_KEYS)[number];

export type KillSwitchState = {
  key: KillSwitchKey;
  enabled: boolean;
  scope: 'global' | 'tenant';
  tenantId?: string;
  reason?: string;
};

/** Returns true when the named capability is blocked. */
export function isKillSwitchActive(
  switches: KillSwitchState[],
  key: KillSwitchKey,
  tenantId?: string,
): boolean {
  return switches.some(
    (s) =>
      s.key === key &&
      s.enabled &&
      (s.scope === 'global' || (s.scope === 'tenant' && s.tenantId === tenantId)),
  );
}
