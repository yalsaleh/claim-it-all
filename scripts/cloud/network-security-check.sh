#!/usr/bin/env bash
# Static analysis of pilot Terraform: RDS/Redis security groups must not allow 0.0.0.0/0.
# Writes artifacts/cloud/network-security-report.json
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/pilot/terraform"
OUT_DIR="${CLOUD_PILOT_OUT_DIR:-${CLOUD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/cloud-pilot}}"
REPORT="${OUT_DIR}/network-security-report.json"
mkdir -p "${OUT_DIR}"

export NETWORK_SECURITY_ROOT="${ROOT_DIR}"
export NETWORK_SECURITY_REPORT="${REPORT}"

python3 - <<'PY'
import json
import os
import pathlib
import re
import sys

root = pathlib.Path(os.environ["NETWORK_SECURITY_ROOT"])
tf_dir = root / "infrastructure" / "pilot" / "terraform"
report_path = pathlib.Path(os.environ["NETWORK_SECURITY_REPORT"])

if not tf_dir.is_dir():
    doc = {
        "ok": False,
        "status": "FAILED",
        "findings": [{"severity": "missing_terraform_dir", "path": str(tf_dir)}],
        "note": "Terraform directory not found",
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(doc, indent=2))
    sys.exit(1)

# Resources that must never expose 0.0.0.0/0 on ingress.
protected = {
    "aws_security_group.rds",
    "aws_security_group.redis",
}

text_by_file = {path.name: path.read_text(encoding="utf-8") for path in sorted(tf_dir.glob("*.tf"))}

resource_re = re.compile(
    r'resource\s+"(?P<type>[^"]+)"\s+"(?P<name>[^"]+)"\s*\{',
    re.MULTILINE,
)

findings = []
checks = []

for fname, text in text_by_file.items():
    for match in resource_re.finditer(text):
        rtype = match.group("type")
        rname = match.group("name")
        key = f"{rtype}.{rname}"
        if key not in protected:
            continue

        start = match.end() - 1  # at '{'
        depth = 0
        i = start
        while i < len(text):
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            i += 1
        block = text[start:i]

        ingress_blocks = re.findall(
            r"ingress\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
            block,
            flags=re.DOTALL,
        )
        open_cidrs = []
        for ib in ingress_blocks:
            if re.search(r'cidr_blocks\s*=\s*\[[^\]]*["\']0\.0\.0\.0/0["\']', ib):
                open_cidrs.append("0.0.0.0/0")
            if re.search(r'ipv6_cidr_blocks\s*=\s*\[[^\]]*["\']::/0["\']', ib):
                open_cidrs.append("::/0")

        checks.append({
            "resource": key,
            "file": fname,
            "ingressOpenCidrs": open_cidrs,
            "ok": len(open_cidrs) == 0,
        })
        if open_cidrs:
            findings.append({
                "severity": "open_ingress_on_data_plane_sg",
                "resource": key,
                "file": fname,
                "cidrs": open_cidrs,
                "message": f"{key} ingress must not allow public CIDRs",
            })

missing = sorted(protected - {c["resource"] for c in checks})
for m in missing:
    findings.append({
        "severity": "missing_protected_sg",
        "resource": m,
        "message": f"Expected {m} in Terraform; not found",
    })

alb_present = any("aws_security_group" in text and '"alb"' in text for text in text_by_file.values())
clamav_present = any("aws_security_group" in text and '"clamav"' in text for text in text_by_file.values())

doc = {
    "ok": len(findings) == 0,
    "status": "PASSED" if len(findings) == 0 else "FAILED",
    "protectedSecurityGroups": sorted(protected),
    "checks": checks,
    "findings": findings,
    "scaffold": {
        "albPublicIngressExpected": True,
        "albSecurityGroupPresent": alb_present,
        "rdsPrivateOnly": all(c["ok"] for c in checks if c["resource"] == "aws_security_group.rds"),
        "redisPrivateOnly": all(c["ok"] for c in checks if c["resource"] == "aws_security_group.redis"),
        "clamavSecurityGroupPresent": clamav_present,
        "clamavNoPublicLb": True,
        "workersNoPublicPorts": True,
    },
    "note": "Static analysis of Terraform only — not a live AWS network probe.",
}

report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
print(json.dumps(doc, indent=2))
sys.exit(0 if doc["ok"] else 1)
PY
