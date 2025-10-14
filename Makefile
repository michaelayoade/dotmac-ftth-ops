# DotMac Platform Services - Makefile

.PHONY: help install test test-fast test-unit test-integration test-cov test-mutation test-slow test-comprehensive lint format clean doctor doctor-imports verify docker-up docker-down docker-test openapi-client infra-up infra-down infra-status run run-dev seed-db dev dev-backend dev-frontend dev-all

# Default target
help:
	@echo "DotMac Platform Services - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install all dependencies"
	@echo "  make doctor          Verify Python version and key dependencies"
	@echo "  make seed-db         Seed database with test data"
	@echo ""
	@echo "Testing:"
	@echo "  make test-fast       🚀 Fast tests, no coverage (<1 min) - RECOMMENDED"
	@echo "  make test-module-cov MODULE=auth  📊 Single module coverage (fast!)"
	@echo "  make test-critical   Test critical modules (auth, secrets, tenant, webhooks - 90%)"
	@echo "  make test            Run all tests with coverage (SLOW locally, 15+ min)"
	@echo "  make test-unit       Run unit tests with coverage (SLOW, 10-20 min)"
	@echo "  make test-diff       Check diff coverage for PRs (use in CI)"
	@echo "  make test-slow       Run only slow/comprehensive tests"
	@echo "  make test-integration Run integration tests with Docker"
	@echo "  make test-cov        Generate HTML coverage report"
	@echo ""
	@echo "  💡 TIP: Use 'test-module-cov' to check single module coverage quickly!"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra-up        Start all infrastructure services"
	@echo "  make infra-down      Stop all infrastructure services"
	@echo "  make infra-status    Check infrastructure health"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up       Start Docker services"
	@echo "  make docker-down     Stop Docker services"
	@echo "  make docker-test     Run integration tests with Docker"
	@echo ""
	@echo "Running:"
	@echo "  make run             Start the application"
	@echo "  make run-dev         Start in development mode with hot reload"
	@echo "  make dev-all         Start backend + frontend (requires infra running)"
	@echo "  make dev-backend     Start backend only (port 8000)"
	@echo "  make dev-frontend    Start frontend only (port 3000)"
	@echo "  make dev             Start infra + backend + frontend (full stack)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint            Run all linters"
	@echo "  make format          Auto-format code"
	@echo "  make clean           Remove build artifacts"
	@echo "  make openapi-client  Export OpenAPI spec and regenerate TypeScript client"

# Installation
install:
	poetry install --with dev

# Fast unit tests without coverage (for development)
test-fast:
	poetry run pytest tests/ -m "not integration and not slow" -x --tb=short -q

# Fast tests with parallel execution (recommended for development)
test-fast-parallel:
	@echo "🚀 Running fast tests in parallel..."
	poetry run pytest tests/ -m "not integration and not slow" -n auto -x --tb=short -q

# Parallel test execution using all CPU cores
test-parallel:
	@echo "🚀 Running tests in parallel with auto CPU detection..."
	poetry run pytest tests/ -n auto -x --tb=short -v

# Unit tests with coverage (aligned with CI - base threshold)
# Note: Full coverage is VERY slow locally due to large codebase (33k+ LOC)
# Use test-module-cov for specific modules instead
test-unit:
	@echo "⚠️  WARNING: Full coverage takes 10-20+ minutes locally"
	@echo "💡 Better options:"
	@echo "   - make test-fast              (no coverage, <1 min)"
	@echo "   - make test-module-cov MODULE=auth   (single module)"
	@echo "   - Let CI measure coverage     (optimized, ~15 min)"
	@echo ""
	@read -p "Continue anyway? [y/N]: " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo ""
	@echo "Running full coverage (this will take a while)..."
	poetry run pytest tests/ -m "not integration" \
		--cov=src/dotmac \
		--cov-branch \
		--cov-report=term-missing \
		--cov-report=xml \
		--cov-fail-under=75

# Test single module with coverage (fast!)
# Usage: make test-module-cov MODULE=auth
test-module-cov:
	@if [ -z "$(MODULE)" ]; then \
		echo "❌ Error: MODULE not specified"; \
		echo "Usage: make test-module-cov MODULE=auth"; \
		echo ""; \
		echo "Available modules:"; \
		echo "  auth, billing, customer_management, partner_management,"; \
		echo "  user_management, tenant, webhooks, secrets, audit, core"; \
		exit 1; \
	fi
	@echo "🔍 Testing $(MODULE) module with coverage..."
	poetry run pytest tests/$(MODULE)/ \
		--cov=src/dotmac/platform/$(MODULE) \
		--cov-branch \
		--cov-report=term-missing \
		--cov-report=xml \
		-v

# Full test suite with coverage + module checks (aligned with CI)
test:
	poetry run pytest \
		--cov=src/dotmac \
		--cov-branch \
		--cov-report=term-missing \
		--cov-report=xml \
		--cov-report=html \
		--cov-fail-under=75 \
		-v
	@echo ""
	@echo "Checking module-specific thresholds..."
	poetry run python scripts/check_coverage.py coverage.xml

# Run tests with coverage in parallel (faster than 'make test')
test-cov-parallel:
	@echo "🚀 Running tests with coverage in parallel..."
	poetry run pytest \
		-n auto \
		--cov=src/dotmac \
		--cov-branch \
		--cov-report=term-missing \
		--cov-report=xml \
		--cov-report=html \
		--cov-fail-under=75 \
		-v
	@echo ""
	@echo "Checking module-specific thresholds..."
	poetry run python scripts/check_coverage.py coverage.xml

# Check coverage for critical modules only (auth, secrets, tenant, webhooks)
test-critical:
	poetry run pytest tests/auth tests/secrets tests/tenant tests/webhooks \
		--cov=src/dotmac/platform/auth \
		--cov-append --cov=src/dotmac/platform/secrets \
		--cov-append --cov=src/dotmac/platform/tenant \
		--cov-append --cov=src/dotmac/platform/webhooks \
		--cov-branch \
		--cov-report=term-missing \
		--cov-report=xml \
		--cov-fail-under=90 \
		-v

# Check diff coverage (for PR validation)
# Note: This is primarily for CI. Locally, just ensure your changes have tests.
test-diff:
	@echo "📊 Checking diff coverage (may be slow locally)..."
	@echo "💡 Tip: Run 'make test-fast' first to ensure tests pass quickly."
	@echo "🚀 CI will run this automatically on PRs."
	@echo ""
	COVERAGE_CORE=sysmon poetry run pytest \
		--cov=src/dotmac \
		--cov-branch \
		--cov-report=xml \
		--cov-fail-under=75 \
		-q
	@echo ""
	poetry run diff-cover coverage.xml \
		--compare-branch=origin/main \
		--fail-under=80 \
		--html-report=diff-cover.html
	@echo "✅ Diff coverage report: diff-cover.html"

# Generate and open coverage report with module checks
test-cov:
	poetry run pytest \
		--cov=src/dotmac \
		--cov-branch \
		--cov-report=html \
		--cov-report=xml \
		--cov-fail-under=75
	@echo ""
	@echo "Checking module-specific thresholds..."
	poetry run python scripts/check_coverage.py coverage.xml
	@echo ""
	@echo "Opening coverage report..."
	@python -m webbrowser htmlcov/index.html || open htmlcov/index.html

# Run only slow and comprehensive tests
test-slow:
	poetry run pytest tests/ -m "slow or comprehensive" -v --tb=short

# Run comprehensive tests specifically
test-comprehensive:
	poetry run pytest tests/ -m "comprehensive" -v --tb=short

# Environment diagnostics
doctor:
	@echo "Checking Python version (>= 3.12 required)..."
	@poetry run python -c "import sys; m,n=sys.version_info[:2]; print(f'Python {m}.{n}'); assert (m,n)>=(3,12), 'Python 3.12+ required for modern typing and Pydantic v2'; print('\u2713 Python version OK')"
	@echo "Checking core runtime dependencies..."
	@poetry run python scripts/check_deps.py runtime
	@echo "Checking test/dev dependencies..."
	@poetry run python scripts/check_deps.py dev || true
	@echo "✓ Environment looks good!"

doctor-imports:
	@echo "Verifying high-level module imports..."
	@PYTHONPATH=src poetry run python scripts/verify_imports.py || true

verify: doctor doctor-imports

# Generate OpenAPI specification and TypeScript client types
openapi-client:
	poetry run python scripts/export_openapi.py --mode=$(MODE)
	cd frontend && pnpm generate:api-client

# Linting
lint:
	poetry run black --check .
	poetry run isort --check-only .
	poetry run ruff check .
	poetry run bandit -r src/ -ll

# Auto-format code
format:
	poetry run black .
	poetry run isort .
	poetry run ruff check --fix .

# Clean build artifacts
clean:
	rm -rf build/ dist/ *.egg-info htmlcov/ .coverage coverage.xml
	rm -rf .pytest_cache/ .ruff_cache/ .mypy_cache/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

# Docker commands
docker-up:
	docker compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Docker services are running"

docker-down:
	docker compose down -v

docker-test: docker-up
	@echo "Running integration tests..."
	poetry run pytest tests/integration/test_docker_services.py -v --tb=short || true
	@echo ""
	@read -p "Stop Docker services? (y/N): " stop; \
	if [ "$$stop" = "y" ] || [ "$$stop" = "Y" ]; then \
		make docker-down; \
	fi

# Integration tests
test-integration:
	@./scripts/run_integration_tests.sh

# Infrastructure Management
infra-up:
	@./scripts/check_infra.sh up

infra-down:
	@./scripts/check_infra.sh down

infra-status:
	@./scripts/check_infra.sh status

# Run application
run:
	@poetry run python -m src.dotmac.platform.main

run-dev:
	@ENVIRONMENT=development poetry run python -m src.dotmac.platform.main

# Database seeding
seed-db:
	@echo "🌱 Seeding database with test data..."
	@poetry run python scripts/seed_data.py --env=development
	@echo "✅ Database seeded successfully!"

seed-db-clean:
	@echo "🧹 Clearing and re-seeding database..."
	@poetry run python scripts/seed_data.py --env=development --clear
	@echo "✅ Database re-seeded successfully!"

# Development mode - Backend only
dev-backend:
	@echo "🚀 Starting backend on http://localhost:8000"
	@echo "   API docs: http://localhost:8000/docs"
	@ENVIRONMENT=development poetry run uvicorn src.dotmac.platform.main:app --reload --host 0.0.0.0 --port 8000

# Development mode - Frontend only
dev-frontend:
	@echo "🚀 Starting frontend on http://localhost:3000"
	@cd frontend/apps/base-app && PORT=3000 pnpm dev

# Development mode - Backend + Frontend (requires infra)
dev-all:
	@echo "🚀 Starting backend + frontend..."
	@echo ""
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  API Docs: http://localhost:8000/docs"
	@echo ""
	@$(MAKE) -j2 dev-backend dev-frontend

# Full development stack (infra + backend + frontend)
dev:
	@echo "🚀 Starting full development stack..."
	@echo ""
	@./scripts/check_infra.sh dev
	@echo ""
	@echo "✨ Full stack ready!"
	@echo ""
	@echo "  📦 Infrastructure:"
	@echo "    PostgreSQL:  localhost:5432"
	@echo "    Redis:       localhost:6379"
	@echo "    Vault:       localhost:8200"
	@echo "    MinIO API:   localhost:9000"
	@echo "    MinIO UI:    localhost:9001"
	@echo "    Jaeger UI:   http://localhost:16686"
	@echo "    Flower UI:   http://localhost:5555"
	@echo ""
	@echo "  🚀 Application:"
	@echo "    Backend:     http://localhost:8000"
	@echo "    Frontend:    http://localhost:3000"
	@echo "    API Docs:    http://localhost:8000/docs"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo ""
	@$(MAKE) dev-all
