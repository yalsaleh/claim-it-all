-- Slice 9: production hardening, tenant admin, support access, backups, pilot readiness

-- Extend TenantStatus (PostgreSQL: ADD VALUE cannot run in transaction block on older versions;
-- Prisma wraps migrations in a transaction — use DO blocks with exception handling where needed.)
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PROVISIONING';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PILOT_ENDING';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'OFFBOARDING';

CREATE TYPE "TenantFeatureFlagKey" AS ENUM (
  'CONNECTORS',
  'CONTROLLED_DELIVERY',
  'AI_ASSISTED_EXTRACTION',
  'AI_ASSISTED_DETECTION',
  'AI_ASSISTED_DRAFTING',
  'PORTFOLIO_DASHBOARD',
  'BILINGUAL_SUPPORT',
  'PROVIDER_INTEGRATIONS',
  'PILOT_ONLY_FEATURES'
);

CREATE TYPE "FeatureRolloutMode" AS ENUM ('OFF', 'INTERNAL', 'PILOT', 'GA');
CREATE TYPE "SupportAccessStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "BackupRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_SUCCEEDED', 'CANCELLED');
CREATE TYPE "RestoreTestStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "ProviderEnablementStatus" AS ENUM (
  'NOT_CONFIGURED',
  'TECHNICAL_VALIDATION',
  'SECURITY_REVIEW',
  'APPROVED_FOR_STAGING',
  'APPROVED_FOR_PILOT',
  'ENABLED',
  'DISABLED',
  'REVOKED'
);
CREATE TYPE "PilotConfigurationStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'EXTENDED');
CREATE TYPE "PilotAssessmentStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_WITH_EXCEPTIONS',
  'READY',
  'EXPIRED'
);
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RECOVERING', 'RESOLVED', 'CLOSED');
CREATE TYPE "OffboardingStatus" AS ENUM (
  'REQUESTED',
  'IDENTITY_VERIFIED',
  'SCOPE_CONFIRMED',
  'LEGAL_HOLD_CHECK',
  'EXPORT_GENERATING',
  'CUSTOMER_CONFIRMED',
  'CONNECTORS_REVOKED',
  'USERS_DEACTIVATED',
  'RETENTION_WINDOW',
  'DELETION_PENDING',
  'VERIFIED',
  'CANCELLED'
);

ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "supportSessionId" TEXT;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "previousHash" TEXT;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "integrityHash" TEXT;
CREATE INDEX IF NOT EXISTS "audit_log_tenantId_integrityHash_idx" ON "audit_log"("tenantId", "integrityHash");

CREATE TABLE "tenant_settings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "legalDisplayName" TEXT,
  "defaultTimezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
  "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
  "enabledLanguages" JSONB NOT NULL DEFAULT '["en"]',
  "dateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
  "numeralFormat" TEXT NOT NULL DEFAULT 'latn',
  "defaultWorkingWeek" JSONB,
  "defaultProjectPolicy" JSONB,
  "defaultSodSettings" JSONB,
  "sessionPolicy" JSONB,
  "retentionPolicyRef" TEXT,
  "dataResidencyMetadata" JSONB,
  "pilotStatus" TEXT,
  "supportContact" TEXT,
  "billingPlanPlaceholder" TEXT,
  "incidentContacts" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_feature_flag" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "flag" "TenantFeatureFlagKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rolloutMode" "FeatureRolloutMode" NOT NULL DEFAULT 'OFF',
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "configuredByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_feature_flag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_feature_flag_tenantId_flag_key" ON "tenant_feature_flag"("tenantId", "flag");
CREATE INDEX "tenant_feature_flag_tenantId_enabled_idx" ON "tenant_feature_flag"("tenantId", "enabled");
ALTER TABLE "tenant_feature_flag" ADD CONSTRAINT "tenant_feature_flag_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_limit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "limitKey" TEXT NOT NULL,
  "limitValue" BIGINT NOT NULL,
  "usedValue" BIGINT NOT NULL DEFAULT 0,
  "warningThresholdRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_limit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_limit_tenantId_limitKey_key" ON "tenant_limit"("tenantId", "limitKey");
ALTER TABLE "tenant_limit" ADD CONSTRAINT "tenant_limit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_invitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_invitation_tenantId_email_tokenHash_key" ON "tenant_invitation"("tenantId", "email", "tokenHash");
CREATE INDEX "tenant_invitation_tenantId_email_status_idx" ON "tenant_invitation"("tenantId", "email", "status");
ALTER TABLE "tenant_invitation" ADD CONSTRAINT "tenant_invitation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_invitation" ADD CONSTRAINT "tenant_invitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "support_access_request" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT,
  "requestingOperatorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedCapabilities" JSONB NOT NULL,
  "requestedDurationMin" INTEGER NOT NULL,
  "status" "SupportAccessStatus" NOT NULL DEFAULT 'REQUESTED',
  "approvedByUserId" TEXT,
  "tenantApproverUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_access_request_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_access_request_tenantId_status_idx" ON "support_access_request"("tenantId", "status");
ALTER TABLE "support_access_request" ADD CONSTRAINT "support_access_request_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_access_request" ADD CONSTRAINT "support_access_request_requestingOperatorId_fkey"
  FOREIGN KEY ("requestingOperatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_access_request" ADD CONSTRAINT "support_access_request_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "support_access_audit_session" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "operatorUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_access_audit_session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_access_audit_session_tenantId_active_idx" ON "support_access_audit_session"("tenantId", "active");
ALTER TABLE "support_access_audit_session" ADD CONSTRAINT "support_access_audit_session_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_access_audit_session" ADD CONSTRAINT "support_access_audit_session_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "support_access_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_access_audit_session" ADD CONSTRAINT "support_access_audit_session_operatorUserId_fkey"
  FOREIGN KEY ("operatorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "backup_run" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "environment" TEXT NOT NULL,
  "backupType" TEXT NOT NULL,
  "status" "BackupRunStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "manifestLocation" TEXT,
  "checksum" TEXT,
  "encryptionStatus" TEXT NOT NULL DEFAULT 'encrypted_at_rest',
  "databaseMigrationVersion" TEXT,
  "objectCount" INTEGER NOT NULL DEFAULT 0,
  "databaseSizeBytes" BIGINT NOT NULL DEFAULT 0,
  "objectSizeBytes" BIGINT NOT NULL DEFAULT 0,
  "failureCode" TEXT,
  "failureMessageSafe" TEXT,
  "initiatedByUserId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "backup_run_environment_status_createdAt_idx" ON "backup_run"("environment", "status", "createdAt");
ALTER TABLE "backup_run" ADD CONSTRAINT "backup_run_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backup_run" ADD CONSTRAINT "backup_run_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "restore_test_run" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "backupRunId" TEXT NOT NULL,
  "targetEnvironment" TEXT NOT NULL,
  "status" "RestoreTestStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "integrityChecks" JSONB,
  "tenantIsolationResult" TEXT,
  "objectIntegrityResult" TEXT,
  "applicationReadinessResult" TEXT,
  "failureCode" TEXT,
  "failureMessageSafe" TEXT,
  "reviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restore_test_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "restore_test_run_backupRunId_status_idx" ON "restore_test_run"("backupRunId", "status");
ALTER TABLE "restore_test_run" ADD CONSTRAINT "restore_test_run_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "restore_test_run" ADD CONSTRAINT "restore_test_run_backupRunId_fkey"
  FOREIGN KEY ("backupRunId") REFERENCES "backup_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restore_test_run" ADD CONSTRAINT "restore_test_run_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_enablement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "provider" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" "ProviderEnablementStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "approvedUseCases" JSONB,
  "approvedTenantIds" JSONB,
  "dataCategories" JSONB,
  "riskReview" TEXT,
  "securityReview" TEXT,
  "legalReviewPlaceholder" TEXT,
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "killSwitchReason" TEXT,
  "configuredByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "secretReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_enablement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "provider_enablement_provider_environment_status_idx" ON "provider_enablement"("provider", "environment", "status");
ALTER TABLE "provider_enablement" ADD CONSTRAINT "provider_enablement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_enablement" ADD CONSTRAINT "provider_enablement_configuredByUserId_fkey"
  FOREIGN KEY ("configuredByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_enablement" ADD CONSTRAINT "provider_enablement_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_kill_switch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT NOT NULL DEFAULT 'global',
  "reason" TEXT,
  "configuredByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_kill_switch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_kill_switch_tenantId_key_scope_key" ON "provider_kill_switch"("tenantId", "key", "scope");
ALTER TABLE "provider_kill_switch" ADD CONSTRAINT "provider_kill_switch_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_kill_switch" ADD CONSTRAINT "provider_kill_switch_configuredByUserId_fkey"
  FOREIGN KEY ("configuredByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pilot_configuration" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "allowedProjectIds" JSONB,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "userLimit" INTEGER,
  "storageLimitBytes" BIGINT,
  "connectorLimit" INTEGER,
  "enabledProviders" JSONB,
  "enabledFeatures" JSONB,
  "supportHours" TEXT,
  "escalationContacts" JSONB,
  "dataResidencyMetadata" JSONB,
  "exportPolicy" JSONB,
  "dispatchPolicy" JSONB,
  "aiPolicy" JSONB,
  "status" "PilotConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pilot_configuration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pilot_configuration_tenantId_status_idx" ON "pilot_configuration"("tenantId", "status");
ALTER TABLE "pilot_configuration" ADD CONSTRAINT "pilot_configuration_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilot_configuration" ADD CONSTRAINT "pilot_configuration_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pilot_readiness_assessment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" "PilotAssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pilot_readiness_assessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pilot_readiness_assessment_tenantId_status_idx" ON "pilot_readiness_assessment"("tenantId", "status");
ALTER TABLE "pilot_readiness_assessment" ADD CONSTRAINT "pilot_readiness_assessment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pilot_readiness_item" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "requirement" TEXT NOT NULL,
  "status" "PilotAssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "nonWaivable" BOOLEAN NOT NULL DEFAULT true,
  "evidence" TEXT,
  "ownerUserId" TEXT,
  "reviewerUserId" TEXT,
  "approvedException" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pilot_readiness_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pilot_readiness_item_assessmentId_requirement_key" ON "pilot_readiness_item"("assessmentId", "requirement");
ALTER TABLE "pilot_readiness_item" ADD CONSTRAINT "pilot_readiness_item_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "pilot_readiness_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operational_incident" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "affectedServices" JSONB NOT NULL,
  "affectedTenantIds" JSONB,
  "commanderUserId" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "customerImpactSummary" TEXT,
  "rootCause" TEXT,
  "correctiveActions" TEXT,
  "timeline" JSONB,
  "linkedAlertIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_incident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operational_incident_status_severity_createdAt_idx" ON "operational_incident"("status", "severity", "createdAt");
ALTER TABLE "operational_incident" ADD CONSTRAINT "operational_incident_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_incident" ADD CONSTRAINT "operational_incident_commanderUserId_fkey"
  FOREIGN KEY ("commanderUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tenant_offboarding_request" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" "OffboardingStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByUserId" TEXT NOT NULL,
  "scopeConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "legalHoldClear" BOOLEAN NOT NULL DEFAULT false,
  "exportManifest" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_offboarding_request_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tenant_offboarding_request_tenantId_status_idx" ON "tenant_offboarding_request"("tenantId", "status");
ALTER TABLE "tenant_offboarding_request" ADD CONSTRAINT "tenant_offboarding_request_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_offboarding_request" ADD CONSTRAINT "tenant_offboarding_request_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tenant_storage_usage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "originalUploads" BIGINT NOT NULL DEFAULT 0,
  "extractedArtifacts" BIGINT NOT NULL DEFAULT 0,
  "exports" BIGINT NOT NULL DEFAULT 0,
  "attachments" BIGINT NOT NULL DEFAULT 0,
  "dispatchEvidence" BIGINT NOT NULL DEFAULT 0,
  "connectorImports" BIGINT NOT NULL DEFAULT 0,
  "rebuiltAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_storage_usage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_storage_usage_tenantId_key" ON "tenant_storage_usage"("tenantId");
ALTER TABLE "tenant_storage_usage" ADD CONSTRAINT "tenant_storage_usage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FORCE RLS on tenant-owned Slice 9 tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_settings',
    'tenant_feature_flag',
    'tenant_limit',
    'tenant_invitation',
    'support_access_request',
    'support_access_audit_session',
    'provider_enablement',
    'provider_kill_switch',
    'pilot_configuration',
    'pilot_readiness_assessment',
    'tenant_offboarding_request',
    'tenant_storage_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I
         USING (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         )
         WITH CHECK (
           coalesce(current_setting(''app.bypass_rls'', true), ''off'') = ''on''
           OR "tenantId"::text = nullif(current_setting(''app.current_tenant_id'', true), '''')
         )',
      t || '_tenant_isolation', t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO contractradar_app', t);
  END LOOP;
END $$;

-- Platform-scoped tables: readable by app with bypass or explicit null-tenant ops checks via bypass in jobs
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'backup_run',
    'restore_test_run',
    'operational_incident',
    'pilot_readiness_item'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_access', t);
  END LOOP;

  CREATE POLICY backup_run_access ON backup_run
    USING (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    )
    WITH CHECK (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    );

  CREATE POLICY restore_test_run_access ON restore_test_run
    USING (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    )
    WITH CHECK (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    );

  CREATE POLICY operational_incident_access ON operational_incident
    USING (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    )
    WITH CHECK (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR "tenantId" IS NULL
      OR "tenantId"::text = nullif(current_setting('app.current_tenant_id', true), '')
    );

  -- Child rows are written under tenant transactions that set bypass for assessment maintenance,
  -- or via services that already authorized the parent assessment.
  CREATE POLICY pilot_readiness_item_access ON pilot_readiness_item
    USING (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR nullif(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    )
    WITH CHECK (
      coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
      OR nullif(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    );

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backup_run, restore_test_run, operational_incident, pilot_readiness_item TO contractradar_app;
END $$;

-- Block test purge GUCs outside TEST/CI at the SQL layer when app.contractradar_env is set.
CREATE OR REPLACE FUNCTION reject_test_purge_outside_test()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.allow_audit_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_ops_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_notice_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_detection_purge', true), 'off') = 'on'
     OR coalesce(current_setting('app.allow_contract_revision_purge', true), 'off') = 'on' THEN
    IF coalesce(current_setting('app.contractradar_env', true), 'LOCAL') IN ('STAGING', 'PILOT', 'PRODUCTION') THEN
      RAISE EXCEPTION 'test purge GUCs are forbidden in %', current_setting('app.contractradar_env', true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
