#!/bin/bash

# Start Multi-Tenant Staging Deployment
# Loads environment from .env.multi-tenant and starts the server

set -e

echo "=========================================="
echo "Starting Multi-Tenant Staging Deployment"
echo "=========================================="
echo ""

# Load environment variables
if [ ! -f .env.multi-tenant ]; then
    echo "❌ Error: .env.multi-tenant file not found"
    exit 1
fi

echo "✅ Loading environment from .env.multi-tenant"
export $(grep -v '^#' .env.multi-tenant | grep -v '^$' | xargs)

echo "✅ Environment loaded"
echo "   DEPLOYMENT_MODE: $DEPLOYMENT_MODE"
echo "   ENVIRONMENT: $ENVIRONMENT"
echo "   DATABASE: PostgreSQL at localhost:5432"
echo "   REDIS: localhost:6379"
echo ""

# Start server
echo "🚀 Starting FastAPI server on $HOST:$PORT..."
echo ""

poetry run uvicorn dotmac.platform.main:app --host "$HOST" --port "$PORT"
