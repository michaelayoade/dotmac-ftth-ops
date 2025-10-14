#!/bin/bash
# View logs for ISP Platform services

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "Usage: ./scripts/logs.sh <service-name>"
    echo ""
    echo "Available services:"
    echo ""
    echo "Core Services:"
    echo "  postgres, redis, minio, openbao, celery-worker, celery-beat, flower"
    echo ""
    echo "ISP Services:"
    echo "  freeradius, netbox, netbox-worker, mongodb, genieacs, wireguard, librenms, awx-web, awx-task, timescaledb"
    echo ""
    echo "Monitoring Services:"
    echo "  prometheus, grafana, jaeger, alertmanager, node-exporter, cadvisor, loki, promtail"
    echo ""
    echo "Examples:"
    echo "  ./scripts/logs.sh freeradius"
    echo "  ./scripts/logs.sh netbox"
    echo "  ./scripts/logs.sh prometheus"
    exit 1
fi

# Determine which compose file the service belongs to
COMPOSE_FILE=""

# Core services
if docker compose ps | grep -q "$SERVICE"; then
    COMPOSE_FILE="docker-compose.yml"
# ISP services
elif docker compose -f docker-compose.isp.yml ps | grep -q "$SERVICE"; then
    COMPOSE_FILE="docker-compose.isp.yml"
# Monitoring services
elif docker compose -f docker-compose.monitoring.yml ps | grep -q "$SERVICE"; then
    COMPOSE_FILE="docker-compose.monitoring.yml"
else
    echo "Error: Service '$SERVICE' not found"
    exit 1
fi

echo "Showing logs for: $SERVICE"
echo "Press Ctrl+C to exit"
echo ""

if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
    docker compose logs -f "$SERVICE"
else
    docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
fi
