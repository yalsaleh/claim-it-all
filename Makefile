.PHONY: help verify-local test-live-ci data-plane-up data-plane-down data-plane-ps

help:
	@echo "ContractRadar targets:"
	@echo "  make verify-local     Mode A — local checks without Docker (recommended)"
	@echo "  make test-live-ci     Mode B — live suite (requires real data plane; normally CI)"
	@echo "  make data-plane-up    Optional: start Compose data plane (requires Docker)"
	@echo "  make data-plane-down  Optional: stop Compose data plane"
	@echo "  make data-plane-ps    Optional: show Compose status"

verify-local:
	bash scripts/verify-local.sh

test-live-ci:
	bash scripts/test-live-ci.sh

data-plane-up:
	@echo "NOTE: Docker is optional and not required for ordinary local development."
	@echo "Authoritative live verification is the GitHub Actions live-ingestion workflow."
	bash scripts/dev-data-plane.sh up

data-plane-down:
	bash scripts/dev-data-plane.sh down

data-plane-ps:
	bash scripts/dev-data-plane.sh ps
