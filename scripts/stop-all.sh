#!/bin/bash
# Stop all ISP Platform services

set -e

echo "Stopping ISP Operations Platform services..."

echo ""
echo "Stopping monitoring services..."
docker compose -f docker-compose.monitoring.yml down

echo ""
echo "Stopping ISP services..."
docker compose -f docker-compose.isp.yml down

echo ""
echo "Stopping core services..."
docker compose down

echo ""
echo "✓ All services stopped"
echo ""
echo "To start again, run: ./scripts/init-infrastructure.sh"
