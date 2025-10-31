# DotMac Platform Services - Simplified Makefile

.PHONY: help start-platform start-isp start-all stop-platform stop-isp stop-all status-platform status-isp status-all logs-platform logs-isp clean-platform clean-isp clean-all dev dev-backend dev-frontend install test lint typecheck typecheck-mypy typecheck-pyright

# Colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# Default target
.DEFAULT_GOAL := help

help:
	@echo "$(CYAN)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║  DotMac Platform - Development Commands                 ║$(NC)"
	@echo "$(CYAN)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Infrastructure - Platform (Core):$(NC)"
	@echo "  make start-platform         Start platform infrastructure (postgres, redis, vault, minio)"
	@echo "  make start-platform-obs     Start platform + observability (jaeger, prometheus, grafana)"
	@echo "  make stop-platform          Stop platform infrastructure"
	@echo "  make status-platform        Check platform service status"
	@echo "  make logs-platform          View platform logs"
	@echo ""
	@echo "$(GREEN)Infrastructure - ISP Services:$(NC)"
	@echo "  make start-isp              Start ISP services (FreeRADIUS, NetBox, GenieACS, AWX, etc.)"
	@echo "  make stop-isp               Stop ISP services"
	@echo "  make status-isp             Check ISP service status"
	@echo "  make logs-isp               View ISP logs"
	@echo ""
	@echo "$(GREEN)Infrastructure - Complete Stack:$(NC)"
	@echo "  make start-all              Start all services (with observability)"
	@echo "  make start-all-no-obs       Start all services (without observability)"
	@echo "  make stop-all               Stop all services"
	@echo "  make status-all             Check all service status"
	@echo "  make restart-all            Restart all services"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev                    Start backend server (localhost:8000)"
	@echo "  make dev-backend            Start backend with auto-reload"
	@echo "  make dev-frontend           Start frontend (localhost:3000)"
	@echo "  make install                Install dependencies"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  make test                   Run all tests"
	@echo "  make test-fast              Run fast tests (no coverage)"
	@echo "  make lint                   Run linting"
	@echo "  make typecheck              Run mypy and pyright"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-migrate             Run database migrations"
	@echo "  make db-seed                Seed database with test data"
	@echo ""
	@echo "$(GREEN)Cleanup:$(NC)"
	@echo "  make clean-platform         Remove platform containers/volumes (DESTRUCTIVE!)"
	@echo "  make clean-isp              Remove ISP containers/volumes (DESTRUCTIVE!)"
	@echo "  make clean-all              Remove ALL containers/volumes (DESTRUCTIVE!)"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  1. make start-all           # Start all infrastructure (includes observability)"
	@echo "  2. make db-migrate          # Run migrations"
	@echo "  3. make dev                 # Start backend API"
	@echo ""
	@echo "$(YELLOW)Observability:$(NC)"
	@echo "  Jaeger (Tracing):     http://localhost:16686"
	@echo "  Prometheus (Metrics): http://localhost:9090"
	@echo "  Grafana (Dashboards): http://localhost:3400 (admin/admin)"
	@echo ""

# ===================================================================
# Infrastructure - Platform
# ===================================================================

start-platform:
	@./scripts/infra.sh platform start

start-platform-obs:
	@./scripts/infra.sh platform start --with-obs

stop-platform:
	@./scripts/infra.sh platform stop

restart-platform:
	@./scripts/infra.sh platform restart

status-platform:
	@./scripts/infra.sh platform status

logs-platform:
	@./scripts/infra.sh platform logs

# ===================================================================
# Infrastructure - ISP Services
# ===================================================================

start-isp:
	@./scripts/infra.sh isp start

stop-isp:
	@./scripts/infra.sh isp stop

restart-isp:
	@./scripts/infra.sh isp restart

status-isp:
	@./scripts/infra.sh isp status

logs-isp:
	@./scripts/infra.sh isp logs

# ===================================================================
# Infrastructure - All Services
# ===================================================================

start-all:
	@./scripts/infra.sh all start --with-obs

start-all-no-obs:
	@./scripts/infra.sh all start

stop-all:
	@./scripts/infra.sh all stop

restart-all:
	@./scripts/infra.sh all restart

status-all:
	@./scripts/infra.sh all status

logs-all:
	@./scripts/infra.sh all logs

# ===================================================================
# Cleanup (DESTRUCTIVE!)
# ===================================================================

clean-platform:
	@./scripts/infra.sh platform clean

clean-isp:
	@./scripts/infra.sh isp clean

clean-all:
	@./scripts/infra.sh all clean

# ===================================================================
# Development
# ===================================================================

install:
	@echo "$(CYAN)Installing dependencies...$(NC)"
	@poetry install

dev: dev-backend

dev-backend:
	@echo "$(CYAN)Starting backend on http://localhost:8000$(NC)"
	@echo "$(CYAN)API docs: http://localhost:8000/docs$(NC)"
	@env -u __PYVENV_LAUNCHER__ ENVIRONMENT=development poetry run uvicorn src.dotmac.platform.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	@echo "$(CYAN)Starting frontend on http://localhost:3000$(NC)"
	@cd frontend/apps/base-app && pnpm dev

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

db-reset:
	@echo "$(YELLOW)⚠ WARNING: This will reset the database!$(NC)"
	@read -p "Continue? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		poetry run alembic downgrade base && \
		poetry run alembic upgrade head && \
		make db-seed; \
	fi

# ===================================================================
# Testing
# ===================================================================

test:
	@poetry run pytest --cov=src/dotmac --cov-report=term-missing --cov-report=xml

test-fast:
	@poetry run pytest -v --tb=short

typecheck: typecheck-mypy typecheck-pyright

typecheck-mypy:
	@poetry run mypy --strict src/dotmac/platform/db.py src/dotmac/platform/db/testing.py

typecheck-pyright:
	@poetry run pyright

test-integration:
	@./scripts/run_integration_tests.sh

# ===================================================================
# Linting & Formatting
# ===================================================================

lint:
	@poetry run ruff check src/ tests/
	@poetry run mypy src/

format:
	@poetry run ruff check --fix src/ tests/
	@poetry run ruff format src/ tests/

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
# Build
# ===================================================================

build-freeradius:
	@echo "$(CYAN)Building FreeRADIUS image for Apple Silicon...$(NC)"
	@docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .

# ===================================================================
# Docker Direct Access (Advanced)
# ===================================================================

docker-platform-up:
	@docker compose -f docker-compose.base.yml up -d postgres redis vault minio

docker-platform-obs-up:
	@docker compose -f docker-compose.base.yml --profile observability up -d

docker-isp-up:
	@docker compose -f docker-compose.isp.yml up -d

docker-ps:
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
