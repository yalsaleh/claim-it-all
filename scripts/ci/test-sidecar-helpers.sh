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

# Broken pattern: default entrypoint left as mc, then /bin/sh as first arg.
if grep -nE 'MINIO_MC_IMAGE\}"[[:space:]]*$' -A3 scripts/ci/start-live-sidecars.sh \
  | grep -qE '[[:space:]]/bin/sh'; then
  assert_fail 'does not pass /bin/sh as argument to default mc entrypoint'
else
  assert_ok 'does not pass /bin/sh as argument to default mc entrypoint'
fi

mc_runs="$(grep -c -- '--entrypoint /bin/sh' scripts/ci/start-live-sidecars.sh || true)"
if [[ "${mc_runs}" -ge 3 ]]; then
  assert_ok "all mc docker runs override entrypoint (count=${mc_runs})"
else
  assert_fail "all mc docker runs override entrypoint (count=${mc_runs})"
fi

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
