-- Test/admin purge for append-only history and approved calendar revisions.
CREATE OR REPLACE FUNCTION prevent_deadline_status_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on'
  THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on'
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'deadline_status_history is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION prevent_approved_project_calendar_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED'
       AND coalesce(current_setting('app.allow_deadline_purge', true), 'off') <> 'on'
    THEN
      RAISE EXCEPTION 'approved project_calendar_revision cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'APPROVED' THEN
    IF coalesce(current_setting('app.allow_deadline_purge', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'SUPERSEDED'
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."projectId" IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."projectCalendarId" IS NOT DISTINCT FROM OLD."projectCalendarId"
       AND NEW."revisionNumber" IS NOT DISTINCT FROM OLD."revisionNumber"
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved project_calendar_revision is immutable';
  END IF;
  RETURN NEW;
END;
$$;
