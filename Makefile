# DotMac Platform Services - Simplified Makefile

SHELL := /bin/bash

.PHONY: help start-platform start-isp start-all stop-platform stop-isp stop-all status-platform status-isp status-all logs-platform logs-isp logs-all clean-platform clean-isp clean-all dev dev-host dev-frontend dev-frontend-admin install check-prereqs check-docker check-deps test test-fast test-unit test-integration test-e2e lint lint-frontend typecheck typecheck-frontend typecheck-mypy typecheck-pyright format format-frontend db-migrate db-migrate-create db-seed db-reset post-deploy post-deploy-platform post-deploy-isp build-platform build-isp build-all build-freeradius env-validate env-check env-local env-test env-staging env-show setup shell clean-py docker-ps docker-platform-up docker-isp-up restart-platform restart-isp restart-all

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
	@echo "  make start-platform         Start platform backend + admin frontend"
	@echo "  make stop-platform          Stop platform services"
	@echo "  make restart-platform       Restart platform services"
	@echo "  make status-platform        Check platform service status"
	@echo "  make logs-platform          View platform logs"
	@echo ""
	@echo "$(GREEN)Infrastructure - ISP Services:$(NC)"
	@echo "  make start-isp              Start ISP backend + ISP operations frontend"
	@echo "  make stop-isp               Stop ISP services"
	@echo "  make restart-isp            Restart ISP services"
	@echo "  make status-isp             Check ISP service status"
	@echo "  make logs-isp               View ISP logs"
	@echo ""
	@echo "$(GREEN)Infrastructure - Complete Stack:$(NC)"
	@echo "  make start-all              Start all services + run migrations + verify health"
	@echo "  make stop-all               Stop all services"
	@echo "  make restart-all            Restart all services"
	@echo "  make status-all             Check all service status"
	@echo "  make logs-all               Tail logs from both stacks"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev                    Start platform backend in Docker (port 8001)"
	@echo "  make dev-host               Run backend directly on host (port 8000)"
	@echo "  make dev-frontend           Start ISP frontend (localhost:3001)"
	@echo "  make dev-frontend-admin     Start platform admin frontend (localhost:3002)"
	@echo "  make install                Install all dependencies (Python + Node)"
	@echo "  make check-deps             Verify required tools are installed"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  make test                   Run all tests with coverage"
	@echo "  make test-fast              Run tests without coverage"
	@echo "  make test-unit              Run unit tests only"
	@echo "  make test-integration       Run integration tests"
	@echo "  make test-e2e               Run end-to-end tests"
	@echo "  make lint                   Run Python linting (ruff + mypy)"
	@echo "  make lint-frontend          Run frontend linting"
	@echo "  make typecheck              Run Python type checking"
	@echo "  make typecheck-frontend     Run frontend type checking"
	@echo "  make format                 Format Python code"
	@echo "  make format-frontend        Format frontend code"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-migrate             Run database migrations"
	@echo "  make db-migrate-create      Create new migration"
	@echo "  make db-seed                Seed database with test data"
	@echo "  make db-reset               Reset database (destructive)"
	@echo ""
	@echo "$(GREEN)Post-Deployment (Docker):$(NC)"
	@echo "  make post-deploy            Run post-deployment setup (migrations + health checks)"
	@echo "  make post-deploy-platform   Setup platform backend only"
	@echo "  make post-deploy-isp        Setup ISP backend only"
	@echo ""
	@echo "$(GREEN)Build:$(NC)"
	@echo "  make build-platform         Build platform Docker images"
	@echo "  make build-isp              Build ISP Docker images"
	@echo "  make build-all              Build all Docker images"
	@echo "  make build-freeradius       Build FreeRADIUS image"
	@echo ""
	@echo "$(GREEN)Environment:$(NC)"
	@echo "  make env-validate           Validate current environment"
	@echo "  make env-check              Check external services"
	@echo "  make env-local              Switch to local development environment"
	@echo "  make env-test               Switch to test environment"
	@echo "  make env-staging            Switch to staging environment"
	@echo "  make env-show               Show current environment variables"
	@echo "  make setup                  Run initial platform setup"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make shell                  Open Poetry shell"
	@echo "  make clean-py               Remove Python cache files"
	@echo "  make docker-ps              Show running Docker containers"
	@echo ""
	@echo "$(GREEN)Cleanup:$(NC)"
	@echo "  make clean-platform         Remove platform containers/volumes (DESTRUCTIVE!)"
	@echo "  make clean-isp              Remove ISP containers/volumes (DESTRUCTIVE!)"
	@echo "  make clean-all              Remove ALL containers/volumes (DESTRUCTIVE!)"
	@echo ""
	@echo "$(YELLOW)Quick Start (One Command Setup):$(NC)"
	@echo "  1. make check-deps          # Verify tools are installed"
	@echo "  2. make install             # Install dependencies"
	@echo "  3. make start-all           # Start all services + migrations + health checks"
	@echo "  4. Access frontends:        # Platform (3002), ISP (3001)"
	@echo ""

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
	@echo "$(CYAN)Running pre-flight checks...$(NC)"
	@if ./scripts/docker-compose-pre-flight.sh; then \
		true; \
	elif [ "$(ALLOW_PRE_FLIGHT_SKIP)" = "1" ]; then \
		echo "$(YELLOW)⚠ Pre-flight checks failed, but ALLOW_PRE_FLIGHT_SKIP=1 so continuing...$(NC)"; \
	else \
		echo "$(YELLOW)✗ Pre-flight checks failed. Set ALLOW_PRE_FLIGHT_SKIP=1 to override.$(NC)"; \
		exit 1; \
	fi
	@./scripts/infra.sh all start
	@echo ""
	@echo "$(CYAN)Running post-deployment setup (migrations + health checks)...$(NC)"
	@./scripts/post-deploy.sh all

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

dev-frontend:
	@echo "$(CYAN)Starting ISP frontend on http://localhost:3001$(NC)"
	@cd frontend && pnpm dev:isp

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

db-reset:
	@echo "$(YELLOW)⚠ WARNING: This will reset the database!$(NC)"
	@read -p "Continue? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		poetry run alembic downgrade base && \
		poetry run alembic upgrade head && \
		make db-seed; \
	fi

# ===================================================================
# Post-Deployment (Docker Containers)
# ===================================================================

post-deploy:
	@echo "$(CYAN)Running post-deployment setup for all backends...$(NC)"
	@./scripts/post-deploy.sh all

post-deploy-platform:
	@echo "$(CYAN)Running post-deployment setup for platform backend...$(NC)"
	@./scripts/post-deploy.sh platform

post-deploy-isp:
	@echo "$(CYAN)Running post-deployment setup for ISP backend...$(NC)"
	@./scripts/post-deploy.sh isp

# ===================================================================
# Testing
# ===================================================================

test:
	@echo "$(CYAN)Running all tests with coverage...$(NC)"
	@poetry run pytest --cov=src/dotmac --cov-report=term-missing --cov-report=xml

test-fast:
	@echo "$(CYAN)Running tests without coverage...$(NC)"
	@poetry run pytest -v --tb=short

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

env-check:
	@echo "$(CYAN)Checking external services...$(NC)"
	@./scripts/check-external-services.sh

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
# Build
# ===================================================================

build-platform:
	@echo "$(CYAN)Building platform Docker images...$(NC)"
	@docker compose -f docker-compose.base.yml build

build-isp:
	@echo "$(CYAN)Building ISP Docker images...$(NC)"
	@docker compose -f docker-compose.isp.yml build

build-all:
	@echo "$(CYAN)Building all Docker images...$(NC)"
	@docker compose -f docker-compose.base.yml build
	@docker compose -f docker-compose.isp.yml build

build-freeradius:
	@echo "$(CYAN)Building FreeRADIUS image for Apple Silicon...$(NC)"
	@docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .

# ===================================================================
# Docker Direct Access (Advanced)
# ===================================================================

docker-platform-up:
	@docker compose -f docker-compose.base.yml up -d platform-backend platform-frontend

docker-isp-up:
	@docker compose -f docker-compose.isp.yml up -d isp-backend isp-frontend

docker-ps:
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
