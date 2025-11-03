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

# Check if PostgreSQL is running
if ! docker ps | grep -q "postgres.*Up"; then
    echo -e "${YELLOW}Warning: PostgreSQL container doesn't appear to be running${NC}"
    echo -e "${YELLOW}Starting Docker Compose services...${NC}"
    docker compose -f docker-compose.base.yml up -d postgres redis
    echo -e "${GREEN}Waiting for PostgreSQL to be ready...${NC}"
    sleep 5
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
