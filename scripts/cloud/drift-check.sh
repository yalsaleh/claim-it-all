#!/usr/bin/env bash
# Static + optional terraform plan drift check. Never auto-remediates.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/pilot/terraform"
OUT_DIR="${CLOUD_PILOT_OUT_DIR:-${ROOT_DIR}/artifacts/cloud-pilot}"
REPORT="${OUT_DIR}/infrastructure-drift-report.json"
mkdir -p "${OUT_DIR}"

write_report() {
  local status="$1"
  local detail="$2"
  local ok="$3"
  STATUS="${status}" DETAIL="${detail}" OK="${ok}" REPORT_PATH="${REPORT}" python3 - <<'PY'
import json, os
doc = {
  "ok": os.environ["OK"] == "True",
  "status": os.environ["STATUS"],
  "detail": os.environ["DETAIL"],
  "autoRemediate": False,
  "checks": [
    "terraform_source_present",
    "security_group_static_open_cidr",
    "public_bucket_policy_static",
    "public_db_static",
    "public_redis_static",
  ],
  "livePlanDrift": "NOT RUN unless AWS identity + terraform plan configured",
  "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
}
open(os.environ["REPORT_PATH"], "w").write(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
PY
}

if [[ ! -d "${TF_DIR}" ]]; then
  write_report "FAILED" "Missing terraform directory" "False"
  exit 1
fi

# Reuse static network security (open CIDR / public exposure patterns).
if ! bash "${ROOT_DIR}/scripts/cloud/network-security-check.sh" >/dev/null; then
  write_report "FAILED" "network-security-check failed" "False"
  exit 1
fi

if [[ -z "${AWS_ACCESS_KEY_ID:-}${AWS_PROFILE:-}${AWS_ROLE_ARN:-}" ]]; then
  write_report "NOT RUN" "No AWS identity; static IaC drift heuristics only" "True"
  exit 0
fi

write_report "NOT RUN" "AWS identity present but live terraform plan drift not enabled in this scaffold" "True"
exit 0
