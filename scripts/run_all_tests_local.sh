#!/usr/bin/env bash
#
# Run all tests locally including previously skipped tests
# This script:
# 1. Enables subscription load tests
# 2. Uses PostgreSQL instead of SQLite (avoids SQLite-specific skips)
#

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running all tests locally (no skips)${NC}"
echo -e "${BLUE}========================================${NC}"

# Ensure a PostgreSQL instance is reachable before running migrations.
DB_HOST=${DOTMAC_TEST_DB_HOST:-${DATABASE__HOST:-localhost}}
DB_PORT=${DOTMAC_TEST_DB_PORT:-${DATABASE__PORT:-5432}}

if command -v pg_isready >/dev/null 2>&1; then
    if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Unable to reach PostgreSQL at ${DB_HOST}:${DB_PORT}.${NC}"
        echo -e "${YELLOW}Ensure your database service is running and connection variables are set.${NC}"
    fi
else
    echo -e "${YELLOW}pg_isready not found; skipping PostgreSQL reachability check.${NC}"
fi

# Export test configuration
export RUN_SUBSCRIPTION_LOAD_TESTS=1
export DOTMAC_DATABASE_URL_ASYNC="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac"
export DOTMAC_DATABASE_URL="postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"

# Ensure migrations are current
echo -e "${GREEN}Applying database migrations...${NC}"
poetry run alembic upgrade head

# Run tests
echo -e "${GREEN}Running tests...${NC}"
echo ""

if [ "$#" -eq 0 ]; then
    # No arguments - run all tests
    poetry run pytest tests/ -v
else
    # Pass through any arguments (e.g., specific test files or markers)
    poetry run pytest "$@"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Tests complete!${NC}"
echo -e "${GREEN}========================================${NC}"
