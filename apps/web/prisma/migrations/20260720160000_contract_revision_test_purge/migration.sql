-- Allow test/admin purge of approved configuration revisions when explicitly enabled.
-- Production app code must never set app.allow_contract_revision_purge.

CREATE OR REPLACE FUNCTION prevent_approved_configuration_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED'
       AND coalesce(current_setting('app.allow_contract_revision_purge', true), 'off') <> 'on'
    THEN
      RAISE EXCEPTION 'approved contract_configuration_revision cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'APPROVED' THEN
    IF coalesce(current_setting('app.allow_contract_revision_purge', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'SUPERSEDED'
       AND NEW."isActiveApproved" = false
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."projectId" IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."contractPackageId" IS NOT DISTINCT FROM OLD."contractPackageId"
       AND NEW."revisionNumber" IS NOT DISTINCT FROM OLD."revisionNumber"
       AND NEW.summary IS NOT DISTINCT FROM OLD.summary
       AND NEW."basedOnDocumentVersions" IS NOT DISTINCT FROM OLD."basedOnDocumentVersions"
       AND NEW."createdByUserId" IS NOT DISTINCT FROM OLD."createdByUserId"
       AND NEW."submittedByUserId" IS NOT DISTINCT FROM OLD."submittedByUserId"
       AND NEW."approvedByUserId" IS NOT DISTINCT FROM OLD."approvedByUserId"
       AND NEW."submittedAt" IS NOT DISTINCT FROM OLD."submittedAt"
       AND NEW."approvedAt" IS NOT DISTINCT FROM OLD."approvedAt"
       AND NEW."supersedesRevisionId" IS NOT DISTINCT FROM OLD."supersedesRevisionId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       -- updatedAt may change on supersession
       THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved contract_configuration_revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;
