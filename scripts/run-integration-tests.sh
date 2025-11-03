#!/bin/bash
#
# Run Integration Tests Script
#
# This script runs integration tests with proper environment configuration.
# It handles Docker service URLs vs localhost URLs automatically.
#
# Usage:
#   ./scripts/run-integration-tests.sh [test-path]
#
# Examples:
#   ./scripts/run-integration-tests.sh                    # Run all integration tests
#   ./scripts/run-integration-tests.sh tests/netbox/      # Run NetBox tests only
#   ./scripts/run-integration-tests.sh tests/infra/       # Run RADIUS tests only
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Integration Tests Runner ===${NC}\n"

# Check if we're running inside Docker
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Running inside Docker container"
    IN_DOCKER=true
else
    echo -e "${YELLOW}⚠${NC}  Running outside Docker (on host machine)"
    IN_DOCKER=false
fi

echo ""

# Save current environment variables
OLD_NETBOX_URL="${NETBOX_URL:-}"
OLD_VAULT_URL="${VAULT_URL:-}"
OLD_VAULT__URL="${VAULT__URL:-}"

# Unset Docker service URLs when running from host
if [ "$IN_DOCKER" = false ]; then
    echo -e "${YELLOW}Unsetting Docker service URLs for host-based testing...${NC}"
    unset NETBOX_URL
    unset VAULT_URL
    unset VAULT__URL
    echo "  - NETBOX_URL: Will auto-detect (http://localhost:8080)"
    echo "  - VAULT_URL: Will auto-detect (http://localhost:8200)"
    echo ""
else
    echo -e "${GREEN}Using Docker service names...${NC}"
    echo "  - NETBOX_URL: ${NETBOX_URL:-http://netbox:8080}"
    echo "  - VAULT_URL: ${VAULT_URL:-http://vault:8200}"
    echo ""
fi

# Determine what tests to run
TEST_PATH="${1:-tests/infra/ tests/netbox/ tests/secrets/}"
echo -e "${GREEN}Running tests:${NC} $TEST_PATH"
echo ""

# Run tests
echo -e "${GREEN}Starting pytest...${NC}\n"
poetry run pytest $TEST_PATH -m integration -v --tb=short

# Capture exit code
EXIT_CODE=$?

# Restore environment variables (for interactive sessions)
if [ "$IN_DOCKER" = false ]; then
    export NETBOX_URL="$OLD_NETBOX_URL"
    export VAULT_URL="$OLD_VAULT_URL"
    export VAULT__URL="$OLD_VAULT__URL"
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed (exit code: $EXIT_CODE)${NC}"
fi

exit $EXIT_CODE
