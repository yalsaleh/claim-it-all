import { randomBytes } from 'node:crypto';

function assertNoTraversal(part: string): string {
  if (!part || part.includes('..') || part.includes('/') || part.includes('\\')) {
    throw new Error('STORAGE_KEY_INVALID_PART');
  }
  return part;
}

/** Non-enumerable, tenant/project-partitioned key for quarantine originals. */
export function buildQuarantineObjectKey(input: {
  tenantId: string;
  projectId: string;
  uploadSessionId: string;
}): string {
  const objectId = randomBytes(16).toString('hex');
  return [
    'tenants',
    assertNoTraversal(input.tenantId),
    'projects',
    assertNoTraversal(input.projectId),
    'quarantine',
    assertNoTraversal(input.uploadSessionId),
    objectId,
  ].join('/');
}

/** Final immutable original key after acceptance (still non-enumerable). */
export function buildOriginalObjectKey(input: {
  tenantId: string;
  projectId: string;
  documentVersionId: string;
}): string {
  const objectId = randomBytes(16).toString('hex');
  return [
    'tenants',
    assertNoTraversal(input.tenantId),
    'projects',
    assertNoTraversal(input.projectId),
    'originals',
    assertNoTraversal(input.documentVersionId),
    objectId,
  ].join('/');
}

export function buildDerivedObjectKey(input: {
  tenantId: string;
  projectId: string;
  documentVersionId: string;
  processingRunId: string;
  artifactId: string;
}): string {
  return [
    'tenants',
    assertNoTraversal(input.tenantId),
    'projects',
    assertNoTraversal(input.projectId),
    'derived',
    assertNoTraversal(input.documentVersionId),
    assertNoTraversal(input.processingRunId),
    assertNoTraversal(input.artifactId),
  ].join('/');
}
