# Platform/backend/admin/front targets and shared dev/test tooling.

.PHONY: start-platform stop-platform restart-platform status-platform logs-platform clean-platform \
	dev dev-host dev-frontend-admin install check-prereqs check-docker check-deps \
	db-migrate db-migrate-create db-seed seed-test-users db-reset \
	post-deploy-platform \
	test test-fast test-smoke test-unit test-integration test-e2e \
	lint lint-frontend typecheck typecheck-frontend typecheck-mypy typecheck-pyright \
	format format-frontend \
	shell clean-py \
	env-validate env-validate-server env-check env-server env-local env-test env-staging env-show setup \
	build-platform \
	docker-platform-up docker-ps

# ===================================================================
# Infrastructure - Platform
# ===================================================================

start-platform:
	@./scripts/infra.sh platform start

stop-platform:
	@./scripts/infra.sh platform stop

restart-platform:
	@./scripts/infra.sh platform restart

status-platform:
	@./scripts/infra.sh platform status

logs-platform:
	@./scripts/infra.sh platform logs

clean-platform:
	@./scripts/infra.sh platform clean

# ===================================================================
# Development
# ===================================================================

install: check-prereqs
	@echo "$(CYAN)Installing Python dependencies...$(NC)"
	@poetry install
	@echo "$(CYAN)Installing frontend workspace dependencies...$(NC)"
	@cd frontend && pnpm install
	@echo ""
	@echo "$(GREEN)✓ All dependencies installed successfully!$(NC)"

dev:
	@echo "$(CYAN)Starting platform backend service inside Docker (logs follow)$(NC)"
	@echo "$(CYAN)Platform API docs: http://localhost:8001/docs$(NC)"
	@docker compose -f docker-compose.base.yml up platform-backend

dev-host:
	@echo "$(CYAN)Starting backend directly on the host (debug mode)$(NC)"
	@./scripts/quick-backend-start.sh

dev-frontend-admin:
	@echo "$(CYAN)Starting Platform Admin frontend on http://localhost:3002$(NC)"
	@cd frontend && pnpm dev:admin

check-prereqs:
	@echo "$(CYAN)Checking core development dependencies...$(NC)"
	@command -v poetry >/dev/null 2>&1 || { echo "$(YELLOW)✗ Poetry not installed. Install from: https://python-poetry.org/$(NC)"; exit 1; }
	@echo "$(GREEN)✓ Poetry installed$(NC)"
	@command -v pnpm >/dev/null 2>&1 || { echo "$(YELLOW)✗ pnpm not installed. Run: npm install -g pnpm$(NC)"; exit 1; }
	@echo "$(GREEN)✓ pnpm installed$(NC)"
	@echo ""
	@echo "$(GREEN)Core development dependencies look good!$(NC)"

check-docker:
	@echo "$(CYAN)Checking Docker availability...$(NC)"
	@command -v docker >/dev/null 2>&1 || { echo "$(YELLOW)✗ Docker not installed$(NC)"; exit 1; }
	@echo "$(GREEN)✓ Docker installed$(NC)"
	@docker info >/dev/null 2>&1 || { echo "$(YELLOW)✗ Docker daemon not running$(NC)"; exit 1; }
	@echo "$(GREEN)✓ Docker daemon running$(NC)"
	@echo ""

check-deps: check-prereqs check-docker
	@echo "$(GREEN)All required dependencies are installed!$(NC)"

# ===================================================================
# Database
# ===================================================================

db-migrate:
	@echo "$(CYAN)Running database migrations...$(NC)"
	@poetry run alembic upgrade head

db-migrate-create:
	@echo "$(CYAN)Creating new migration...$(NC)"
	@read -p "Enter migration message: " msg; \
	poetry run alembic revision --autogenerate -m "$$msg"

db-seed:
	@echo "$(CYAN)Seeding database with test data...$(NC)"
	@poetry run python scripts/seed_data.py --env=development

seed-test-users:
	@echo "$(CYAN)Seeding test users (platform/tenant roles)...$(NC)"
	@.venv/bin/python scripts/seed_test_users.py

db-reset:
	@echo "$(YELLOW)⚠ WARNING: This will reset the database!$(NC)"
	@read -p "Continue? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		poetry run alembic downgrade base && \
		poetry run alembic upgrade head && \
		make db-seed; \
	fi

# ===================================================================
# Post-Deployment
# ===================================================================

post-deploy-platform:
	@echo "$(CYAN)Running post-deployment setup for platform backend...$(NC)"
	@./scripts/post-deploy.sh platform

# ===================================================================
# Testing
# ===================================================================

test:
	@echo "$(CYAN)Running all tests with coverage...$(NC)"
	@poetry run pytest --cov=src/dotmac --cov-report=term-missing --cov-report=xml

test-fast:
	@echo "$(CYAN)Running tests without coverage...$(NC)"
	@poetry run pytest -v --tb=short

test-smoke:
	@echo "$(CYAN)Running backend smoke tests (no autostart)...$(NC)"
	@DOTMAC_AUTOSTART_SERVICES=0 poetry run pytest \
		tests/network_monitoring/test_router_smoke.py \
		tests/access/test_access_router_ack_smoke.py \
		tests/voltha/test_voltha_router_ack_smoke.py \
		tests/orchestration/test_router_exports_smoke.py \
		tests/ticketing/test_ticketing_router_smoke.py -q

test-unit:
	@echo "$(CYAN)Running unit tests...$(NC)"
	@poetry run pytest -m unit -v

test-integration:
	@echo "$(CYAN)Running integration tests...$(NC)"
	@./scripts/run-integration-tests.sh

test-e2e:
	@echo "$(CYAN)Running end-to-end tests...$(NC)"
	@cd frontend && pnpm playwright test

typecheck: typecheck-mypy typecheck-pyright

typecheck-mypy:
	@echo "$(CYAN)Running mypy type checking...$(NC)"
	@poetry run mypy --strict src/dotmac/platform/db.py src/dotmac/platform/db/testing.py

typecheck-pyright:
	@echo "$(CYAN)Running pyright type checking...$(NC)"
	@poetry run pyright

typecheck-frontend:
	@echo "$(CYAN)Running frontend type checking...$(NC)"
	@cd frontend && pnpm type-check

# ===================================================================
# Linting & Formatting
# ===================================================================

lint:
	@echo "$(CYAN)Running Python linting...$(NC)"
	@poetry run ruff check src/ tests/
	@poetry run mypy src/

lint-frontend:
	@echo "$(CYAN)Running frontend linting...$(NC)"
	@cd frontend && pnpm lint

format:
	@echo "$(CYAN)Formatting Python code...$(NC)"
	@poetry run ruff check --fix src/ tests/
	@poetry run ruff format src/ tests/

format-frontend:
	@echo "$(CYAN)Formatting frontend code...$(NC)"
	@cd frontend && pnpm format

# ===================================================================
# Utilities
# ===================================================================

shell:
	@poetry shell

clean-py:
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete
	@find . -type f -name "*.pyo" -delete
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

# ===================================================================
# Environment & Setup
# ===================================================================

env-validate:
	@echo "$(CYAN)Validating environment configuration...$(NC)"
	@./scripts/validate-docker-compose-env.sh

env-validate-server:
	@echo "$(CYAN)Validating server deployment configuration...$(NC)"
	@./scripts/validate-server-env.sh

env-check:
	@echo "$(CYAN)Checking external services...$(NC)"
	@./scripts/check-external-services.sh

env-server:
	@echo "$(CYAN)Switching to server deployment environment...$(NC)"
	@if [ -f .env.server ]; then \
		cp .env.server .env; \
		echo "$(GREEN)✓ Switched to .env.server$(NC)"; \
		echo "$(YELLOW)⚠ Review and update passwords before deployment!$(NC)"; \
	else \
		echo "$(YELLOW)✗ .env.server not found$(NC)"; \
		exit 1; \
	fi

env-local:
	@echo "$(CYAN)Switching to local development environment...$(NC)"
	@if [ -f .env.local ]; then \
		cp .env.local .env; \
		echo "$(GREEN)✓ Switched to .env.local$(NC)"; \
	else \
		echo "$(YELLOW)✗ .env.local not found. Copy from .env.local.example$(NC)"; \
		exit 1; \
	fi

env-test:
	@echo "$(CYAN)Switching to test environment...$(NC)"
	@if [ -f .env.test ]; then \
		cp .env.test .env; \
		echo "$(GREEN)✓ Switched to .env.test$(NC)"; \
	else \
		echo "$(YELLOW)✗ .env.test not found$(NC)"; \
		exit 1; \
	fi

env-staging:
	@echo "$(CYAN)Switching to staging environment...$(NC)"
	@if [ -f .env.staging ]; then \
		cp .env.staging .env; \
		echo "$(GREEN)✓ Switched to .env.staging$(NC)"; \
	else \
		echo "$(YELLOW)✗ .env.staging not found$(NC)"; \
		exit 1; \
	fi

env-show:
	@echo "$(CYAN)Current environment variables:$(NC)"
	@if [ -f .env ]; then \
		cat .env | grep -v '^#' | grep -v '^$$'; \
	else \
		echo "$(YELLOW)No .env file found$(NC)"; \
	fi

setup:
	@echo "$(CYAN)Running initial platform setup...$(NC)"
	@./scripts/setup-platform-and-tenant.sh

# ===================================================================
# Build (Platform)
# ===================================================================

build-platform:
	@echo "$(CYAN)Building platform Docker images...$(NC)"
	@docker compose -f docker-compose.base.yml build

# ===================================================================
# Docker Direct Access (Advanced)
# ===================================================================

docker-platform-up:
	@docker compose -f docker-compose.base.yml up -d platform-backend platform-frontend

docker-ps:
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
