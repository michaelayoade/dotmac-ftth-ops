#!/usr/bin/env bash
#
# DotMac Post-Deployment Script
# ------------------------------
# Run this script after deploying the platform to:
#   1. Wait for backends to be healthy
#   2. Run database migrations
#   3. Verify API endpoints
#   4. Show access URLs
#
# Usage:
#   ./scripts/post-deploy.sh [platform|isp|all]
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

PROJECT_NAME=${COMPOSE_PROJECT_NAME:-$(basename "${PROJECT_ROOT}")}

PLATFORM_BACKEND_CONTAINER="${PROJECT_NAME}-platform-backend-1"
ISP_BACKEND_CONTAINER="${PROJECT_NAME}-isp-backend-1"

PLATFORM_API_PORT=${PLATFORM_BACKEND_PORT:-8001}
ISP_API_PORT=${ISP_BACKEND_PORT:-8000}

PLATFORM_FRONTEND_PORT=${PLATFORM_FRONTEND_PORT:-3002}
ISP_FRONTEND_PORT=${ISP_FRONTEND_PORT:-3001}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}DotMac Platform - Post-Deployment Setup${NC}          ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_usage() {
    cat <<EOF
${CYAN}Usage:${NC}
  ./scripts/post-deploy.sh [mode]

${CYAN}Modes:${NC}
  ${GREEN}platform${NC}    Setup platform backend only
  ${GREEN}isp${NC}         Setup ISP backend only
  ${GREEN}all${NC}         Setup both backends (default)

${CYAN}What this script does:${NC}
  1. Wait for backend containers to be healthy
  2. Run Alembic database migrations
  3. Verify API health endpoints
  4. Display access URLs for frontends and APIs

${CYAN}Examples:${NC}
  ./scripts/post-deploy.sh all
  ./scripts/post-deploy.sh platform
EOF
}

check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker daemon is not available${NC}"
        exit 1
    fi
}

wait_for_container_healthy() {
    local container=$1
    local service_name=$2
    local max_wait=120
    local waited=0

    echo -e "${CYAN}Waiting for ${service_name} to be healthy...${NC}"

    while [ $waited -lt $max_wait ]; do
        if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            echo -e "${RED}✗ Container ${container} is not running${NC}"
            return 1
        fi

        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "none")

        if [[ "${health}" == "healthy" ]]; then
            echo -e "${GREEN}✓ ${service_name} is healthy${NC}"
            return 0
        fi

        # If no healthcheck, check if container is running
        if [[ "${health}" == "none" ]]; then
            local status
            status=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "unknown")
            if [[ "${status}" == "running" ]]; then
                echo -e "${GREEN}✓ ${service_name} is running${NC}"
                return 0
            fi
        fi

        echo -e "${YELLOW}  Waiting... (${waited}s/${max_wait}s)${NC}"
        sleep 5
        waited=$((waited + 5))
    done

    echo -e "${RED}✗ ${service_name} did not become healthy within ${max_wait} seconds${NC}"
    echo -e "${YELLOW}  You can check logs with: docker logs ${container}${NC}"
    return 1
}

run_migrations() {
    local container=$1
    local service_name=$2

    echo -e "${CYAN}Running database migrations for ${service_name}...${NC}"

    if ! docker exec "${container}" alembic upgrade head 2>&1; then
        echo -e "${RED}✗ Migration failed for ${service_name}${NC}"
        echo -e "${YELLOW}  Check the logs above for details${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Migrations completed for ${service_name}${NC}"
    return 0
}

verify_api() {
    local port=$1
    local service_name=$2
    local host=${3:-localhost}

    echo -e "${CYAN}Verifying ${service_name} API...${NC}"

    local health_url="http://${host}:${port}/health"
    if curl -sf "${health_url}" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ ${service_name} API is responding${NC}"
        echo -e "  ${CYAN}→${NC} ${health_url}"
        return 0
    else
        echo -e "${YELLOW}⚠ ${service_name} API health check failed${NC}"
        echo -e "  ${CYAN}→${NC} ${health_url}"
        echo -e "  ${YELLOW}Note: The backend might still be initializing${NC}"
        return 1
    fi
}

show_access_urls() {
    local mode=$1

    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Access URLs${NC}                                       ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [[ "${mode}" == "platform" ]] || [[ "${mode}" == "all" ]]; then
        echo -e "${GREEN}Platform Admin:${NC}"
        echo -e "  Frontend:     ${CYAN}http://localhost:${PLATFORM_FRONTEND_PORT}${NC}"
        echo -e "  API:          ${CYAN}http://localhost:${PLATFORM_API_PORT}${NC}"
        echo -e "  API Docs:     ${CYAN}http://localhost:${PLATFORM_API_PORT}/docs${NC}"
        echo ""
    fi

    if [[ "${mode}" == "isp" ]] || [[ "${mode}" == "all" ]]; then
        echo -e "${GREEN}ISP Operations:${NC}"
        echo -e "  Frontend:     ${CYAN}http://localhost:${ISP_FRONTEND_PORT}${NC}"
        echo -e "  API:          ${CYAN}http://localhost:${ISP_API_PORT}${NC}"
        echo -e "  API Docs:     ${CYAN}http://localhost:${ISP_API_PORT}/docs${NC}"
        echo ""
    fi
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

setup_platform() {
    echo -e "${CYAN}Setting up Platform backend...${NC}"
    echo ""

    if wait_for_container_healthy "${PLATFORM_BACKEND_CONTAINER}" "Platform backend"; then
        run_migrations "${PLATFORM_BACKEND_CONTAINER}" "Platform"
        sleep 2
        verify_api "${PLATFORM_API_PORT}" "Platform"
    else
        echo -e "${RED}✗ Platform backend setup failed${NC}"
        return 1
    fi
}

setup_isp() {
    echo -e "${CYAN}Setting up ISP backend...${NC}"
    echo ""

    if wait_for_container_healthy "${ISP_BACKEND_CONTAINER}" "ISP backend"; then
        run_migrations "${ISP_BACKEND_CONTAINER}" "ISP"
        sleep 2
        verify_api "${ISP_API_PORT}" "ISP"
    else
        echo -e "${RED}✗ ISP backend setup failed${NC}"
        return 1
    fi
}

setup_all() {
    # Run migrations only once since both backends share the same database
    echo -e "${CYAN}Setting up shared database migrations...${NC}"
    echo ""

    if wait_for_container_healthy "${PLATFORM_BACKEND_CONTAINER}" "Platform backend"; then
        run_migrations "${PLATFORM_BACKEND_CONTAINER}" "Shared Database"
        sleep 2
        verify_api "${PLATFORM_API_PORT}" "Platform"
    else
        echo -e "${RED}✗ Platform backend setup failed${NC}"
        return 1
    fi

    echo ""

    # ISP backend - skip migrations, just verify API
    echo -e "${CYAN}Setting up ISP backend...${NC}"
    echo ""

    if wait_for_container_healthy "${ISP_BACKEND_CONTAINER}" "ISP backend"; then
        echo -e "${YELLOW}ℹ Skipping migrations for ISP (already run on shared database)${NC}"
        sleep 2
        verify_api "${ISP_API_PORT}" "ISP"
    else
        echo -e "${RED}✗ ISP backend setup failed${NC}"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    print_header
    print_usage
    exit 0
fi

MODE=${1:-all}

print_header
check_docker

case "${MODE}" in
    platform)
        setup_platform
        show_access_urls "platform"
        ;;
    isp)
        setup_isp
        show_access_urls "isp"
        ;;
    all)
        setup_all
        show_access_urls "all"
        ;;
    *)
        echo -e "${RED}Unknown mode '${MODE}'${NC}"
        echo ""
        print_usage
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Post-deployment setup complete!${NC}"
echo ""
