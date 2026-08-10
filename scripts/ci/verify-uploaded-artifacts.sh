#!/usr/bin/env bash
# Download-time independent validation of uploaded workflow artifacts.
# Usage: verify-uploaded-artifacts.sh <artifact-dir> <profile> <expected-sha>
# Profiles: dependency-security | backup-restore | migration-rehearsal | production-readiness
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ART_DIR="${1:?artifact dir}"
PROFILE="${2:?profile}"
EXPECTED_SHA="${3:?expected commit sha}"
OUT_DIR="${ARTIFACT_VERIFY_OUT_DIR:-${ROOT_DIR}/artifacts/artifact-verification}"
mkdir -p "${OUT_DIR}"

python3 - <<PY
import json, pathlib, sys, hashlib, os, re

art = pathlib.Path("${ART_DIR}")
profile = "${PROFILE}"
expected_sha = "${EXPECTED_SHA}".strip().lower()
out_dir = pathlib.Path("${OUT_DIR}")

REQUIRED = {
  "dependency-security": [
    "sbom.json", "pnpm-audit.json", "vulnerability-policy.json",
    "license-inventory.json", "secret-scan.txt", "vulnerability-exceptions.snapshot.json",
  ],
  "backup-restore": [
    "restore-test-report.json", "tenant-isolation-report.json", "rls-force-report.json",
    "object-checksum-summary.json", "object-manifest.json", "backup-manifest.json",
    "database-checksum.txt", "database-backup-metadata.json",
    "application-readiness-report.json", "object-restore-report.json",
    "database-object-reference-report.json",
  ],
  "migration-rehearsal": [
    "slice8-to-slice9-report.json", "migration-drift-report.json", "role-separation-report.json",
    "baseline-commit.txt", "target-commit.txt",
  ],
  "production-readiness": [
    "config-validation.json", "container-hardening.json",
    "web-container-hardening-report.json", "test-purge-safety-report.json",
    "full-service-readiness-report.json", "pilot-readiness-fixture.json",
  ],
}

if profile not in REQUIRED:
    raise SystemExit(f"unknown profile {profile}")

# Artifact may nest under artifacts/<name>/ — search recursively for required basenames.
files = {p.name: p for p in art.rglob("*") if p.is_file()}
listed = sorted(str(p.relative_to(art)) for p in art.rglob("*") if p.is_file())
checks = []
ok = True

for name in REQUIRED[profile]:
    matches = [p for p in art.rglob(name) if p.is_file()]
    if not matches:
        checks.append({"file": name, "ok": False, "reason": "missing"})
        ok = False
        continue
    p = matches[0]
    size = p.stat().st_size
    if size <= 0:
        checks.append({"file": name, "ok": False, "reason": "empty", "path": str(p)})
        ok = False
        continue
    entry = {"file": name, "ok": True, "size": size, "path": str(p.relative_to(art))}
    if p.suffix == ".json":
        try:
            doc = json.loads(p.read_text())
            entry["jsonParsed"] = True
            # Schema-ish: object or array
            if not isinstance(doc, (dict, list)):
                entry["ok"] = False
                entry["reason"] = "json_not_object_or_array"
                ok = False
            # Commit SHA comparison when present
            blob = json.dumps(doc)
            sha_hits = re.findall(r'"?(?:commit|targetCommit|baselineCommit|gitSha|sha)"?\s*[:=]\s*"([0-9a-f]{7,40})"', blob, re.I)
            # Also scan plain text values
            for key in ("commit", "targetCommit", "baselineCommit", "gitSha", "sha", "commitSha"):
                if isinstance(doc, dict) and isinstance(doc.get(key), str) and re.fullmatch(r"[0-9a-f]{7,40}", doc[key], re.I):
                    sha_hits.append(doc[key])
            if sha_hits:
                entry["reportShas"] = sha_hits
                # Accept short or full SHA prefix match against workflow SHA
                matched = any(expected_sha.startswith(h.lower()) or h.lower().startswith(expected_sha[:7]) for h in sha_hits)
                # baselineCommit may be Slice 8 — only enforce target/current style keys
                if any(k in (blob if isinstance(doc, dict) else "") for k in []):
                    pass
                if "targetCommit" in (doc if isinstance(doc, dict) else {}):
                    tc = doc["targetCommit"].lower()
                    if not (expected_sha.startswith(tc) or tc.startswith(expected_sha[:7])):
                        entry["ok"] = False
                        entry["reason"] = f"targetCommit_mismatch:{tc}"
                        ok = False
                if "commitSha" in (doc if isinstance(doc, dict) else {}):
                    cs = doc["commitSha"].lower()
                    if not (expected_sha.startswith(cs) or cs.startswith(expected_sha[:7])):
                        entry["ok"] = False
                        entry["reason"] = f"commitSha_mismatch:{cs}"
                        ok = False
        except Exception as exc:
            entry["ok"] = False
            entry["reason"] = f"json_parse_error:{exc}"
            ok = False
    checks.append(entry)
    if not entry.get("ok", True):
        ok = False

# Digest of archive tree
h = hashlib.sha256()
for rel in listed:
    p = art / rel
    h.update(rel.encode())
    h.update(p.read_bytes())
digest = h.hexdigest()

report = {
  "status": "PASS" if ok else "FAIL",
  "ok": ok,
  "profile": profile,
  "expectedCommitSha": expected_sha,
  "fileCount": len(listed),
  "files": listed,
  "checks": checks,
  "contentDigestSha256": digest,
  "notes": "Post-upload independent extract/list/parse validation. Failure fails the workflow.",
}
out_path = out_dir / f"artifact-verification-{profile}.json"
out_path.write_text(json.dumps(report, indent=2) + "\n")
# Also write/merge final rollup
rollup_path = out_dir / "artifact-verification-report.json"
rollup = {"ok": True, "profiles": {}}
if rollup_path.exists():
    try:
        rollup = json.loads(rollup_path.read_text())
    except Exception:
        pass
rollup.setdefault("profiles", {})[profile] = report
rollup["ok"] = all(p.get("ok") for p in rollup["profiles"].values())
rollup["status"] = "PASS" if rollup["ok"] else "FAIL"
rollup_path.write_text(json.dumps(rollup, indent=2) + "\n")
print(json.dumps(report, indent=2))
sys.exit(0 if ok else 1)
PY
