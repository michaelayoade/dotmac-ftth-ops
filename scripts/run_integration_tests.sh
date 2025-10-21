#!/usr/bin/env bash
#
# Run Integration Tests
#
# This script runs integration tests for the DotMac Platform.
# It ensures infrastructure is running and executes pytest with integration markers.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  DotMac Platform - Integration Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if infrastructure is running
check_infrastructure() {
    echo -e "${YELLOW}→${NC} Checking infrastructure status..."

    local services_required=("postgres" "redis")
    local all_running=true

    for service in "${services_required[@]}"; do
        if docker compose ps --services --filter "status=running" | grep -q "^${service}$"; then
            echo -e "${GREEN}  ✓${NC} ${service} is running"
        else
            echo -e "${RED}  ✗${NC} ${service} is NOT running"
            all_running=false
        fi
    done

    if [ "$all_running" = false ]; then
        echo ""
        echo -e "${RED}✗ Infrastructure is not fully running${NC}"
        echo -e "${YELLOW}→${NC} Run 'make docker-up' or 'docker compose up -d postgres redis' to start services"
        exit 1
    fi

    echo -e "${GREEN}✓ Infrastructure is ready${NC}"
    echo ""
}

# Function to wait for services
wait_for_services() {
    echo -e "${YELLOW}→${NC} Waiting for services to be healthy..."

    # Wait for PostgreSQL
    echo -n "  Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U dotmac_user >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo -e " ${RED}✗ (timeout)${NC}"
            exit 1
        fi
        sleep 1
        echo -n "."
    done

    # Wait for Redis
    echo -n "  Waiting for Redis..."
    for i in {1..30}; do
        if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo -e " ${RED}✗ (timeout)${NC}"
            exit 1
        fi
        sleep 1
        echo -n "."
    done

    echo ""
}

# Function to run database migrations
run_migrations() {
    echo -e "${YELLOW}→${NC} Running database migrations..."

    if poetry run python -m alembic upgrade head; then
        echo -e "${GREEN}✓ Migrations applied successfully${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        exit 1
    fi
    echo ""
}

# Function to run integration tests
run_tests() {
    echo -e "${YELLOW}→${NC} Running integration tests..."
    echo ""

    # Set test environment variables
    export ENVIRONMENT=testing
    export DATABASE_URL="${DATABASE_URL:-postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac_test}"
    export REDIS_URL="${REDIS_URL:-redis://:change-me-in-production@localhost:6379/1}"

    # Run pytest with integration markers
    local test_args=(
        "tests/integration"
        "-v"
        "--tb=short"
        "--strict-markers"
        "-m" "integration"
        "--maxfail=5"
        "--disable-warnings"
    )

    # Add coverage if requested
    if [ "${COVERAGE:-false}" = "true" ]; then
        test_args+=(
            "--cov=src/dotmac/platform"
            "--cov-report=term-missing"
            "--cov-report=html:htmlcov"
        )
    fi

    # Add parallel execution if requested
    if [ "${PARALLEL:-false}" = "true" ]; then
        test_args+=("-n" "auto")
    fi

    # Run tests
    if poetry run pytest "${test_args[@]}" "$@"; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  ✓ All integration tests passed!${NC}"
        echo -e "${GREEN}========================================${NC}"

        if [ "${COVERAGE:-false}" = "true" ]; then
            echo ""
            echo -e "${BLUE}Coverage report generated: htmlcov/index.html${NC}"
        fi

        return 0
    else
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  ✗ Some integration tests failed${NC}"
        echo -e "${RED}========================================${NC}"
        return 1
    fi
}

# Main execution
main() {
    # Check if running in CI
    if [ "${CI:-false}" = "true" ]; then
        echo -e "${BLUE}Running in CI mode${NC}"
        echo ""
    fi

    # Check infrastructure
    check_infrastructure

    # Wait for services to be healthy
    wait_for_services

    # Run migrations
    run_migrations

    # Run tests
    run_tests "$@"
}

# Show help
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "Usage: $0 [pytest-options]"
    echo ""
    echo "Environment variables:"
    echo "  COVERAGE=true    Enable coverage reporting"
    echo "  PARALLEL=true    Run tests in parallel"
    echo "  CI=true          Run in CI mode"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all integration tests"
    echo "  $0 -k test_customer                  # Run tests matching pattern"
    echo "  COVERAGE=true $0                     # Run with coverage"
    echo "  PARALLEL=true $0                     # Run in parallel"
    echo ""
    exit 0
fi

# Run main function
main "$@"
