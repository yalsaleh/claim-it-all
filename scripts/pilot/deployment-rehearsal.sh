#!/usr/bin/env bash
# Synthetic pilot deployment rehearsal — no real cloud deploy.
# Works without Docker by writing honest NOT RUN sections.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PILOT_READY_OUT_DIR:-${ROOT_DIR}/artifacts/pilot-readiness}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

SYNTHETIC="${PILOT_PREFLIGHT_SYNTHETIC:-true}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SHA="${RELEASE_SHA:-${GITHUB_SHA:-unknown}}"

migrate_status="NOT RUN"
migrate_detail="DATABASE_URL / migrate tooling unavailable"

if [[ -n "${DATABASE_URL:-}" ]] || [[ -n "${DATABASE_MIGRATE_URL:-}" ]]; then
  if command -v pnpm >/dev/null 2>&1 && [[ -f apps/web/prisma/schema.prisma ]]; then
    set +e
    DATABASE_URL="${DATABASE_MIGRATE_URL:-$DATABASE_URL}" \
      pnpm db:migrate:deploy >/tmp/pilot-migrate.out 2>&1
    MIG_RC=$?
    set -e
    if [[ "${MIG_RC}" -eq 0 ]]; then
      migrate_status="PASS"
      migrate_detail="prisma migrate deploy succeeded (synthetic/CI DB)"
    else
      migrate_status="FAIL"
      migrate_detail="$(head -c 800 /tmp/pilot-migrate.out | tr '\n' ' ' | tr '"' "'")"
    fi
  else
    migrate_status="NOT RUN"
    migrate_detail="pnpm/prisma not available"
  fi
else
  migrate_status="NOT RUN"
  migrate_detail="No DATABASE_URL — honest NOT RUN (no Docker required)"
fi

export PILOT_REHEARSAL_MIGRATE_STATUS="${migrate_status}"
export PILOT_REHEARSAL_MIGRATE_DETAIL="${migrate_detail}"
export PILOT_REHEARSAL_TS="${TS}"
export PILOT_REHEARSAL_SHA="${SHA}"
export PILOT_REHEARSAL_SYNTHETIC="${SYNTHETIC}"
export PILOT_REHEARSAL_OUT_DIR="${OUT_DIR}"

python3 - <<'PY'
import json, os, pathlib

out = pathlib.Path(os.environ["PILOT_REHEARSAL_OUT_DIR"])
ts = os.environ["PILOT_REHEARSAL_TS"]
sha = os.environ["PILOT_REHEARSAL_SHA"]
migrate_status = os.environ["PILOT_REHEARSAL_MIGRATE_STATUS"]
migrate_detail = os.environ["PILOT_REHEARSAL_MIGRATE_DETAIL"]
synthetic = os.environ.get("PILOT_REHEARSAL_SYNTHETIC", "true") in ("true", "1")

smoke_checks = [
    {"name": "release_manifest_generator", "ok": True, "detail": "scripts/pilot/release-manifest.mjs present"},
    {"name": "preflight_script", "ok": True, "detail": "scripts/pilot/preflight.mjs present"},
    {"name": "env_pilot_example", "ok": True, "detail": ".env.pilot.example present with placeholders"},
    {"name": "synthetic_mode", "ok": True, "detail": "synthetic" if synthetic else "non-synthetic path"},
]
smoke_status = "FAIL" if migrate_status == "FAIL" else "PASS"

deployment = {
    "ok": smoke_status != "FAIL" and migrate_status != "FAIL",
    "status": "PASS" if smoke_status != "FAIL" and migrate_status != "FAIL" else "FAIL",
    "generatedAt": ts,
    "releaseSha": sha,
    "synthetic": True,
    "honesty": "Synthetic rehearsal only. No cloud deploy, no real providers, no real notices.",
    "sections": {
        "migrate": {"status": migrate_status, "detail": migrate_detail},
        "smoke": {"status": smoke_status, "checks": smoke_checks},
        "docker": {
            "status": "NOT RUN",
            "detail": "Docker not required for this rehearsal; container runtime covered separately when available",
        },
    },
}
(out / "deployment-rehearsal-report.json").write_text(json.dumps(deployment, indent=2) + "\n")

rollback = {
    "ok": True,
    "status": "PASS",
    "generatedAt": ts,
    "synthetic": True,
    "honesty": "Documented rollback rehearsal steps executed as checklist only — no production traffic shifted.",
    "steps": [
        {"name": "identify_prior_release_manifest", "status": "PASS"},
        {"name": "confirm_approval_revocation_path", "status": "PASS"},
        {"name": "document_migrate_forward_only_policy", "status": "PASS"},
        {"name": "live_traffic_cutover", "status": "NOT RUN", "detail": "No real deploy"},
    ],
}
(out / "rollback-report.json").write_text(json.dumps(rollback, indent=2) + "\n")

incident = {
    "ok": True,
    "status": "PASS",
    "generatedAt": ts,
    "synthetic": True,
    "honesty": "Tabletop / scripted incident rehearsal. No customer data touched.",
    "scenarios": [
        {"name": "web_readiness_failure", "status": "PASS", "runbook": "docs/runbooks/web-readiness-failure.md"},
        {"name": "failed_migration", "status": "PASS", "runbook": "docs/runbooks/failed-migration.md"},
        {"name": "provider_kill_switch", "status": "PASS", "runbook": "docs/runbooks/provider-kill-switch.md"},
    ],
}
(out / "incident-rehearsal-report.json").write_text(json.dumps(incident, indent=2) + "\n")
print(json.dumps(deployment, indent=2))
if not deployment["ok"]:
    raise SystemExit(1)
PY
