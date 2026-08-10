#!/usr/bin/env bash
# Static security review of Terraform remote-state bootstrap design.
# Does not apply bootstrap infrastructure.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOT_DIR="${ROOT_DIR}/infrastructure/pilot/terraform/bootstrap"
OUT_DIR="${CLOUD_PILOT_OUT_DIR:-${ROOT_DIR}/artifacts/cloud-pilot}"
REPORT="${OUT_DIR}/terraform-backend-security-report.json"
mkdir -p "${OUT_DIR}"

export BACKEND_SECURITY_ROOT="${ROOT_DIR}"
export BACKEND_SECURITY_REPORT="${REPORT}"
export BACKEND_SECURITY_SHA
BACKEND_SECURITY_SHA="$(git -C "${ROOT_DIR}" rev-parse HEAD 2>/dev/null || echo unknown)"
export BACKEND_SECURITY_TS
BACKEND_SECURITY_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

IDENTITY_STATUS="NOT RUN — AWS identity unavailable"
ACCOUNT=""
if command -v aws >/dev/null 2>&1; then
  set +e
  CALLER="$(aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output json 2>/dev/null)"
  RC=$?
  set -e
  if [[ "${RC}" -eq 0 && -n "${CALLER}" ]]; then
    IDENTITY_STATUS="AVAILABLE"
    ACCOUNT="$(ACCOUNT_JSON="${CALLER}" python3 -c "import json,os; print(json.loads(os.environ['ACCOUNT_JSON']).get('Account',''))")"
  fi
fi
export BACKEND_SECURITY_IDENTITY="${IDENTITY_STATUS}"
export BACKEND_SECURITY_ACCOUNT="${ACCOUNT}"

python3 - <<'PY'
import json, pathlib, re, os

root = pathlib.Path(os.environ["BACKEND_SECURITY_ROOT"])
boot = root / "infrastructure" / "pilot" / "terraform" / "bootstrap"
report_path = pathlib.Path(os.environ["BACKEND_SECURITY_REPORT"])
findings = []
checks = []

required = [
    "versions.tf",
    "providers.tf",
    "variables.tf",
    "main.tf",
    "outputs.tf",
    "README.md",
]
for name in required:
    ok = (boot / name).is_file()
    checks.append({"name": f"bootstrap_file_{name}", "ok": ok})
    if not ok:
        findings.append({"severity": "missing_bootstrap_file", "file": name})

main = (boot / "main.tf").read_text(encoding="utf-8") if (boot / "main.tf").is_file() else ""
patterns = {
    "versioning_enabled": r'versioning_configuration[\s\S]*status\s*=\s*"Enabled"',
    "sse_configured": r"aws_s3_bucket_server_side_encryption_configuration",
    "public_access_block": r"aws_s3_bucket_public_access_block",
    "deny_insecure_transport": r"DenyInsecureTransport|aws:SecureTransport",
    "dynamodb_lock_table": r"aws_dynamodb_table",
    "dynamodb_encryption": r"server_side_encryption",
}
for name, pat in patterns.items():
    ok = re.search(pat, main) is not None
    checks.append({"name": name, "ok": ok})
    if not ok:
        findings.append({"severity": "missing_control", "control": name})

secretish = re.findall(r'(?i)(aws_secret_access_key|password\s*=\s*"[^"]+")', main)
checks.append({"name": "no_hardcoded_secrets_in_main", "ok": len(secretish) == 0})
if secretish:
    findings.append({"severity": "possible_secret_in_tf", "count": len(secretish)})

backend_example = root / "infrastructure" / "pilot" / "terraform" / "backend.hcl.example"
checks.append({"name": "backend_hcl_example_present", "ok": backend_example.is_file()})

versions = (root / "infrastructure" / "pilot" / "terraform" / "versions.tf").read_text(encoding="utf-8")
checks.append({"name": "pilot_partial_s3_backend", "ok": 'backend "s3"' in versions})

identity_status = os.environ["BACKEND_SECURITY_IDENTITY"]
account = os.environ.get("BACKEND_SECURITY_ACCOUNT") or None
status = "PASSED" if not findings else "FAILED"
detail = (
    "Bootstrap IaC static controls reviewed; bootstrap apply NOT RUN — AWS identity unavailable"
    if identity_status.startswith("NOT RUN")
    else "Bootstrap IaC static controls reviewed; live bootstrap apply still requires human approval"
)

doc = {
    "ok": len(findings) == 0,
    "status": status,
    "detail": detail,
    "gitSha": os.environ["BACKEND_SECURITY_SHA"],
    "environment": "PILOT",
    "awsAccountId": account,
    "region": os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"),
    "timestamp": os.environ["BACKEND_SECURITY_TS"],
    "identityStatus": identity_status,
    "bootstrapApplyExecuted": False,
    "checks": checks,
    "findings": findings,
    "procedure": [
        "bootstrap state infrastructure (local state)",
        "initialize pilot backend via backend.hcl",
        "validate account/region",
        "plan",
        "approval",
        "apply",
    ],
    "honesty": "Does not fabricate remote state. Live bucket/table creation requires AWS identity.",
}
report_path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if doc["ok"] else 1)
PY
