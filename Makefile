# DotMac Platform Services - Simplified Makefile

SHELL := /bin/bash

.PHONY: help start-platform start-isp start-all stop-platform stop-isp stop-all status-platform status-isp status-all logs-platform logs-isp logs-all clean-platform clean-isp clean-all dev dev-backend dev-frontend install test lint typecheck typecheck-mypy typecheck-pyright restart-platform restart-isp restart-all

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
	@echo "  make start-all              Start platform and ISP stacks"
	@echo "  make stop-all               Stop all services"
	@echo "  make restart-all            Restart all services"
	@echo "  make status-all             Check all service status"
	@echo "  make logs-all               Tail logs from both stacks"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev                    Start backend app service in Docker"
	@echo "  make dev-host               Run backend directly on host (debug)"
	@echo "  make dev-frontend           Start ISP frontend (localhost:3001)"
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
	@echo "  1. make start-all           # Start both compose stacks"
	@echo "  2. make db-migrate          # Run migrations"
	@echo "  3. make dev                 # Start backend API"
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
	@echo "$(CYAN)Installing frontend workspace dependencies...$(NC)"
	@cd frontend && pnpm install

dev:
	@echo "$(CYAN)Starting backend app service inside Docker (logs follow)$(NC)"
	@echo "$(CYAN)API docs: http://localhost:8000/docs$(NC)"
	@docker compose -f docker-compose.base.yml up platform-backend

dev-host:
	@echo "$(CYAN)Starting backend directly on the host (debug mode)$(NC)"
	@./scripts/quick-backend-start.sh

dev-frontend:
	@echo "$(CYAN)Starting ISP frontend on http://localhost:3001$(NC)"
	@cd frontend && pnpm dev:isp

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
	@docker compose -f docker-compose.base.yml up -d platform-backend platform-frontend

docker-isp-up:
	@docker compose -f docker-compose.isp.yml up -d isp-backend isp-frontend

docker-ps:
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
