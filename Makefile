.PHONY: audit smoke health compose-config

audit:
	bash scripts/audit.sh

smoke:
	bash scripts/smoke_test.sh

health:
	bash scripts/healthcheck.sh

compose-config:
	docker compose config
