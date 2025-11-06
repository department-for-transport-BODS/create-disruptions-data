stage = $(shell cat ./.sst/stage)

start-sst:
	pnpm run dev

start-site: kill-site
	pnpm --filter @create-disruptions-data/site run dev

install-deps:
	pnpm install
	( \
		python3 -m venv venv; \
		. venv/bin/activate; \
		pip install -r packages/txc-uploader/requirements.dev.txt --target packages/txc-uploader/; \
		rm -rf venv; \
	)

kill-site:
	lsof -t -i:3000 | xargs -r kill

trigger-siri-generator:
	aws lambda invoke --function-name cdd-siri-sx-generator-$(stage) --invocation-type Event /tmp/outfile.txt > /dev/null

trigger-stats-generator:
	aws lambda invoke --function-name cdd-siri-stats-generator-$(stage) --invocation-type Event /tmp/outfile.txt > /dev/null

test-all:
	pnpm run test

test-%:
	pnpm run test:$*

lint-with-fix:
	pnpm run lint:fix

dev-containers-up:
	docker compose --project-directory dev up -d

dev-containers-down:
	docker compose --project-directory dev down

dev-containers-kill:
	docker compose --project-directory dev kill

dev-containers-stop-%:
	docker compose --project-directory dev stop $*

run-ui-tests:
	pnpm playwright test --ui

bastion-tunnel:
	./scripts/bastion-tunnel.sh

get-db-credentials:
	./scripts/get-db-credentials.sh

update-secrets:
	./scripts/update-secrets.sh $(stage)

sst-deploy:
	pnpm sst deploy --stage $(TARGET_STAGE)

create-local-database:
	aws lambda invoke --function-name cdd-local-database-creator-$(stage) --log-type Tail /tmp/response.txt > /dev/null

migrate-local-database:
	pnpm --filter @create-disruptions-data/shared-ts kysely migrate latest

rollback-local-database:
	pnpm --filter @create-disruptions-data/shared-ts kysely migrate down

execute-step-function:
	./scripts/execute-step-function.sh

setup-dev: update-secrets create-local-database migrate-local-database

# CLI helpers

command-%:
	npx tsx cli-helpers/src/commands/$* ${FLAGS};
