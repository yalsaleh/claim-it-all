export type TenantLimitKey =
  | 'active_projects'
  | 'users'
  | 'storage_bytes'
  | 'monthly_imported_records'
  | 'monthly_processed_pages'
  | 'connector_accounts'
  | 'connector_scopes'
  | 'detection_runs'
  | 'ai_requests'
  | 'notice_exports'
  | 'dispatch_attempts';

export type TenantLimitSnapshot = {
  key: TenantLimitKey;
  limit: number;
  used: number;
  warningThresholdRatio?: number;
};

export type LimitDecision = {
  allowed: boolean;
  nearLimit: boolean;
  code?: 'LIMIT_EXCEEDED';
};

export function evaluateTenantLimit(snap: TenantLimitSnapshot): LimitDecision {
  const warning = snap.warningThresholdRatio ?? 0.8;
  if (snap.used >= snap.limit) {
    return { allowed: false, nearLimit: true, code: 'LIMIT_EXCEEDED' };
  }
  return { allowed: true, nearLimit: snap.used / snap.limit >= warning };
}
