import { createHash } from 'node:crypto';
import type { ExternalRecordType } from './types';

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function checksumContent(content: string | Buffer): string {
  return sha256Hex(content);
}

export function buildExternalRecordKey(input: {
  providerKind: string;
  tenantId: string;
  recordType: ExternalRecordType;
  externalId: string;
}): string {
  return sha256Hex(
    `${input.providerKind}|${input.tenantId}|${input.recordType}|${input.externalId}`,
  );
}

export function buildAttachmentKey(input: {
  externalRecordKey: string;
  attachmentId: string;
}): string {
  return sha256Hex(`${input.externalRecordKey}|attachment|${input.attachmentId}`);
}

export function buildSyncRunKey(input: {
  connectorId: string;
  runNumber: number;
  direction: string;
}): string {
  return sha256Hex(`${input.connectorId}|${input.runNumber}|${input.direction}`);
}
