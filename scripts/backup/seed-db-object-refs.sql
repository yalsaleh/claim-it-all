-- Seed DB rows with object-store references for synthetic restore verification.
-- Requires: restore tenants/projects/users already present; app.bypass_rls=on.
-- Placeholders substituted by restore-test.sh via envsubst-style sed.

SELECT set_config('app.bypass_rls', 'on', false);

INSERT INTO source_document (id, "tenantId", "projectId", title, "documentType", "createdByUserId", "createdAt", "updatedAt")
VALUES (
  'd1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'Restore Ref Doc', 'CONTRACT',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (
  id, "tenantId", "projectId", "sourceDocumentId", "versionNumber",
  "originalFilename", "normalizedFilename", "mediaType", extension,
  "sizeBytes", sha256, "storageBucket", "storageKey", "uploadedByUserId", "uploadedAt", "createdAt",
  "uploadStatus", "malwareScanStatus"
) VALUES (
  'v1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111', 1,
  'promoted-clean.bin', 'promoted-clean.bin', 'application/octet-stream', 'bin',
  64, '__SHA_PROMOTED__', 'contractradar-documents', '__OBJ_PROMOTED_KEY__',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW(),
  'ACCEPTED', 'CLEAN'
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", sha256 = EXCLUDED.sha256;

UPDATE source_document SET "currentVersionId" = 'v1111111-1111-4111-8111-111111111111'
WHERE id = 'd1111111-1111-4111-8111-111111111111';

INSERT INTO upload_session (
  id, "tenantId", "projectId", "initiatedByUserId", "sourceDocumentId", "documentVersionId",
  "intendedFilename", "declaredMediaType", "declaredSizeBytes", "expectedSha256",
  "storageKey", "storageBucket", status, "expiresAt", "createdAt", "updatedAt"
) VALUES (
  'u1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'd1111111-1111-4111-8111-111111111111',
  'v1111111-1111-4111-8111-111111111111',
  'original-upload.bin', 'application/octet-stream', 32, '__SHA_ORIG__',
  '__OBJ_ORIG_KEY__', 'contractradar-documents', 'COMPLETED', NOW() + interval '1 day', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", "expectedSha256" = EXCLUDED."expectedSha256";

INSERT INTO document_processing_run (
  id, "tenantId", "projectId", "documentVersionId", "processorName", "processorVersion",
  status, "correlationId", "createdAt"
) VALUES (
  'r1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'v1111111-1111-4111-8111-111111111111',
  'restore-seed', 'v1', 'SUCCEEDED', 'restore-corr-1', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO extracted_artifact (
  id, "tenantId", "projectId", "documentVersionId", "processingRunId",
  "artifactType", "mediaType", "storageBucket", "storageKey", sha256, "sizeBytes",
  "processorName", "processorVersion", "createdAt"
) VALUES (
  'e1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'v1111111-1111-4111-8111-111111111111',
  'r1111111-1111-4111-8111-111111111111',
  'TEXT', 'text/plain', 'contractradar-documents', '__OBJ_ARTIFACT_KEY__',
  '__SHA_ARTIFACT__', 64, 'restore-seed', 'v1', NOW()
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", sha256 = EXCLUDED.sha256;

INSERT INTO contract_package (id, "tenantId", "projectId", name, "createdByUserId", "createdAt", "updatedAt")
VALUES (
  'p1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'Restore Package', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_configuration_revision (
  id, "tenantId", "projectId", "contractPackageId", "revisionNumber", "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  'cr111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111', 1,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_document (
  id, "tenantId", "projectId", "contractPackageId", "sourceDocumentId", "documentVersionId",
  "contractDocumentType", title, "createdAt", "updatedAt"
) VALUES (
  'cd111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'v1111111-1111-4111-8111-111111111111',
  'AGREEMENT', 'Restore Agreement', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_clause (
  id, "tenantId", "projectId", "contractPackageId", "contractDocumentId", "documentVersionId",
  "sourceText", "textChecksum", "createdAt", "updatedAt"
) VALUES (
  'cl111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cd111111-1111-4111-8111-111111111111',
  'v1111111-1111-4111-8111-111111111111',
  'Notice within 14 days', repeat('b', 64), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_obligation (
  id, "tenantId", "projectId", "contractPackageId", "sourceClauseId", "obligationType",
  "actionDescription", "createdAt", "updatedAt"
) VALUES (
  'ob111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cl111111-1111-4111-8111-111111111111',
  'NOTICE', 'Give notice', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_rule (
  id, "tenantId", "projectId", "contractPackageId", "obligationId", "createdAt", "updatedAt"
) VALUES (
  'nr111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'ob111111-1111-4111-8111-111111111111', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO approved_notice_rule_snapshot (
  id, "tenantId", "projectId", "contractPackageId", "configurationRevisionId",
  "sourceNoticeRuleId", "sourceObligationId", "countingConvention", "timeBarClassification",
  "ambiguityStatus", "structuredRule", "createdAt"
) VALUES (
  'as111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cr111111-1111-4111-8111-111111111111',
  'nr111111-1111-4111-8111-111111111111',
  'ob111111-1111-4111-8111-111111111111',
  'UNSPECIFIED', 'UNCERTAIN', 'UNRESOLVED', '{}'::jsonb, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_event (
  id, "tenantId", "projectId", "contractPackageId", title, "eventCategory",
  "eventStatus", "confirmationStatus", timezone, "reportedByUserId",
  "confirmedByUserId", "confirmedAt", "createdAt", "updatedAt"
) VALUES (
  'ev111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'Restore event', 'INSTRUCTION', 'CONFIRMED', 'CONFIRMED_FACT', 'Asia/Dubai',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_rule_assessment (
  id, "tenantId", "projectId", "projectEventId", "contractPackageId",
  "configurationRevisionId", "approvedRuleSnapshotId", "assessmentSource", "createdAt", "updatedAt"
) VALUES (
  'ea111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'ev111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cr111111-1111-4111-8111-111111111111',
  'as111111-1111-4111-8111-111111111111',
  'HUMAN_SELECTED', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_calendar (
  id, "tenantId", "projectId", name, timezone, "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  'cal11111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'Default', 'Asia/Dubai', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_calendar_revision (
  id, "tenantId", "projectId", "projectCalendarId", "revisionNumber", timezone, "weekendDays",
  "createdAt", "updatedAt"
) VALUES (
  'crr11111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'cal11111-1111-4111-8111-111111111111', 1, 'Asia/Dubai', '[5,6]'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO deadline_calculation (
  id, "tenantId", "projectId", "projectEventId", "eventRuleAssessmentId",
  "contractPackageId", "configurationRevisionId", "approvedRuleSnapshotId",
  "calendarRevisionId", "projectCalendarId", "triggerDateType", "triggerDateValue",
  "triggerTimezone", "deadlineTimezone", "calculationTrace", "calculatedByUserId",
  "createdAt", "updatedAt"
) VALUES (
  'dc111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'ev111111-1111-4111-8111-111111111111',
  'ea111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cr111111-1111-4111-8111-111111111111',
  'as111111-1111-4111-8111-111111111111',
  'crr11111-1111-4111-8111-111111111111',
  'cal11111-1111-4111-8111-111111111111',
  'OCCURRENCE_DATE', NOW(), 'Asia/Dubai', 'Asia/Dubai', '{"seed":true}'::jsonb,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_deadline (
  id, "tenantId", "projectId", "projectEventId", "contractPackageId",
  "deadlineCalculationId", title, "deadlineType", timezone, "createdAt", "updatedAt"
) VALUES (
  'dl111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'ev111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'dc111111-1111-4111-8111-111111111111',
  'Notice deadline', 'NOTICE', 'Asia/Dubai', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_package (
  id, "tenantId", "projectId", "contractPackageId", "configurationRevisionId",
  "approvedNoticeRuleSnapshotId", "projectEventId", "eventRuleAssessmentId",
  "deadlineCalculationId", "projectDeadlineId", "noticeType", title, language,
  "createdByUserId", "createdAt", "updatedAt"
) VALUES (
  'np111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'p1111111-1111-4111-8111-111111111111',
  'cr111111-1111-4111-8111-111111111111',
  'as111111-1111-4111-8111-111111111111',
  'ev111111-1111-4111-8111-111111111111',
  'ea111111-1111-4111-8111-111111111111',
  'dc111111-1111-4111-8111-111111111111',
  'dl111111-1111-4111-8111-111111111111',
  'NOTICE_OF_DELAY', 'Restore Notice', 'en',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_draft_revision (
  id, "tenantId", "projectId", "noticePackageId", "revisionNumber",
  language, "templateVersion", "generatedBy", "generatorVersion",
  "createdByUserId", "createdAt"
) VALUES (
  'nd111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'np111111-1111-4111-8111-111111111111', 1,
  'en', 'v1', 'seed', 'v1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_export_bundle (
  id, "tenantId", "projectId", "noticePackageId", "draftRevisionId",
  format, "artifactChecksum", "storageKey", manifest, "templateVersion",
  "generatedByUserId", language, "generatedAt"
) VALUES (
  'ne111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'np111111-1111-4111-8111-111111111111',
  'nd111111-1111-4111-8111-111111111111',
  'PDF', '__SHA_EXPORT__', '__OBJ_EXPORT_KEY__',
  '{"seed":true,"bundleObjectKey":"__OBJ_BUNDLE_KEY__","bundleChecksum":"__SHA_BUNDLE__"}'::jsonb,
  'v1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'en', NOW()
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", "artifactChecksum" = EXCLUDED."artifactChecksum";

INSERT INTO notice_dispatch_package_snapshot (
  id, "tenantId", "projectId", "noticePackageId", "approvedDraftRevisionId", "noticeExportId",
  "exportManifestChecksum", "bundleChecksum", "noticeChecksum", "attachmentManifestChecksum",
  "templateVersion", language, subject, "recipientSnapshot", "copiedRecipientSnapshot",
  "deliveryMethodSnapshot", "attachmentSnapshot", "coverMessageSnapshot", channel, "createdByUserId", "createdAt"
) VALUES (
  'ns111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'np111111-1111-4111-8111-111111111111',
  'nd111111-1111-4111-8111-111111111111',
  'ne111111-1111-4111-8111-111111111111',
  '__SHA_BUNDLE__', '__SHA_BUNDLE__', '__SHA_EXPORT__', '__SHA_BUNDLE__',
  'v1', 'en', 'Restore Notice', '[]'::jsonb, '[]'::jsonb,
  '{}'::jsonb, '[{"storageKey":"__OBJ_BUNDLE_KEY__","checksum":"__SHA_BUNDLE__"}]'::jsonb,
  '{}'::jsonb, 'email', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_dispatch_authorization (
  id, "tenantId", "projectId", "noticePackageId", "dispatchPackageSnapshotId",
  "requestedByUserId", "selectedChannel", "recipientCount", "copiedRecipientCount", "createdAt", "updatedAt"
) VALUES (
  'na111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'np111111-1111-4111-8111-111111111111',
  'ns111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'email', 1, 0, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notice_dispatch_attempt (
  id, "tenantId", "projectId", "noticePackageId", "dispatchAuthorizationId",
  "dispatchPackageSnapshotId", "attemptNumber", channel, provider,
  "initiatedByUserId", "correlationId", "idempotencyKey", "createdAt"
) VALUES (
  'da111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'np111111-1111-4111-8111-111111111111',
  'na111111-1111-4111-8111-111111111111',
  'ns111111-1111-4111-8111-111111111111',
  1, 'email', 'fake',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'restore-corr', 'restore-idem-1', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO dispatch_evidence (
  id, "tenantId", "projectId", "dispatchAttemptId", "evidenceType",
  "storageKey", "checksumSha256", "recordedByUserId", "capturedAt", "createdAt"
) VALUES (
  'de111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'da111111-1111-4111-8111-111111111111',
  'EMAIL_PROVIDER_ACCEPTANCE',
  '__OBJ_DISPATCH_KEY__', '__SHA_DISPATCH__',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", "checksumSha256" = EXCLUDED."checksumSha256";

INSERT INTO connector_account (
  id, "tenantId", "connectorType", "displayName", provider, "secretReference",
  "configuredByUserId", "createdAt", "updatedAt"
) VALUES (
  'ca111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'email', 'Restore Mailbox', 'microsoft365', 'secret://ci/restore',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO connector_project_scope (
  id, "tenantId", "projectId", "connectorAccountId", "externalMailboxOrFolder",
  "includeRules", "excludeRules", "approvedDocumentTypes", "configuredByUserId", "createdAt", "updatedAt"
) VALUES (
  'cs111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'ca111111-1111-4111-8111-111111111111', 'Inbox',
  '[]'::jsonb, '[]'::jsonb, '["LETTER"]'::jsonb,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (
  id, "tenantId", "projectId", "sourceDocumentId", "versionNumber",
  "originalFilename", "normalizedFilename", "mediaType", extension,
  "sizeBytes", sha256, "storageBucket", "storageKey", "uploadedByUserId", "uploadedAt", "createdAt"
) VALUES (
  'v2222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111', 2,
  'imported.bin', 'imported.bin', 'application/octet-stream', 'bin',
  32, '__SHA_CONNECTOR__', 'contractradar-documents', '__OBJ_CONNECTOR_KEY__',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET "storageKey" = EXCLUDED."storageKey", sha256 = EXCLUDED.sha256;

INSERT INTO external_record (
  id, "tenantId", "projectId", "connectorAccountId", "connectorProjectScopeId",
  "externalSystem", "externalRecordId", "recordType", "externalVersionId",
  "importedChecksum", "importStatus", "sourceDocumentId", "documentVersionId",
  "firstSeenAt", "lastSeenAt", "importedAt", "createdAt", "updatedAt"
) VALUES (
  'er111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'ca111111-1111-4111-8111-111111111111',
  'cs111111-1111-4111-8111-111111111111',
  'microsoft365', 'ext-1', 'EMAIL', 'v1',
  '__SHA_CONNECTOR__', 'IMPORTED',
  'd1111111-1111-4111-8111-111111111111',
  'v2222222-2222-4222-8222-222222222222',
  NOW(), NOW(), NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;
