#!/bin/bash
# Health check script for all ISP Platform services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "ISP Platform - Health Check"
echo "========================================="
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local timeout=${3:-5}

    if curl -s -f --max-time "$timeout" "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is unhealthy or not responding"
        return 1
    fi
}

# Function to check TCP port
check_tcp() {
    local name=$1
    local host=$2
    local port=$3
    local timeout=${4:-2}

    if timeout "$timeout" bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name is accepting connections"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        return 1
    fi
}

# Function to check UDP port (limited check)
check_udp() {
    local name=$1
    local port=$2

    if netstat -an | grep -q ":$port.*udp"; then
        echo -e "${GREEN}✓${NC} $name port is open"
        return 0
    else
        echo -e "${YELLOW}?${NC} $name port status unknown"
        return 1
    fi
}

# Core Services
echo "Core Services:"
echo "---------------"
check_tcp "PostgreSQL" localhost 5432
check_tcp "Redis" localhost 6379
check_http "MinIO API" "http://localhost:9000/minio/health/live"
check_http "MinIO Console" "http://localhost:9001"
check_http "OpenBao" "http://localhost:8200/v1/sys/health"
echo ""

# ISP Services
echo "ISP Services:"
echo "---------------"
check_udp "FreeRADIUS Auth" 1812
check_udp "FreeRADIUS Acct" 1813
check_http "NetBox" "http://localhost:8080/api/"
check_tcp "MongoDB" localhost 27017
check_http "GenieACS NBI" "http://localhost:7557/devices"
check_http "GenieACS UI" "http://localhost:7567"
check_udp "WireGuard" 51820
check_http "LibreNMS" "http://localhost:8000"
check_http "Ansible AWX" "http://localhost:8052"
check_tcp "TimescaleDB" localhost 5433
echo ""

# Monitoring Services
echo "Monitoring Services:"
echo "--------------------"
check_http "Prometheus" "http://localhost:9090/-/healthy"
check_http "Grafana" "http://localhost:3000/api/health"
check_http "Jaeger UI" "http://localhost:16686"
check_http "Alertmanager" "http://localhost:9093/-/healthy"
check_http "Loki" "http://localhost:3100/ready"
check_tcp "Node Exporter" localhost 9100
check_tcp "cAdvisor" localhost 8081
echo ""

# Container Status
echo "Container Status:"
echo "-----------------"
echo "Core Services:"
docker compose ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null || echo "No core services running"
echo ""
echo "ISP Services:"
docker compose -f docker-compose.isp.yml ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null || echo "No ISP services running"
echo ""
echo "Monitoring Services:"
docker compose -f docker-compose.monitoring.yml ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null || echo "No monitoring services running"
echo ""

echo "========================================="
echo "Health check complete"
echo "========================================="
