.PHONY: data-plane-up data-plane-down data-plane-ps help

help:
	@echo "ContractRadar foundation targets:"
	@echo "  make data-plane-up    Start Postgres, Redis, MinIO"
	@echo "  make data-plane-down  Stop data plane"
	@echo "  make data-plane-ps    Show data plane status"

data-plane-up:
	bash scripts/dev-data-plane.sh up

data-plane-down:
	bash scripts/dev-data-plane.sh down

data-plane-ps:
	bash scripts/dev-data-plane.sh ps
