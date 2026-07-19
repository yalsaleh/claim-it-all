#!/usr/bin/env bash
# Focused validation for MinIO mc invocation construction and cleanup behavior.
# Does not require Docker daemon.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
PASS=0
FAIL=0

assert_ok() {
  local label="$1"
  echo "PASS ${label}"
  PASS=$((PASS + 1))
}

assert_fail() {
  local label="$1"
  echo "FAIL ${label}"
  FAIL=$((FAIL + 1))
}

echo "==> MinIO mc command construction in start-live-sidecars.sh"
START_SCRIPT="$(cat scripts/ci/start-live-sidecars.sh)"

if grep -Fq -- '--entrypoint /bin/sh' <<<"${START_SCRIPT}"; then
  assert_ok 'uses --entrypoint /bin/sh for mc'
else
  assert_fail 'uses --entrypoint /bin/sh for mc'
fi

if grep -Fq 'mc alias set local' <<<"${START_SCRIPT}"; then
  assert_ok 'runs mc alias set inside shell'
else
  assert_fail 'runs mc alias set inside shell'
fi

if grep -Fq 'mc anonymous set none' <<<"${START_SCRIPT}"; then
  assert_ok 'sets anonymous none'
else
  assert_fail 'sets anonymous none'
fi

if grep -Fq 'unauthenticated_list_http' <<<"${START_SCRIPT}"; then
  assert_ok 'verifies unauthenticated HTTP deny'
else
  assert_fail 'verifies unauthenticated HTTP deny'
fi

if grep -Fq 'OK bucket init idempotent' <<<"${START_SCRIPT}"; then
  assert_ok 're-runs bucket init for idempotency'
else
  assert_fail 're-runs bucket init for idempotency'
fi

# Broken pattern from a2bb4ea: image then /bin/sh without --entrypoint in the same run.
set +e
python3 - <<'PY'
from pathlib import Path
import re
import sys
text = Path("scripts/ci/start-live-sidecars.sh").read_text()
bad = []
for chunk in text.split("docker run"):
    if "MINIO_MC_IMAGE" not in chunk:
        continue
    block = "docker run" + chunk.split("\necho ")[0].split("\nif ")[0]
    if "--entrypoint /bin/sh" not in block:
        bad.append("missing --entrypoint in mc docker run")
    if re.search(r'MINIO_MC_IMAGE\}"\s*\\\s*\n\s*/bin/sh\b', block):
        bad.append("passes /bin/sh after image as mc argv")
if bad:
    print("FAIL old mc /bin/sh pattern:", "; ".join(bad))
    sys.exit(2)
print("OK no pre-fix mc /bin/sh argv pattern")
PY
py_rc=$?
set -e
if [[ "${py_rc}" -eq 0 ]]; then
  assert_ok 'rejects pre-fix mc /bin/sh-as-argument pattern'
else
  assert_fail 'rejects pre-fix mc /bin/sh-as-argument pattern'
fi

mc_runs="$(grep -c -- '--entrypoint /bin/sh' scripts/ci/start-live-sidecars.sh || true)"
if [[ "${mc_runs}" -ge 3 ]]; then
  assert_ok "all mc docker runs override entrypoint (count=${mc_runs})"
else
  assert_fail "all mc docker runs override entrypoint (count=${mc_runs})"
fi

if grep -Fq 'git -C "${ROOT_DIR}" rev-parse --short HEAD' scripts/ci/start-live-sidecars.sh \
  || grep -Fq "git -C \"\${ROOT_DIR}\" rev-parse --short HEAD" scripts/ci/start-live-sidecars.sh; then
  assert_ok 'prints runtime git rev-parse commit diagnostic'
else
  assert_fail 'prints runtime git rev-parse commit diagnostic'
fi

if grep -Fq '*private*|*none*)' scripts/ci/start-live-sidecars.sh; then
  assert_ok 'privacy validation uses Bash case on runner'
else
  assert_fail 'privacy validation uses Bash case on runner'
fi

# grep must not appear in any minio/mc docker -c payload (regression of 9d08182).
if grep -nE 'MINIO_MC_IMAGE' -A20 scripts/ci/start-live-sidecars.sh | grep -E "^\s*(grep|sed|awk|jq)\b" >/dev/null; then
  assert_fail 'no grep/sed/awk/jq beside MINIO_MC_IMAGE docker runs'
else
  assert_ok 'no grep/sed/awk/jq beside MINIO_MC_IMAGE docker runs'
fi

echo "==> No grep/sed/awk inside minio/mc -c payloads"
set +e
python3 - <<'PY'
from pathlib import Path
import re
import sys
text = Path("scripts/ci/start-live-sidecars.sh").read_text()
# Extract single-quoted -c '...' payloads after MINIO_MC_IMAGE docker runs.
bad = []
for m in re.finditer(r'MINIO_MC_IMAGE\}"\s*\\\s*\n\s*-c\s+\'(.*?)\'', text, re.S):
    payload = m.group(1)
    for util in ("grep", "sed", "awk", "curl", "bash", "jq"):
        if re.search(rf'\b{util}\b', payload):
            bad.append(f"{util} in mc -c payload")
if bad:
    print("FAIL:", "; ".join(bad))
    sys.exit(2)
print("OK mc -c payloads avoid runner-only utilities")
PY
payload_rc=$?
set -e
if [[ "${payload_rc}" -eq 0 ]]; then
  assert_ok 'mc container scripts do not use grep/sed/awk/curl/bash/jq'
else
  assert_fail 'mc container scripts do not use grep/sed/awk/curl/bash/jq'
fi

echo "==> Privacy policy parsing (runner-side)"
# shellcheck disable=SC1091
source scripts/ci/sidecar-helpers.sh

set +e
assert_minio_anonymous_private 'Access permission for `local/contractradar-documents` is `private`' >/dev/null
rc_private=$?
assert_minio_anonymous_private 'Access permission for `local/contractradar-documents` is `none`' >/dev/null
rc_none=$?
assert_minio_anonymous_private 'Access permission for `local/x` is `download`' >/dev/null
rc_download=$?
assert_minio_anonymous_private 'Access permission for `local/x` is `public`' >/dev/null
rc_public=$?
assert_minio_anonymous_private '' >/dev/null
rc_empty=$?
assert_minio_anonymous_private '   ' >/dev/null
rc_blank=$?
set -e

if [[ "${rc_private}" -eq 0 ]]; then assert_ok 'accepts real private response'; else assert_fail 'accepts real private response'; fi
if [[ "${rc_none}" -eq 0 ]]; then assert_ok 'accepts none response'; else assert_fail 'accepts none response'; fi
if [[ "${rc_download}" -ne 0 ]]; then assert_ok 'rejects download/public-read policy'; else assert_fail 'rejects download/public-read policy'; fi
if [[ "${rc_public}" -ne 0 ]]; then assert_ok 'rejects public policy'; else assert_fail 'rejects public policy'; fi
if [[ "${rc_empty}" -ne 0 ]]; then assert_ok 'empty policy fails closed'; else assert_fail 'empty policy fails closed'; fi
if [[ "${rc_blank}" -ne 0 ]]; then assert_ok 'blank policy fails closed'; else assert_fail 'blank policy fails closed'; fi

echo "==> Cleanup helpers with mocked docker"
TMP_BIN="$(mktemp -d)"
cleanup() { rm -rf "${TMP_BIN}"; }
trap cleanup EXIT

cat >"${TMP_BIN}/docker" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-}"
shift || true
case "${cmd}" in
  inspect)
    if [[ "${1:-}" == "contractradar-ci-minio" ]]; then
      exit 0
    fi
    echo "Error: No such container: ${1:-}" >&2
    exit 1
    ;;
  rm)
    exit 0
    ;;
  logs)
    name=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --tail) shift 2 || true ;;
        *) name="$1"; shift ;;
      esac
    done
    if [[ "${name}" == "contractradar-ci-clamav" ]]; then
      echo "Error response from daemon: No such container: contractradar-ci-clamav" >&2
      exit 1
    fi
    echo "mock logs for ${name}"
    exit 0
    ;;
  ps)
    exit 0
    ;;
  *)
    echo "unexpected docker $*" >&2
    exit 99
    ;;
esac
EOS
chmod +x "${TMP_BIN}/docker"
export PATH="${TMP_BIN}:${PATH}"

# shellcheck disable=SC1091
source scripts/ci/sidecar-helpers.sh

logs_out="$(safe_docker_logs contractradar-ci-clamav 20 2>&1 || true)"
if grep -Fq 'does not exist' <<<"${logs_out}" && ! grep -Fq 'Error response from daemon' <<<"${logs_out}"; then
  assert_ok 'safe_docker_logs skips missing clamav without daemon error'
else
  assert_fail 'safe_docker_logs skips missing clamav without daemon error'
fi

set +e
false
rc=$?
set -e
stop_live_sidecars >/dev/null
final=$rc
if [[ "${final}" -eq 1 ]]; then
  assert_ok 'cleanup preserves original failure code'
else
  assert_fail "cleanup preserves original failure code (got ${final})"
fi

echo "==> Compose minio-init entrypoint"
if grep -A20 'minio-init:' infrastructure/docker/docker-compose.yml | grep -Fq 'entrypoint:'; then
  assert_ok 'compose minio-init sets entrypoint'
else
  assert_fail 'compose minio-init sets entrypoint'
fi
if grep -A20 'minio-init:' infrastructure/docker/docker-compose.yml | grep -Fq '/bin/sh'; then
  assert_ok 'compose minio-init uses shell entrypoint'
else
  assert_fail 'compose minio-init uses shell entrypoint'
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi
