#!/usr/bin/env bash
#
# DotMac Infrastructure Management Script
#
# Manages three deployment modes:
#   - platform: Base infrastructure (postgres, redis, vault, minio, observability)
#   - isp: ISP services (FreeRADIUS, NetBox, GenieACS, AWX, etc.)
#   - all: Both platform + ISP services
#
# Usage:
#   ./scripts/infra.sh <mode> <command>
#
# Modes:
#   platform    - Base platform infrastructure only
#   isp         - ISP-specific services only
#   all         - Complete stack (platform + ISP)
#
# Commands:
#   start       - Start services
#   stop        - Stop services
#   restart     - Restart services
#   status      - Check service status
#   logs        - View service logs
#   clean       - Stop and remove containers/volumes
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Docker Compose files
COMPOSE_BASE="docker-compose.base.yml"
COMPOSE_ISP="docker-compose.isp.yml"

# Service definitions
PLATFORM_SERVICES=(
    "postgres:5432:Database"
    "redis:6379:Cache & Queue"
    "vault:8200:Secrets (optional)"
    "minio:9000:Object Storage (optional)"
)

PLATFORM_OBSERVABILITY=(
    "otel-collector:4318:Telemetry Collector"
    "jaeger:16686:Distributed Tracing"
    "prometheus:9090:Metrics Storage"
    "grafana:3400:Dashboards"
)

ISP_SERVICES=(
    "freeradius:1812:AAA Server"
    "netbox:8080:Network Inventory"
    "netbox-worker::NetBox Background Worker"
    "genieacs:7567:TR-069 ACS"
    "mongodb:27017:GenieACS Database"
    "awx-web:8052:Ansible Automation"
    "awx-task::AWX Background Tasks"
    "librenms:8000:Network Monitoring"
    "wireguard:51820:VPN Gateway"
    "timescaledb:5433:Time-Series Database"
    "alertmanager:9093:Alert Routing (monitoring profile)"
    "prometheus:9090:Metrics (monitoring profile)"
    "grafana:3400:Dashboards (monitoring profile)"
    "node-exporter:9100:Host Metrics (monitoring profile)"
    "cadvisor:8082:Container Metrics (monitoring profile)"
    "postgres-exporter:9187:PostgreSQL Metrics (monitoring profile)"
    "redis-exporter:9121:Redis Metrics (monitoring profile)"
)

# Print functions
print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}DotMac Platform - Infrastructure Manager${NC}              ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_usage() {
    cat << EOF
${CYAN}Usage:${NC}
  $0 <mode> <command> [options]

${CYAN}Modes:${NC}
  ${GREEN}platform${NC}    Base infrastructure (postgres, redis, vault, minio, observability)
  ${GREEN}isp${NC}         ISP services (FreeRADIUS, NetBox, GenieACS, AWX, LibreNMS, etc.)
  ${GREEN}all${NC}         Complete stack (platform + ISP)

${CYAN}Commands:${NC}
  ${GREEN}start${NC}       Start services
  ${GREEN}stop${NC}        Stop services
  ${GREEN}restart${NC}     Restart services
  ${GREEN}status${NC}      Check service status
  ${GREEN}logs${NC}        View service logs (add service name: logs postgres)
  ${GREEN}clean${NC}       Stop and remove containers/volumes (use with caution!)

${CYAN}Examples:${NC}
  $0 platform start              # Start base infrastructure
  $0 platform start --with-obs   # Start with observability stack
  $0 isp start                   # Start ISP services
  $0 all start                   # Start everything
  $0 platform status             # Check platform service status
  $0 isp logs freeradius         # View FreeRADIUS logs

${CYAN}Service Ports:${NC}
  ${YELLOW}Platform:${NC}
    PostgreSQL:     5432
    Redis:          6379
    Vault:          8200
    MinIO:          9000, 9001 (console)
    Jaeger UI:      16686
    Prometheus:     9090
    Grafana:        3400

  ${YELLOW}ISP Services:${NC}
    FreeRADIUS:     1812-1813 (UDP)
    NetBox:         8080
    GenieACS:       7567
    AWX:            8052
    LibreNMS:       8000
    TimescaleDB:    5433

EOF
}

# Check Docker
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        echo -e "${YELLOW}→ Please start Docker Desktop${NC}"
        exit 1
    fi
}

# Get container status
get_container_status() {
    local container=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "running"
    elif docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "stopped"
    else
        echo "not_created"
    fi
}

# Check if container is healthy
is_healthy() {
    local container=$1
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    [[ "$health" == "healthy" ]] && return 0
    [[ "$health" == "none" ]] && docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null | grep -q "running" && return 0
    return 1
}

# Start platform services
start_platform() {
    local with_obs=$1

    echo -e "${CYAN}Starting Platform Infrastructure...${NC}"
    echo ""

    # Start core services
    docker compose -f "$COMPOSE_BASE" up -d postgres redis vault minio

    # Start observability if requested
    if [[ "$with_obs" == "true" ]]; then
        echo -e "${CYAN}Starting Observability Stack...${NC}"
        docker compose -f "$COMPOSE_BASE" --profile observability up -d otel-collector jaeger prometheus grafana
    fi

    echo ""
    sleep 3
    status_platform "$with_obs"
}

# Start ISP services
start_isp() {
    local with_obs=${1:-false}

    echo -e "${CYAN}Starting ISP Services...${NC}"
    echo ""

    # Check if platform is running
    if ! docker ps --format '{{.Names}}' | grep -q "postgres"; then
        echo -e "${YELLOW}⚠ Platform infrastructure not detected${NC}"
        echo -e "${YELLOW}→ Starting base infrastructure first...${NC}"
        echo ""
        start_platform "false"
        echo ""
    fi

    # Rebuild FreeRADIUS if needed (Apple Silicon)
    if [[ $(uname -m) == "arm64" ]]; then
        if ! docker images | grep -q "freeradius-postgresql"; then
            echo -e "${CYAN}Building FreeRADIUS image for Apple Silicon...${NC}"
            docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .
            echo ""
        fi
    fi

    docker compose -f "$COMPOSE_ISP" up -d

    if [[ "$with_obs" == "true" ]]; then
        echo ""
        echo -e "${CYAN}Starting ISP monitoring profile...${NC}"
        docker compose -f "$COMPOSE_ISP" --profile monitoring up -d
    fi

    echo ""
    sleep 5
    status_isp
}

# Start all services
start_all() {
    local with_obs=${1:-false}

    if [[ "$with_obs" == "true" ]]; then
        echo -e "${YELLOW}→ Using ISP monitoring stack; skipping platform observability to avoid port conflicts${NC}"
    fi

    start_platform "false"
    echo ""
    start_isp "$with_obs"
}

# Stop platform services
stop_platform() {
    echo -e "${CYAN}Stopping Platform Infrastructure...${NC}"
    docker compose -f "$COMPOSE_BASE" --profile observability down
}

# Stop ISP services
stop_isp() {
    echo -e "${CYAN}Stopping ISP Services...${NC}"
    docker compose -f "$COMPOSE_ISP" down
}

# Stop all services
stop_all() {
    stop_isp
    stop_platform
}

# Status for platform
status_platform() {
    local with_obs=${1:-false}

    echo -e "${CYAN}Platform Infrastructure Status:${NC}"
    echo ""

    for service_info in "${PLATFORM_SERVICES[@]}"; do
        IFS=':' read -r service port description <<< "$service_info"
        local container="dotmac-ftth-ops-${service}-1"
        local status=$(get_container_status "$container")

        case "$status" in
            running)
                if is_healthy "$container"; then
                    echo -e "  ${GREEN}✓${NC} ${service} (${description}) - ${GREEN}healthy${NC}"
                    [[ -n "$port" ]] && echo -e "    ${CYAN}→${NC} Port: $port"
                else
                    echo -e "  ${YELLOW}◆${NC} ${service} (${description}) - ${YELLOW}starting${NC}"
                    [[ -n "$port" ]] && echo -e "    ${CYAN}→${NC} Port: $port"
                fi
                ;;
            stopped)
                echo -e "  ${RED}✗${NC} ${service} (${description}) - ${RED}stopped${NC}"
                ;;
            *)
                echo -e "  ${YELLOW}○${NC} ${service} (${description}) - ${YELLOW}not created${NC}"
                ;;
        esac
    done

    if [[ "$with_obs" == "true" ]]; then
        echo ""
        echo -e "${CYAN}Observability Stack:${NC}"
        echo ""

        for service_info in "${PLATFORM_OBSERVABILITY[@]}"; do
            IFS=':' read -r service port description <<< "$service_info"
            local container="dotmac-ftth-ops-${service}-1"
            local status=$(get_container_status "$container")

            case "$status" in
                running)
                    echo -e "  ${GREEN}✓${NC} ${service} (${description}) - ${GREEN}running${NC}"
                    [[ -n "$port" ]] && echo -e "    ${CYAN}→${NC} http://localhost:$port"
                    ;;
                stopped)
                    echo -e "  ${RED}✗${NC} ${service} (${description}) - ${RED}stopped${NC}"
                    ;;
                *)
                    echo -e "  ${YELLOW}○${NC} ${service} (${description}) - ${YELLOW}not created${NC}"
                    ;;
            esac
        done
    fi
}

# Status for ISP
status_isp() {
    echo -e "${CYAN}ISP Services Status:${NC}"
    echo ""

    for service_info in "${ISP_SERVICES[@]}"; do
        IFS=':' read -r service port description <<< "$service_info"
        local container="isp-${service}"
        local status=$(get_container_status "$container")

        case "$status" in
            running)
                if is_healthy "$container"; then
                    echo -e "  ${GREEN}✓${NC} ${service} (${description}) - ${GREEN}healthy${NC}"
                else
                    echo -e "  ${YELLOW}◆${NC} ${service} (${description}) - ${YELLOW}running${NC}"
                fi
                [[ -n "$port" ]] && echo -e "    ${CYAN}→${NC} Port: $port"
                ;;
            stopped)
                echo -e "  ${RED}✗${NC} ${service} (${description}) - ${RED}stopped${NC}"
                ;;
            *)
                echo -e "  ${YELLOW}○${NC} ${service} (${description}) - ${YELLOW}not created${NC}"
                ;;
        esac
    done
}

# Status for all
status_all() {
    status_platform "true"
    echo ""
    status_isp
}

# Show logs
show_logs() {
    local mode=$1
    shift
    local service=${1:-}

    case "$mode" in
        platform)
            if [[ -n "$service" ]]; then
                docker compose -f "$COMPOSE_BASE" logs -f "$service"
            else
                docker compose -f "$COMPOSE_BASE" logs -f
            fi
            ;;
        isp)
            if [[ -n "$service" ]]; then
                docker compose -f "$COMPOSE_ISP" logs -f "$service"
            else
                docker compose -f "$COMPOSE_ISP" logs -f
            fi
            ;;
        all)
            if [[ -n "$service" ]]; then
                echo -e "${YELLOW}Specify 'platform' or 'isp' mode for service logs${NC}"
                exit 1
            fi
            docker compose -f "$COMPOSE_BASE" logs -f &
            docker compose -f "$COMPOSE_ISP" logs -f &
            wait
            ;;
    esac
}

# Clean (remove containers and volumes)
clean_platform() {
    echo -e "${RED}⚠ WARNING: This will remove all platform containers and volumes!${NC}"
    read -p "Continue? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        docker compose -f "$COMPOSE_BASE" --profile observability down -v
        echo -e "${GREEN}✓ Platform infrastructure cleaned${NC}"
    else
        echo "Cancelled"
    fi
}

clean_isp() {
    echo -e "${RED}⚠ WARNING: This will remove all ISP service containers and volumes!${NC}"
    read -p "Continue? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        docker compose -f "$COMPOSE_ISP" down -v
        echo -e "${GREEN}✓ ISP services cleaned${NC}"
    else
        echo "Cancelled"
    fi
}

clean_all() {
    echo -e "${RED}⚠ WARNING: This will remove ALL containers and volumes!${NC}"
    read -p "Continue? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        clean_isp
        clean_platform
    else
        echo "Cancelled"
    fi
}

# Main
main() {
    if [[ $# -lt 2 ]]; then
        print_header
        print_usage
        exit 1
    fi

    local mode=$1
    local command=$2
    shift 2

    check_docker
    print_header

    # Parse additional flags
    local with_obs="false"
    for arg in "$@"; do
        case "$arg" in
            --with-obs|--observability)
                with_obs="true"
                ;;
        esac
    done

    case "$mode" in
        platform)
            case "$command" in
                start) start_platform "$with_obs" ;;
                stop) stop_platform ;;
                restart) stop_platform && start_platform "$with_obs" ;;
                status) status_platform "$with_obs" ;;
                logs) show_logs platform "$@" ;;
                clean) clean_platform ;;
                *) echo -e "${RED}Unknown command: $command${NC}"; print_usage; exit 1 ;;
            esac
            ;;
        isp)
            case "$command" in
                start) start_isp "$with_obs" ;;
                stop) stop_isp ;;
                restart) stop_isp && start_isp "$with_obs" ;;
                status) status_isp ;;
                logs) show_logs isp "$@" ;;
                clean) clean_isp ;;
                *) echo -e "${RED}Unknown command: $command${NC}"; print_usage; exit 1 ;;
            esac
            ;;
        all)
            case "$command" in
                start) start_all "$with_obs" ;;
                stop) stop_all ;;
                restart) stop_all && start_all "$with_obs" ;;
                status) status_all ;;
                logs) show_logs all "$@" ;;
                clean) clean_all ;;
                *) echo -e "${RED}Unknown command: $command${NC}"; print_usage; exit 1 ;;
            esac
            ;;
        *)
            echo -e "${RED}Unknown mode: $mode${NC}"
            echo ""
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
