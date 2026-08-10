-- Callable guard for production-readiness verification of test-purge fail-closed behavior.
-- Complements reject_test_purge_outside_test() (trigger-shaped) with an explicit check API.

CREATE OR REPLACE FUNCTION reject_test_purge_outside_test_check()
RETURNS void
LANGUAGE plpgsql
AS $$
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
END;
$$;

COMMENT ON FUNCTION reject_test_purge_outside_test_check() IS
  'Fails closed when test-only purge GUCs are enabled outside TEST/CI (STAGING/PILOT/PRODUCTION).';
