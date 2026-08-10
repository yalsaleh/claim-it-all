-- Representative Slice 8 seed for true 0e6ff4e → current upgrade rehearsal.
-- Requires: app.bypass_rls=on; migrations through connectors_operations_slice8 applied.

SELECT set_config('app.bypass_rls', 'on', false);

INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt") VALUES
  ('88000000-0000-4000-8000-000000000001', 'Slice8 Tenant A', 'slice8-upgrade-a', 'ACTIVE', NOW(), NOW()),
  ('88000000-0000-4000-8000-000000000002', 'Slice8 Tenant B', 'slice8-upgrade-b', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO "user" (id, email, name, status, "createdAt", "updatedAt") VALUES
  ('88000000-0000-4000-8000-0000000000aa', 'slice8-a@example.com', 'Slice8 User A', 'ACTIVE', NOW(), NOW()),
  ('88000000-0000-4000-8000-0000000000bb', 'slice8-b@example.com', 'Slice8 User B', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO tenant_membership (id, "tenantId", "userId", role, status, "createdAt", "updatedAt") VALUES
  ('88000000-0000-4000-8000-0000000000m1', '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000aa', 'TENANT_OWNER', 'ACTIVE', NOW(), NOW()),
  ('88000000-0000-4000-8000-0000000000m2', '88000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-0000000000bb', 'TENANT_OWNER', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO project (id, "tenantId", name, code, status, "countryCode", "defaultCurrency", timezone, "createdAt", "updatedAt") VALUES
  ('88000000-0000-4000-8000-0000000000c1', '88000000-0000-4000-8000-000000000001', 'Slice8 Project A1', 'S8A1', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW()),
  ('88000000-0000-4000-8000-0000000000c2', '88000000-0000-4000-8000-000000000001', 'Slice8 Project A2', 'S8A2', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW()),
  ('88000000-0000-4000-8000-0000000000c3', '88000000-0000-4000-8000-000000000002', 'Slice8 Project B1', 'S8B1', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO source_document (id, "tenantId", "projectId", title, "documentType", "createdByUserId", "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-0000000000d1', '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
        'Slice8 Contract', 'CONTRACT', '88000000-0000-4000-8000-0000000000aa', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (
  id, "tenantId", "projectId", "sourceDocumentId", "versionNumber",
  "originalFilename", "normalizedFilename", "mediaType", extension,
  "sizeBytes", sha256, "storageBucket", "storageKey", "uploadedByUserId", "uploadedAt", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000v1',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000d1', 1,
  'slice8.pdf', 'slice8.pdf', 'application/pdf', 'pdf',
  128, repeat('a', 64), 'contractradar-documents',
  'tenants/88000000-0000-4000-8000-000000000001/projects/88000000-0000-4000-8000-0000000000c1/originals/slice8.pdf',
  '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

UPDATE source_document SET "currentVersionId" = '88000000-0000-4000-8000-0000000000v1'
WHERE id = '88000000-0000-4000-8000-0000000000d1';

INSERT INTO contract_package (id, "tenantId", "projectId", name, "createdByUserId", "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
        'Slice8 Package', '88000000-0000-4000-8000-0000000000aa', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_configuration_revision (
  id, "tenantId", "projectId", "contractPackageId", "revisionNumber", "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000r1',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', 1,
  '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_document (
  id, "tenantId", "projectId", "contractPackageId", "sourceDocumentId", "documentVersionId",
  "contractDocumentType", title, "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000cd',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000d1',
  '88000000-0000-4000-8000-0000000000v1', 'AGREEMENT', 'Main Agreement', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_clause (
  id, "tenantId", "projectId", "contractPackageId", "contractDocumentId", "documentVersionId",
  "sourceText", "textChecksum", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000cl',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000cd',
  '88000000-0000-4000-8000-0000000000v1',
  'Notice within 14 days', repeat('b', 64), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_obligation (
  id, "tenantId", "projectId", "contractPackageId", "sourceClauseId", "obligationType",
  "actionDescription", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ob',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000cl',
  'NOTICE', 'Give notice', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_rule (
  id, "tenantId", "projectId", "contractPackageId", "obligationId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000nr',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000ob', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO approved_notice_rule_snapshot (
  id, "tenantId", "projectId", "contractPackageId", "configurationRevisionId",
  "sourceNoticeRuleId", "sourceObligationId", "countingConvention", "timeBarClassification",
  "ambiguityStatus", "structuredRule", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000as',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000r1',
  '88000000-0000-4000-8000-0000000000nr', '88000000-0000-4000-8000-0000000000ob',
  'UNSPECIFIED', 'UNCERTAIN', 'UNRESOLVED', '{}'::jsonb, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_event (
  id, "tenantId", "projectId", "contractPackageId", title, "eventCategory",
  "eventStatus", "confirmationStatus", timezone, "reportedByUserId",
  "confirmedByUserId", "confirmedAt", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ev',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', 'Instruction received', 'INSTRUCTION',
  'CONFIRMED', 'CONFIRMED_FACT', 'Asia/Dubai',
  '88000000-0000-4000-8000-0000000000aa', '88000000-0000-4000-8000-0000000000aa', NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_rule_assessment (
  id, "tenantId", "projectId", "projectEventId", "contractPackageId",
  "configurationRevisionId", "approvedRuleSnapshotId", "assessmentSource", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ea',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000ev', '88000000-0000-4000-8000-0000000000p1',
  '88000000-0000-4000-8000-0000000000r1', '88000000-0000-4000-8000-0000000000as',
  'HUMAN_SELECTED', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_calendar (
  id, "tenantId", "projectId", name, timezone, "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000cal',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  'Default', 'Asia/Dubai', '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_calendar_revision (
  id, "tenantId", "projectId", "projectCalendarId", "revisionNumber", timezone, "weekendDays",
  "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000cr',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000cal', 1, 'Asia/Dubai', '[5,6]'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO deadline_calculation (
  id, "tenantId", "projectId", "projectEventId", "eventRuleAssessmentId",
  "contractPackageId", "configurationRevisionId", "approvedRuleSnapshotId",
  "calendarRevisionId", "projectCalendarId", "triggerDateType", "triggerDateValue",
  "triggerTimezone", "deadlineTimezone", "calculationTrace", "calculatedByUserId",
  "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000dc',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000ev', '88000000-0000-4000-8000-0000000000ea',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000r1',
  '88000000-0000-4000-8000-0000000000as', '88000000-0000-4000-8000-0000000000cr',
  '88000000-0000-4000-8000-0000000000cal', 'OCCURRENCE_DATE', NOW(),
  'Asia/Dubai', 'Asia/Dubai', '{"seed":true}'::jsonb,
  '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_deadline (
  id, "tenantId", "projectId", "projectEventId", "contractPackageId",
  "deadlineCalculationId", title, "deadlineType", timezone, "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000dl',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000ev', '88000000-0000-4000-8000-0000000000p1',
  '88000000-0000-4000-8000-0000000000dc', 'Notice deadline', 'NOTICE', 'Asia/Dubai', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_package (
  id, "tenantId", "projectId", "contractPackageId", "configurationRevisionId",
  "approvedNoticeRuleSnapshotId", "projectEventId", "eventRuleAssessmentId",
  "deadlineCalculationId", "projectDeadlineId", "noticeType", title, language,
  "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000np',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000p1', '88000000-0000-4000-8000-0000000000r1',
  '88000000-0000-4000-8000-0000000000as', '88000000-0000-4000-8000-0000000000ev',
  '88000000-0000-4000-8000-0000000000ea', '88000000-0000-4000-8000-0000000000dc',
  '88000000-0000-4000-8000-0000000000dl', 'NOTICE_OF_DELAY', 'Slice8 Notice', 'en',
  '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_draft_revision (
  id, "tenantId", "projectId", "noticePackageId", "revisionNumber",
  language, "templateVersion", "generatedBy", "generatorVersion",
  "createdByUserId", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000nd',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000np', 1,
  'en', 'v1', 'seed', 'v1',
  '88000000-0000-4000-8000-0000000000aa', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_export_bundle (
  id, "tenantId", "projectId", "noticePackageId", "draftRevisionId",
  format, "artifactChecksum", "storageKey", manifest, "templateVersion",
  "generatedByUserId", language, "generatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ne',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000np', '88000000-0000-4000-8000-0000000000nd',
  'PDF', repeat('d', 64),
  'tenants/88000000-0000-4000-8000-000000000001/notices/export-slice8.pdf',
  '{"seed":true}'::jsonb, 'v1',
  '88000000-0000-4000-8000-0000000000aa', 'en', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_dispatch_package_snapshot (
  id, "tenantId", "projectId", "noticePackageId", "approvedDraftRevisionId", "noticeExportId",
  "exportManifestChecksum", "bundleChecksum", "noticeChecksum", "attachmentManifestChecksum",
  "templateVersion", language, subject, "recipientSnapshot", "copiedRecipientSnapshot",
  "deliveryMethodSnapshot", "attachmentSnapshot", "coverMessageSnapshot", channel, "createdByUserId", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ns',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000np', '88000000-0000-4000-8000-0000000000nd',
  '88000000-0000-4000-8000-0000000000ne',
  repeat('e', 64), repeat('e', 64), repeat('e', 64), repeat('e', 64),
  'v1', 'en', 'Slice8 Notice', '[]'::jsonb, '[]'::jsonb,
  '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, 'email',
  '88000000-0000-4000-8000-0000000000aa', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_dispatch_authorization (
  id, "tenantId", "projectId", "noticePackageId", "dispatchPackageSnapshotId",
  "requestedByUserId", "selectedChannel", "recipientCount", "copiedRecipientCount", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000na',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000np', '88000000-0000-4000-8000-0000000000ns',
  '88000000-0000-4000-8000-0000000000aa', 'email', 1, 0, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_dispatch_attempt (
  id, "tenantId", "projectId", "noticePackageId", "dispatchAuthorizationId",
  "dispatchPackageSnapshotId", "attemptNumber", channel, provider,
  "initiatedByUserId", "correlationId", "idempotencyKey", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000da',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000np', '88000000-0000-4000-8000-0000000000na',
  '88000000-0000-4000-8000-0000000000ns', 1, 'email', 'fake',
  '88000000-0000-4000-8000-0000000000aa', 'slice8-corr', 'slice8-idem-1', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO dispatch_evidence (
  id, "tenantId", "projectId", "dispatchAttemptId", "evidenceType",
  "storageKey", "checksumSha256", "recordedByUserId", "capturedAt", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000de',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000da', 'EMAIL_PROVIDER_ACCEPTANCE',
  'tenants/88000000-0000-4000-8000-000000000001/dispatch/evidence-slice8.bin',
  repeat('g', 64), '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO connector_account (
  id, "tenantId", "connectorType", "displayName", provider, "secretReference",
  "configuredByUserId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000ca',
  '88000000-0000-4000-8000-000000000001', 'email', 'Slice8 Mailbox', 'microsoft365',
  'secret://ci/slice8', '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO connector_project_scope (
  id, "tenantId", "projectId", "connectorAccountId", "externalMailboxOrFolder",
  "includeRules", "excludeRules", "approvedDocumentTypes", "configuredByUserId", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000cs',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  '88000000-0000-4000-8000-0000000000ca', 'Inbox',
  '[]'::jsonb, '[]'::jsonb, '["LETTER"]'::jsonb,
  '88000000-0000-4000-8000-0000000000aa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_operations_summary (id, "tenantId", "projectId", "rebuiltAt", "createdAt", "updatedAt")
VALUES (
  '88000000-0000-4000-8000-0000000000os',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_timeline_event (
  id, "tenantId", "projectId", "eventType", summary, "occurredAt", "createdAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000te',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  'sync', 'Slice8 seeded', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO operational_alert (
  id, "tenantId", "projectId", "alertType", severity, title, description,
  "sourceEntityType", "sourceEntityId", "dedupeKey",
  "detectedAt", "firstObservedAt", "lastObservedAt", "rulesetVersion", "createdAt", "updatedAt"
) VALUES (
  '88000000-0000-4000-8000-0000000000oa',
  '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000c1',
  'connector_lag', 'MEDIUM', 'Lag', 'seed',
  'connector_account', '88000000-0000-4000-8000-0000000000ca', 'slice8-seed-dedupe',
  NOW(), NOW(), NOW(), 'v1', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;
