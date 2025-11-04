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
echo "   DEPLOYMENT_MODE: ${DEPLOYMENT_MODE:-multi_tenant}"
echo "   ENVIRONMENT: ${ENVIRONMENT:-staging}"
echo "   API container: docker-compose.base.yml (platform-backend service)"
echo ""

# Start server via Docker Compose
echo "🚀 Starting FastAPI app container..."
echo "   (Ctrl+C to stop; use 'docker compose -f docker-compose.base.yml down' to tear down)"
echo ""

docker compose -f docker-compose.base.yml up platform-backend
