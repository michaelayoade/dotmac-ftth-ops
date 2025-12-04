# Root dispatcher Makefile – includes platform and ISP targets and exposes stack-level helpers.

SHELL := /bin/bash

# Colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# Optional environment loading (prefers .env.local, then .env) for host-run targets.
ENV_FILES := .env.local .env
ENV_FILE := $(firstword $(foreach f,$(ENV_FILES),$(if $(wildcard $(f)),$(f),)))
ifneq ($(ENV_FILE),)
include $(ENV_FILE)
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' $(ENV_FILE))
endif

.DEFAULT_GOAL := help

# Include platform/ISP target sets
include Makefile.platform
include Makefile.isp

.PHONY: help start-all stop-all restart-all status-all logs-all clean-all build-all

help:
	@echo "$(CYAN)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║  DotMac Platform - Aggregated Commands                    ║$(NC)"
	@echo "$(CYAN)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Platform targets (backend/admin/frontend):$(NC) make start-platform, dev, test, lint, build-platform"
	@echo "$(GREEN)ISP targets (ops frontend/backend):$(NC)   make start-isp, dev-frontend, build-isp"
	@echo ""
	@echo "$(GREEN)Stack helpers:$(NC)"
	@echo "  make start-all    Run pre-flight, start all services, run post-deploy"
	@echo "  make stop-all     Stop all services"
	@echo "  make restart-all  Restart all services"
	@echo "  make status-all   Check status of all services"
	@echo "  make logs-all     Tail logs for all services"
	@echo "  make clean-all    Remove all containers/volumes (DESTRUCTIVE!)"
	@echo "  make build-all    Build platform and ISP Docker images"
	@echo ""
	@echo "$(YELLOW)Tip: see Makefile.platform and Makefile.isp for full target lists.$(NC)"

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

clean-all:
	@./scripts/infra.sh all clean

# ===================================================================
# Build (aggregated)
# ===================================================================

build-all:
	@echo "$(CYAN)Building all Docker images...$(NC)"
	@docker compose -f docker-compose.base.yml build
	@docker compose -f docker-compose.isp.yml build
