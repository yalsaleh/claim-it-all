-- Slice 2B: transactional outbox for durable ARQ enqueue

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHING', 'DISPATCHED', 'FAILED', 'DEAD_LETTERED');

CREATE TABLE "outbox_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "lastErrorSafe" TEXT,
    "correlationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_event_idempotencyKey_key" ON "outbox_event"("idempotencyKey");
CREATE INDEX "outbox_event_status_availableAt_idx" ON "outbox_event"("status", "availableAt");
CREATE INDEX "outbox_event_tenantId_projectId_createdAt_idx" ON "outbox_event"("tenantId", "projectId", "createdAt");

ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant/project consistency + FORCE RLS
CREATE OR REPLACE FUNCTION enforce_outbox_tenant_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_tenant text;
BEGIN
  SELECT "tenantId"::text INTO project_tenant FROM "project" WHERE id = NEW."projectId";
  IF project_tenant IS NULL OR NEW."tenantId"::text <> project_tenant THEN
    RAISE EXCEPTION 'outbox_event tenantId must match project.tenantId';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS outbox_event_tenant_project_guard ON "outbox_event";
CREATE TRIGGER outbox_event_tenant_project_guard
  BEFORE INSERT OR UPDATE ON "outbox_event"
  FOR EACH ROW EXECUTE FUNCTION enforce_outbox_tenant_project();

ALTER TABLE "outbox_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_event" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_event_tenant_isolation ON "outbox_event";
CREATE POLICY outbox_event_tenant_isolation ON "outbox_event"
  FOR ALL
  USING (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id())
  WITH CHECK (app_bypass_rls() OR "tenantId"::text = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "outbox_event" TO contractradar_app;
