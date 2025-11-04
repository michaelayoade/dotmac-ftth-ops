#!/usr/bin/env bash
#
# dev-backend.sh - Start backend in local development mode
#
# This script:
# 1. Loads local environment variables
# 2. Checks if required services are running
# 3. Starts the backend via Poetry
#
# Usage:
#   ./scripts/dev-backend.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DotMac Backend - Local Development${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Load environment variables
if [ -f .env.local ]; then
  echo -e "${GREEN}✓ Loading .env.local${NC}"
  source .env.local
else
  echo -e "${YELLOW}⚠ .env.local not found${NC}"
  echo -e "${YELLOW}Creating from template...${NC}"

  if [ -f .env.local.example ]; then
    cp .env.local.example .env.local
    echo -e "${GREEN}✓ Created .env.local${NC}"
    echo -e "${YELLOW}Please review and customize .env.local, then run this script again${NC}"
    exit 0
  else
    echo -e "${RED}✗ .env.local.example not found${NC}"
    echo -e "${YELLOW}Creating minimal .env.local...${NC}"
    cat > .env.local <<'EOF'
# Minimal local development configuration
# NOTE: OTEL_ENDPOINT is base URL only - health check appends /v1/traces
export OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OBSERVABILITY__ALERTMANAGER_BASE_URL=
export ENVIRONMENT=development
export LOG_LEVEL=debug
EOF
    echo -e "${GREEN}✓ Created minimal .env.local${NC}"
    source .env.local
  fi
fi

# Set host-based defaults (override container defaults)
# NOTE: OTEL_ENDPOINT is base URL only - health check appends /v1/traces
export OBSERVABILITY__OTEL_ENDPOINT=${OBSERVABILITY__OTEL_ENDPOINT:-http://localhost:4318}
export OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
export OBSERVABILITY__ALERTMANAGER_BASE_URL=${OBSERVABILITY__ALERTMANAGER_BASE_URL:-}
export ENVIRONMENT=${ENVIRONMENT:-development}
export LOG_LEVEL=${LOG_LEVEL:-debug}

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  OTEL Endpoint: ${OBSERVABILITY__OTEL_ENDPOINT}"
echo -e "  Alertmanager: ${OBSERVABILITY__ALERTMANAGER_BASE_URL:-<disabled>}"
echo -e "  Environment: ${ENVIRONMENT}"
echo -e "  Log Level: ${LOG_LEVEL}"
echo ""

# Step 2: Check required services
echo -e "${BLUE}Checking required services...${NC}"

check_service() {
  local host=$1
  local port=$2
  local name=$3

  if timeout 1 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
    echo -e "${GREEN}✓ ${name} (${host}:${port})${NC}"
    return 0
  else
    echo -e "${RED}✗ ${name} (${host}:${port})${NC}"
    return 1
  fi
}

ALL_SERVICES_OK=true

check_service localhost 5432 "PostgreSQL" || ALL_SERVICES_OK=false
check_service localhost 6379 "Redis" || ALL_SERVICES_OK=false
check_service localhost 9000 "MinIO" || ALL_SERVICES_OK=false

# Optional services
if check_service localhost 4318 "OTEL Collector (HTTP)"; then
  : # success
else
  echo -e "${YELLOW}  ⚠ OTEL Collector not running (optional - traces disabled)${NC}"
fi

if [ -n "${OBSERVABILITY__ALERTMANAGER_BASE_URL:-}" ]; then
  if check_service localhost 9093 "Alertmanager"; then
    : # success
  else
    echo -e "${YELLOW}  ⚠ Alertmanager not running but enabled in config${NC}"
    echo -e "${YELLOW}  Set OBSERVABILITY__ALERTMANAGER_BASE_URL= to disable${NC}"
  fi
fi

echo ""

if [ "$ALL_SERVICES_OK" = false ]; then
  echo -e "${RED}✗ Required services missing${NC}"
  echo ""
  echo -e "${YELLOW}Start missing services with:${NC}"
  echo ""
  echo "  docker run -d --name postgres -p 5432:5432 \\"
  echo "    -e POSTGRES_DB=dotmac \\"
  echo "    -e POSTGRES_USER=dotmac_user \\"
  echo "    -e POSTGRES_PASSWORD=change-me \\"
  echo "    postgres:16"
  echo ""
  echo "  docker run -d --name redis -p 6379:6379 redis:7-alpine"
  echo ""
  echo "  docker run -d --name minio -p 9000:9000 -p 9001:9001 \\"
  echo "    -e MINIO_ROOT_USER=minioadmin \\"
  echo "    -e MINIO_ROOT_PASSWORD=minioadmin123 \\"
  echo "    minio/minio server /data --console-address \":9001\""
  echo ""
  exit 1
fi

# Step 3: Start backend
echo -e "${GREEN}✓ All required services running${NC}"
echo ""
echo -e "${BLUE}Starting backend...${NC}"
echo ""
echo -e "${YELLOW}Note: Environment variables are now exported in this shell${NC}"
echo ""

# Change to root directory and run poetry directly (not via pnpm)
# This ensures environment variables are properly inherited
cd "$(dirname "$0")/.."
exec poetry run uvicorn dotmac.platform.main:app --reload --host 0.0.0.0 --port 8000
