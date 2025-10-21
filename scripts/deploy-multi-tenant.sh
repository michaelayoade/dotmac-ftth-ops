#!/bin/bash

# Multi-Tenant Deployment Script
# Deploys DotMac platform in SaaS mode with both platform and tenant apps

set -e

echo "=========================================="
echo "DotMac Multi-Tenant Deployment"
echo "=========================================="
echo ""

# Check if .env.multi-tenant exists
if [ ! -f .env.multi-tenant ]; then
    echo "❌ Error: .env.multi-tenant file not found"
    echo "📝 Copy .env.multi-tenant.example to .env.multi-tenant and configure"
    exit 1
fi

# Validate required environment variables
source .env.multi-tenant

REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "SECRET_KEY")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required variable $var not set in .env.multi-tenant"
        exit 1
    fi
done

echo "✅ Environment variables validated"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.multi-tenant.yml down

# Build images
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.multi-tenant.yml build

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.multi-tenant.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking service health..."
docker-compose -f docker-compose.multi-tenant.yml ps

# Run database migrations
echo "📦 Running database migrations..."
docker-compose -f docker-compose.multi-tenant.yml exec -T dotmac-platform \
    poetry run alembic upgrade head

# Seed RBAC permissions
echo "🔐 Seeding RBAC permissions..."
docker-compose -f docker-compose.multi-tenant.yml exec -T dotmac-platform \
    poetry run python -m dotmac.platform.auth.isp_permissions

echo ""
echo "=========================================="
echo "✅ Multi-Tenant Deployment Complete!"
echo "=========================================="
echo ""
echo "📍 Services available at:"
echo "   • Platform API: http://localhost:8000/api/platform/v1"
echo "   • Tenant API:   http://localhost:8000/api/tenant/v1"
echo "   • Health:       http://localhost:8000/health"
echo "   • MinIO:        http://localhost:9001"
echo ""
echo "📚 API Documentation:"
echo "   • OpenAPI: http://localhost:8000/docs"
echo "   • ReDoc:   http://localhost:8000/redoc"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs:  docker-compose -f docker-compose.multi-tenant.yml logs -f"
echo "   • Stop:       docker-compose -f docker-compose.multi-tenant.yml down"
echo "   • Restart:    docker-compose -f docker-compose.multi-tenant.yml restart dotmac-platform"
echo ""
