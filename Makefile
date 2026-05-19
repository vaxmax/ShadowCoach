.PHONY: up up-cpu down logs shell \
        build install-dev \
        test test-backend test-frontend \
        lint lint-backend lint-frontend lint-fix \
        typecheck security \
        check help

# ── Docker ────────────────────────────────────────────────────────────────────

## Start with GPU (NVIDIA)
up:
	docker compose up --build

## Start without GPU (CPU-only, any machine)
up-cpu:
	docker compose -f docker-compose.cpu.yml up --build

## Rebuild images without starting (picks up package.json / requirements changes)
build:
	docker compose build

## Stop and remove containers
down:
	docker compose down

## Follow API logs
logs:
	docker compose logs -f api

## Open a shell inside the API container
shell:
	docker compose exec api bash

## Open a shell inside the web container
shell-web:
	docker compose exec web sh

# ── Dev tools ─────────────────────────────────────────────────────────────────

## Install all dev dependencies (Python tools + frontend packages)
install-dev:
	docker compose exec api pip install -r requirements-dev.txt
	docker compose exec web npm install

# ── Tests ─────────────────────────────────────────────────────────────────────

## Run all tests (backend + frontend)
test: test-backend test-frontend

## Run backend unit tests inside the API container
test-backend:
	docker compose exec api pytest tests/ -v

## Run frontend tests inside the web container
test-frontend:
	docker compose exec web npm test

# ── Linting ───────────────────────────────────────────────────────────────────

## Run all linters
lint: lint-backend lint-frontend

## Lint Python with ruff (report only — for CI)
lint-backend:
	docker compose exec api ruff check .

## Lint frontend with ESLint (report only — for CI)
lint-frontend:
	docker compose exec web npm run lint

## Auto-fix all fixable lint issues, then verify nothing remains
lint-fix:
	docker compose exec api ruff check . --fix
	docker compose exec api ruff check .
	docker compose exec web npm run lint:fix

# ── Static analysis ───────────────────────────────────────────────────────────

## Type-check Python with mypy inside the API container
typecheck:
	docker compose exec api mypy . --ignore-missing-imports

## Security scan with bandit inside the API container
security:
	docker compose exec api bandit -r . -ll -x ./tests

# ── Full validation (CI-style) ────────────────────────────────────────────────

## Run everything: lint + typecheck + security + tests
check: lint typecheck security test
	@echo ""
	@echo "All checks passed."

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "ShadowCoach — available commands:"
	@echo ""
	@echo "  make up           Start with GPU (rebuilds images)"
	@echo "  make up-cpu       Start without GPU"
	@echo "  make build        Rebuild images only (no start)"
	@echo "  make down         Stop containers"
	@echo "  make logs         Follow API logs"
	@echo "  make shell        Shell inside API container"
	@echo "  make shell-web    Shell inside web container"
	@echo ""
	@echo "  make install-dev  Install dev tools (Python + npm packages)"
	@echo ""
	@echo "  make test         Run all tests"
	@echo "  make test-backend Run backend tests (pytest)"
	@echo "  make test-frontend Run frontend tests (vitest)"
	@echo ""
	@echo "  make lint         Run all linters"
	@echo "  make lint-fix     Auto-fix lint issues"
	@echo "  make typecheck    mypy type checking"
	@echo "  make security     bandit security scan"
	@echo ""
	@echo "  make check        Run everything (CI)"
	@echo ""
