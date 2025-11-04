#!/usr/bin/env bash
#
# check-external-services.sh - Verify external services are reachable before launching compose stacks
#
# The simplified Docker Compose files (base.yml, isp.yml) expect external services
# to be running on the host at host.docker.internal:
#   - PostgreSQL (5432)
#   - Redis (6379)
#   - MinIO (9000)
#   - Vault (8200) - optional if VAULT__ENABLED=false
#   - OTLP Collector (4317) - optional
#
# Usage:
#   ./scripts/check-external-services.sh [--required] [--all]
#
# Options:
#   --required    Check only required services (PostgreSQL, Redis, MinIO)
#   --all         Check all services including optional (Vault, OTLP)
#   (default)     Check required + warn about optional
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall status
ALL_REQUIRED_OK=true
ALL_OPTIONAL_OK=true

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}External Services Pre-Flight Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Parse arguments
CHECK_MODE="default"
if [[ $# -gt 0 ]]; then
  case "$1" in
    --required)
      CHECK_MODE="required"
      ;;
    --all)
      CHECK_MODE="all"
      ;;
    --help|-h)
      head -n 20 "$0" | grep "^#" | sed 's/^# *//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Run with --help for usage information"
      exit 1
      ;;
  esac
fi

# Function to check if a port is open
check_port() {
  local host=$1
  local port=$2
  local service_name=$3
  local is_optional=$4

  echo -n "Checking ${service_name} (${host}:${port})... "

  # Try to connect with timeout
  if timeout 2 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
    echo -e "${GREEN}✓ Reachable${NC}"
    return 0
  else
    if [[ "$is_optional" == "true" ]]; then
      echo -e "${YELLOW}⚠ Not reachable (optional)${NC}"
      ALL_OPTIONAL_OK=false
      return 1
    else
      echo -e "${RED}✗ Not reachable${NC}"
      ALL_REQUIRED_OK=false
      return 1
    fi
  fi
}

# Detect host.docker.internal resolution
echo -e "${BLUE}1. Checking host.docker.internal resolution...${NC}"
if getent hosts host.docker.internal >/dev/null 2>&1; then
  HOST_IP=$(getent hosts host.docker.internal | awk '{ print $1 }')
  echo -e "   ${GREEN}✓ Resolves to: ${HOST_IP}${NC}"
  DOCKER_HOST="host.docker.internal"
elif [[ "$(uname)" == "Darwin" ]] || [[ "$(uname)" == "Linux" ]] && docker info 2>/dev/null | grep -q "Docker Desktop"; then
  echo -e "   ${GREEN}✓ Docker Desktop detected - host.docker.internal available${NC}"
  DOCKER_HOST="host.docker.internal"
else
  echo -e "   ${YELLOW}⚠ host.docker.internal not resolved${NC}"
  echo -e "   ${YELLOW}Using localhost for checks (Linux without Docker Desktop?)${NC}"
  echo ""
  echo -e "   ${BLUE}Fix for Linux:${NC}"
  echo -e "   Add to docker-compose files under each service:"
  echo -e "   ${YELLOW}extra_hosts:"
  echo -e "     - \"host.docker.internal:host-gateway\"${NC}"
  echo ""
  DOCKER_HOST="localhost"
fi
echo ""

# Required services
echo -e "${BLUE}2. Checking required services...${NC}"
check_port "$DOCKER_HOST" 5432 "PostgreSQL" false
check_port "$DOCKER_HOST" 6379 "Redis" false
check_port "$DOCKER_HOST" 9000 "MinIO" false
echo ""

# Optional services
if [[ "$CHECK_MODE" != "required" ]]; then
  echo -e "${BLUE}3. Checking optional services...${NC}"
  check_port "$DOCKER_HOST" 8200 "Vault" true
  check_port "$DOCKER_HOST" 4317 "OTLP Collector" true
  echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [[ "$ALL_REQUIRED_OK" == true ]]; then
  echo -e "${GREEN}✓ All required services are reachable${NC}"
else
  echo -e "${RED}✗ Some required services are not reachable${NC}"
  echo ""
  echo -e "${YELLOW}Required services that must be running:${NC}"
  echo "  • PostgreSQL (port 5432)"
  echo "  • Redis (port 6379)"
  echo "  • MinIO (port 9000)"
  echo ""
  echo -e "${YELLOW}Quick start commands:${NC}"
  echo ""
  echo "  # PostgreSQL (using Docker)"
  echo "  docker run -d --name postgres -p 5432:5432 \\"
  echo "    -e POSTGRES_DB=dotmac \\"
  echo "    -e POSTGRES_USER=dotmac_user \\"
  echo "    -e POSTGRES_PASSWORD=change-me \\"
  echo "    postgres:16"
  echo ""
  echo "  # Redis (using Docker)"
  echo "  docker run -d --name redis -p 6379:6379 redis:7-alpine"
  echo ""
  echo "  # MinIO (using Docker)"
  echo "  docker run -d --name minio -p 9000:9000 -p 9001:9001 \\"
  echo "    -e MINIO_ROOT_USER=minioadmin \\"
  echo "    -e MINIO_ROOT_PASSWORD=minioadmin123 \\"
  echo "    minio/minio server /data --console-address \":9001\""
  echo ""
fi

if [[ "$CHECK_MODE" == "all" ]] && [[ "$ALL_OPTIONAL_OK" == false ]]; then
  echo -e "${YELLOW}⚠ Some optional services are not reachable${NC}"
  echo ""
  echo -e "${YELLOW}Optional services (backend will gracefully degrade):${NC}"
  echo "  • Vault (port 8200) - Set VAULT__ENABLED=false to disable"
  echo "  • OTLP Collector (port 4317) - Tracing disabled if unavailable"
  echo ""
fi

echo ""
echo -e "${BLUE}Environment Variable Overrides:${NC}"
echo "If your services run elsewhere, create a .env file:"
echo ""
echo "  # .env"
echo "  DATABASE__HOST=192.168.1.100"
echo "  REDIS__HOST=192.168.1.101"
echo "  STORAGE__ENDPOINT=http://192.168.1.102:9000"
echo "  VAULT__ENABLED=false  # Disable Vault if not needed"
echo ""

# Exit with error if required services are down
if [[ "$ALL_REQUIRED_OK" == false ]]; then
  echo -e "${RED}Pre-flight check FAILED${NC}"
  echo "Fix the issues above before running docker compose up"
  exit 1
else
  echo -e "${GREEN}Pre-flight check PASSED${NC}"
  echo "Ready to run: docker compose -f docker-compose.base.yml up -d"
  exit 0
fi
