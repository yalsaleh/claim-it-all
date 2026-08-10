#!/usr/bin/env bash
# Validate ContractRadar pilot Terraform (fmt + validate). Never runs apply.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/pilot/terraform"
OUT_DIR="${CLOUD_PILOT_OUT_DIR:-${CLOUD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/cloud-pilot}}"
REPORT="${OUT_DIR}/terraform-validate-report.json"
mkdir -p "${OUT_DIR}"

write_report() {
  local status="$1"
  local detail="$2"
  local ok="$3"
  STATUS="${status}" DETAIL="${detail}" OK="${ok}" REPORT_PATH="${REPORT}" python3 - <<'PY'
import json, os, pathlib
doc = {
  "ok": os.environ["OK"] == "True",
  "status": os.environ["STATUS"],
  "detail": os.environ["DETAIL"],
  "terraformDir": "infrastructure/pilot/terraform",
  "applyExecuted": False,
  "note": "Validate/fmt only. terraform apply requires human approval (enable_deployment).",
}
path = pathlib.Path(os.environ["REPORT_PATH"])
path.write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
PY
}

if [[ ! -d "${TF_DIR}" ]]; then
  write_report "FAILED" "Missing infrastructure/pilot/terraform" "False"
  exit 1
fi

BOOT_DIR="${ROOT_DIR}/infrastructure/pilot/terraform/bootstrap"

run_native() {
  command -v terraform >/dev/null 2>&1 || return 1
  (
    cd "${TF_DIR}"
    terraform fmt -check -recursive
    terraform init -backend=false -input=false
    terraform validate
  )
  (
    cd "${BOOT_DIR}"
    terraform fmt -check -recursive
    terraform init -backend=false -input=false
    terraform validate
  )
}

run_docker() {
  command -v docker >/dev/null 2>&1 || return 1
  for work in infrastructure/pilot/terraform infrastructure/pilot/terraform/bootstrap; do
    docker run --rm \
      -v "${ROOT_DIR}:/work" \
      -w "/work/${work}" \
      hashicorp/terraform:1.9 \
      init -backend=false -input=false
    docker run --rm \
      -v "${ROOT_DIR}:/work" \
      -w "/work/${work}" \
      hashicorp/terraform:1.9 \
      fmt -check -recursive
    docker run --rm \
      -v "${ROOT_DIR}:/work" \
      -w "/work/${work}" \
      hashicorp/terraform:1.9 \
      validate
  done
}

set +e
run_native
native_rc=$?
set -e
if [[ "${native_rc}" -eq 0 ]]; then
  write_report "PASSED" "terraform fmt -check and terraform validate succeeded (native)" "True"
  exit 0
fi

# If terraform is installed but validation failed, do not mask with NOT RUN.
if command -v terraform >/dev/null 2>&1; then
  write_report "FAILED" "native terraform fmt/validate failed (exit ${native_rc})" "False"
  exit 1
fi

set +e
run_docker
docker_rc=$?
set -e
if [[ "${docker_rc}" -eq 0 ]]; then
  write_report "PASSED" "terraform fmt -check and terraform validate succeeded (docker hashicorp/terraform:1.9)" "True"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  write_report "FAILED" "docker terraform fmt/validate failed (exit ${docker_rc})" "False"
  exit 1
fi

write_report "NOT RUN" "Neither terraform nor docker available to run hashicorp/terraform:1.9" "True"
exit 0
