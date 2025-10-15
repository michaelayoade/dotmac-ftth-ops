#!/usr/bin/env bash
#
# Start WebSocket Control Workers
#
# This script starts the background workers that listen to Redis pub/sub
# channels and execute control commands for jobs and campaigns.
#
# Usage:
#   ./scripts/start_control_workers.sh
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string
#   REDIS_URL - Redis connection string
#   LOG_LEVEL - Logging level (default: INFO)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}Starting WebSocket Control Workers${NC}"
echo "======================================"
echo ""

# Check environment variables
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Example: export DATABASE_URL='postgresql://user:pass@localhost:5432/dotmac'"
    exit 1
fi

if [[ -z "${REDIS_URL:-}" ]]; then
    echo -e "${RED}ERROR: REDIS_URL environment variable is not set${NC}"
    echo "Example: export REDIS_URL='redis://localhost:6379/0'"
    exit 1
fi

# Set default log level
LOG_LEVEL="${LOG_LEVEL:-INFO}"

echo "Configuration:"
echo "  Database: ${DATABASE_URL%%@*}@***"
echo "  Redis: ${REDIS_URL%%@*}@***"
echo "  Log Level: $LOG_LEVEL"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check if poetry is available
if command -v poetry &> /dev/null; then
    echo -e "${GREEN}Using Poetry to run workers${NC}"
    PYTHON_CMD="poetry run python"
else
    echo -e "${YELLOW}Poetry not found, using system Python${NC}"
    PYTHON_CMD="python"
fi

# Start the workers
echo ""
echo -e "${GREEN}Starting control workers...${NC}"
echo "Press Ctrl+C to stop"
echo ""

$PYTHON_CMD -m dotmac.platform.realtime.control_workers

# Trap SIGINT and SIGTERM
trap 'echo -e "\n${YELLOW}Shutting down control workers...${NC}"; exit 0' INT TERM
