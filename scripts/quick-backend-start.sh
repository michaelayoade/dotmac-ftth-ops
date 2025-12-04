#!/usr/bin/env bash
# Quick backend start with environment loaded

set -euo pipefail

# Change to project root (parent of scripts directory)
cd "$(dirname "$0")/.."

# Load environment
if [ -f .env.local ]; then
  echo "Loading .env.local..."
  source .env.local
else
  echo "ERROR: .env.local not found!"
  echo "Run: cp .env.local.example .env.local"
  exit 1
fi

# Ensure required defaults for host-based development
export OBSERVABILITY__OTEL_ENDPOINT=${OBSERVABILITY__OTEL_ENDPOINT:-http://localhost:4318}
export OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
export OBSERVABILITY__ALERTMANAGER_BASE_URL=${OBSERVABILITY__ALERTMANAGER_BASE_URL:-}

echo "Environment loaded:"
echo "  OBSERVABILITY__OTEL_ENDPOINT: ${OBSERVABILITY__OTEL_ENDPOINT:-<not set>}"
echo "  OTEL_EXPORTER_OTLP_ENDPOINT: ${OTEL_EXPORTER_OTLP_ENDPOINT:-<not set>}"
echo "  OBSERVABILITY__ALERTMANAGER_BASE_URL: ${OBSERVABILITY__ALERTMANAGER_BASE_URL:-<not set>}"
echo ""
echo "Starting backend..."
echo ""

# Start backend with poetry directly
exec poetry run uvicorn dotmac.platform.main:app --reload --host 0.0.0.0 --port 8000
