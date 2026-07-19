# ADR-021 — Upload architecture

## Status
Accepted (Slice 2)

## Decision
Direct-to-object-storage upload with short-lived presigned PUT URLs.

1. Authenticated initiate → `UploadSession` + quarantine key + signed PUT
2. Browser PUTs bytes to storage
3. Server independently HEADs object, streams bytes, verifies size/checksum/magic
4. Version remains `VALIDATING` on quarantine key until malware scan is CLEAN
5. Worker promotes to `originals/` and sets `ACCEPTED`

Browser “upload complete” alone never accepts a file.
