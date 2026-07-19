-- Slice 1B: PostgreSQL RLS (defense-in-depth) + audit immutability + membership invariants.
-- Auth tables (user/session/account/verification) are intentionally excluded from RLS.
--
-- Superusers bypass RLS even with FORCE ROW LEVEL SECURITY. Runtime app traffic must
-- use the non-superuser role `contractradar_app` (created below). Migrations may continue
-- as the bootstrap owner.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'contractradar_app') THEN
    CREATE ROLE contractradar_app LOGIN PASSWORD 'contractradar'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO contractradar_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO contractradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contractradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contractradar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO contractradar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO contractradar_app;

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_tenant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on';
$$;

-- Project membership invariants
CREATE OR REPLACE FUNCTION enforce_project_membership_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_tenant text;
BEGIN
  SELECT "tenantId"::text INTO project_tenant FROM "project" WHERE id = NEW."projectId";
  IF project_tenant IS NULL THEN
    RAISE EXCEPTION 'project_membership references unknown project';
  END IF;
  IF NEW."tenantId"::text <> project_tenant THEN
    RAISE EXCEPTION 'project_membership.tenantId must match project.tenantId';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "tenant_membership" tm
    WHERE tm."tenantId" = NEW."tenantId"
      AND tm."userId" = NEW."userId"
      AND tm.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'project_membership requires an ACTIVE tenant_membership for the same tenant';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_membership_tenant_guard ON "project_membership";
CREATE TRIGGER project_membership_tenant_guard
  BEFORE INSERT OR UPDATE ON "project_membership"
  FOR EACH ROW EXECUTE FUNCTION enforce_project_membership_tenant();

-- Audit immutability.
-- Administrative retention purge requires BOTH bypass_rls and allow_audit_purge.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND app_bypass_rls()
     AND coalesce(current_setting('app.allow_audit_purge', true), 'off') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are forbidden';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_immutable_update ON "audit_log";
CREATE TRIGGER audit_log_immutable_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_immutable_delete ON "audit_log";
CREATE TRIGGER audit_log_immutable_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- RLS: tenant_membership — own rows visible via user context; tenant-scoped otherwise
ALTER TABLE "tenant_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_membership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_membership_isolation ON "tenant_membership";
CREATE POLICY tenant_membership_isolation ON "tenant_membership"
  FOR ALL
  USING (
    app_bypass_rls()
    OR "userId"::text = app_current_user_id()
    OR "tenantId"::text = app_current_tenant_id()
  )
  WITH CHECK (
    app_bypass_rls()
    OR "tenantId"::text = app_current_tenant_id()
  );

-- RLS: project
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_tenant_isolation ON "project";
CREATE POLICY project_tenant_isolation ON "project"
  FOR ALL
  USING (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id())
  WITH CHECK (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id());

-- RLS: project_membership
ALTER TABLE "project_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_membership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_membership_tenant_isolation ON "project_membership";
CREATE POLICY project_membership_tenant_isolation ON "project_membership"
  FOR ALL
  USING (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id())
  WITH CHECK (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id());

-- RLS: audit_log
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_tenant_isolation ON "audit_log";
CREATE POLICY audit_log_tenant_isolation ON "audit_log"
  FOR ALL
  USING (
    app_bypass_rls()
    OR "tenantId" IS NULL
    OR "tenantId"::text = app_current_tenant_id()
  )
  WITH CHECK (
    app_bypass_rls()
    OR "tenantId" IS NULL
    OR "tenantId"::text = app_current_tenant_id()
  );

-- RLS: tenant — list own orgs via membership; mutations bypass-only
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_isolation ON "tenant";
CREATE POLICY tenant_select_isolation ON "tenant"
  FOR SELECT
  USING (
    app_bypass_rls()
    OR id::text = app_current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM "tenant_membership" tm
      WHERE tm."tenantId" = "tenant".id
        AND tm."userId"::text = app_current_user_id()
        AND tm.status = 'ACTIVE'
    )
  );
DROP POLICY IF EXISTS tenant_mutate_bypass_only ON "tenant";
CREATE POLICY tenant_mutate_bypass_only ON "tenant"
  FOR INSERT
  WITH CHECK (app_bypass_rls());
CREATE POLICY tenant_update_bypass_only ON "tenant"
  FOR UPDATE
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());
CREATE POLICY tenant_delete_bypass_only ON "tenant"
  FOR DELETE
  USING (app_bypass_rls());
