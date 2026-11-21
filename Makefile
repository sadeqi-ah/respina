SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE     ?= docker compose
SECRETS_DIR := secrets
JWT_PRIVATE := $(SECRETS_DIR)/jwt_private.pem
JWT_PUBLIC  := $(SECRETS_DIR)/jwt_public.pem

# Components are skipped by test/lint/fmt until they are scaffolded.
HAS_BACKEND  := $(wildcard backend/pyproject.toml)
HAS_FRONTEND := $(wildcard frontend/package.json)
HAS_GO       := $(wildcard health-service/go.mod)
HAS_PHP      := $(wildcard php-module/composer.json)

.PHONY: help env keys up down logs ps migrate seed test lint fmt psql smoke

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Create .env from .env.example (never overwrites)
	@if [ -f .env ]; then echo ".env already exists, leaving it untouched"; \
	else cp .env.example .env && echo "created .env from .env.example"; fi

keys: ## Generate the RS256 JWT keypair into secrets/ (idempotent)
	@mkdir -p $(SECRETS_DIR)
	@if [ -f $(JWT_PRIVATE) ]; then echo "$(JWT_PRIVATE) already exists, keeping it"; \
	else openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out $(JWT_PRIVATE) 2>/dev/null \
		&& chmod 600 $(JWT_PRIVATE) && echo "generated $(JWT_PRIVATE)"; fi
	@if [ -f $(JWT_PUBLIC) ]; then echo "$(JWT_PUBLIC) already exists, keeping it"; \
	else openssl pkey -in $(JWT_PRIVATE) -pubout -out $(JWT_PUBLIC) && echo "generated $(JWT_PUBLIC)"; fi

up: ## Start the stack in the background
	$(COMPOSE) up -d

down: ## Stop the stack (keeps volumes)
	$(COMPOSE) down

logs: ## Follow logs of all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show service status
	$(COMPOSE) ps

migrate: ## Run Django migrations
	$(COMPOSE) exec backend python manage.py migrate

seed: ## Load seed data
	$(COMPOSE) exec backend python manage.py seed

test: ## Run every component's test suite
ifneq ($(HAS_BACKEND),)
	cd backend && uv run pytest
endif
ifneq ($(HAS_FRONTEND),)
	cd frontend && npm test
endif
ifneq ($(HAS_GO),)
	cd health-service && go test -race ./...
endif
ifneq ($(HAS_PHP),)
	cd php-module && vendor/bin/phpunit
endif
	@echo "test: done"

lint: ## Run every component's linters
ifneq ($(HAS_BACKEND),)
	cd backend && uv run ruff check . && uv run ruff format --check .
endif
ifneq ($(HAS_FRONTEND),)
	cd frontend && npm run lint && npm run lint:rtl && npx tsc --noEmit
endif
ifneq ($(HAS_GO),)
	cd health-service && test -z "$$(gofmt -l .)" && go vet ./...
endif
ifneq ($(HAS_PHP),)
	cd php-module && vendor/bin/phpstan analyse
endif
	@echo "lint: done"

fmt: ## Auto-format every component
ifneq ($(HAS_BACKEND),)
	cd backend && uv run ruff format . && uv run ruff check --fix .
endif
ifneq ($(HAS_FRONTEND),)
	cd frontend && npx prettier --write .
endif
ifneq ($(HAS_GO),)
	cd health-service && gofmt -w .
endif
	@echo "fmt: done"

psql: ## Open psql in the db container as the owner role
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

smoke: ## Run the cross-service smoke test
	./scripts/smoke.sh
