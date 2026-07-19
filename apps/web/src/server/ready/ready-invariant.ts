/**
 * Document READY invariant (Slice 2B).
 *
 * A SourceDocument may display READY only when ALL of the following hold:
 * 1. currentVersion exists
 * 2. version.uploadStatus === 'ACCEPTED'
 * 3. version.malwareScanStatus === 'CLEAN'
 * 4. version.storageKey is under the originals prefix (not quarantine)
 * 5. latest processing run for that version is SUCCEEDED
 * 6. at least one PLAIN_TEXT (or equivalent) derived artifact exists for the run
 * 7. evidence segments are present when the extractor reported segments
 *
 * READY must never be set for INFECTED, ERROR, SKIPPED, unscanned, or
 * promotion-failed versions. Partial extraction uses PARTIALLY_PROCESSED.
 */

export type ReadyInvariantInput = {
  documentStatus: string;
  uploadStatus: string;
  malwareScanStatus: string;
  storageKey: string;
  processingRunStatus: string;
  hasDerivedArtifact: boolean;
};

export function satisfiesReadyInvariant(input: ReadyInvariantInput): boolean {
  if (input.documentStatus !== 'READY') return false;
  if (input.uploadStatus !== 'ACCEPTED') return false;
  if (input.malwareScanStatus !== 'CLEAN') return false;
  if (!input.storageKey.includes('/originals/')) return false;
  if (input.storageKey.includes('/quarantine/')) return false;
  if (input.processingRunStatus !== 'SUCCEEDED') return false;
  if (!input.hasDerivedArtifact) return false;
  return true;
}
