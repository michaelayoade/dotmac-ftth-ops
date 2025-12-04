#!/usr/bin/env bash
#
# Infrastructure Management Script
#
# Manages Docker infrastructure for the DotMac Platform.
# Supports: up, down, status, restart, logs commands
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

# Required services for development
REQUIRED_SERVICES=(
    "postgres"
    "redis"
)

# Optional services (for full stack)
OPTIONAL_SERVICES=(
    "minio"
    "mailhog"
    "openbao"
)

# Function to print header
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  DotMac Platform - Infrastructure${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        echo -e "${YELLOW}→${NC} Please start Docker Desktop or Docker daemon"
        exit 1
    fi
}

# Function to check if docker-compose.yml exists
check_compose_file() {
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}✗ docker-compose.yml not found${NC}"
        echo -e "${YELLOW}→${NC} Run this script from the project root directory"
        exit 1
    fi
}

# Function to get service status
get_service_status() {
    local service=$1
    local status=""

    if docker compose ps --services --filter "status=running" | grep -q "^${service}$"; then
        status="running"
    elif docker compose ps --services --filter "status=exited" | grep -q "^${service}$"; then
        status="exited"
    elif docker compose ps --services --filter "status=paused" | grep -q "^${service}$"; then
        status="paused"
    else
        status="not_created"
    fi

    echo "$status"
}

# Function to print service status with icon
print_service_status() {
    local service=$1
    local status=$2
    local is_required=$3

    local status_icon=""
    local status_color=""
    local status_text=""

    case "$status" in
        running)
            status_icon="✓"
            status_color="${GREEN}"
            status_text="Running"
            ;;
        exited)
            status_icon="✗"
            status_color="${RED}"
            status_text="Exited"
            ;;
        paused)
            status_icon="⏸"
            status_color="${YELLOW}"
            status_text="Paused"
            ;;
        not_created)
            status_icon="○"
            status_color="${YELLOW}"
            status_text="Not Created"
            ;;
    esac

    local required_text=""
    if [ "$is_required" = "true" ]; then
        required_text="${CYAN}(required)${NC}"
    else
        required_text="${YELLOW}(optional)${NC}"
    fi

    printf "  ${status_color}${status_icon}${NC} %-20s ${status_color}%-15s${NC} %s\n" \
        "${service}" "${status_text}" "${required_text}"
}

# Function to check service health
check_service_health() {
    local service=$1
    local status=$(get_service_status "$service")

    if [ "$status" != "running" ]; then
        return 1
    fi

    case "$service" in
        postgres)
            if docker compose exec -T postgres pg_isready -U dotmac_user >/dev/null 2>&1; then
                return 0
            fi
            ;;
        redis)
            if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
                return 0
            fi
            ;;
        minio)
            if docker compose exec -T minio mc alias list >/dev/null 2>&1; then
                return 0
            fi
            ;;
        *)
            # For other services, just check if container is running
            return 0
            ;;
    esac

    return 1
}

# Command: up
cmd_up() {
    print_header

    check_docker
    check_compose_file

    echo -e "${YELLOW}→${NC} Starting infrastructure services..."
    echo ""

    # Start required services first
    for service in "${REQUIRED_SERVICES[@]}"; do
        echo -e "${CYAN}Starting ${service}...${NC}"
    done

    if docker compose up -d "${REQUIRED_SERVICES[@]}" 2>&1; then
        echo ""
        echo -e "${GREEN}✓ Required services started${NC}"
    else
        echo ""
        echo -e "${RED}✗ Failed to start required services${NC}"
        exit 1
    fi

    # Wait for services to be healthy
    echo ""
    echo -e "${YELLOW}→${NC} Waiting for services to be healthy..."

    for service in "${REQUIRED_SERVICES[@]}"; do
        echo -n "  Checking ${service}..."
        for i in {1..30}; do
            if check_service_health "$service"; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
            if [ "$i" -eq 30 ]; then
                echo -e " ${YELLOW}⚠ (timeout)${NC}"
            fi
            sleep 1
            echo -n "."
        done
    done

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ Infrastructure is ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}Connection details:${NC}"
    echo -e "  PostgreSQL: localhost:5432 (user: dotmac_user, db: dotmac)"
    echo -e "  Redis:      localhost:6379"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Run migrations:  make migrate"
    echo -e "  2. Seed database:   make seed-db"
    echo -e "  3. Start backend:   make dev-backend"
    echo -e "  4. Start frontend:  make dev-frontend"
    echo ""
}

# Command: down
cmd_down() {
    print_header

    check_docker
    check_compose_file

    echo -e "${YELLOW}→${NC} Stopping infrastructure services..."
    echo ""

    if docker compose down; then
        echo ""
        echo -e "${GREEN}✓ Infrastructure stopped${NC}"
    else
        echo ""
        echo -e "${RED}✗ Failed to stop infrastructure${NC}"
        exit 1
    fi
}

# Command: status
cmd_status() {
    print_header

    check_docker
    check_compose_file

    echo -e "${CYAN}Infrastructure Status:${NC}"
    echo ""

    # Check required services
    echo -e "${CYAN}Required Services:${NC}"
    local all_required_running=true
    for service in "${REQUIRED_SERVICES[@]}"; do
        local status=$(get_service_status "$service")
        print_service_status "$service" "$status" "true"
        if [ "$status" != "running" ]; then
            all_required_running=false
        fi
    done

    echo ""
    echo -e "${CYAN}Optional Services:${NC}"
    for service in "${OPTIONAL_SERVICES[@]}"; do
        local status=$(get_service_status "$service")
        print_service_status "$service" "$status" "false"
    done

    echo ""
    echo -e "${BLUE}========================================${NC}"

    if [ "$all_required_running" = true ]; then
        echo -e "${GREEN}✓ All required services are running${NC}"
        echo ""
        echo -e "${CYAN}Connection details:${NC}"
        echo -e "  PostgreSQL: localhost:5432"
        echo -e "  Redis:      localhost:6379"

        # Show optional services if running
        for service in "${OPTIONAL_SERVICES[@]}"; do
            local status=$(get_service_status "$service")
            if [ "$status" = "running" ]; then
                case "$service" in
                    minio)
                        echo -e "  MinIO:      http://localhost:9000 (Console: http://localhost:9001)"
                        ;;
                    mailhog)
                        echo -e "  MailHog:    http://localhost:8025"
                        ;;
                    openbao)
                        echo -e "  OpenBao:    http://localhost:8200"
                        ;;
                esac
            fi
        done
    else
        echo -e "${YELLOW}⚠ Some required services are not running${NC}"
        echo ""
        echo -e "${YELLOW}Run: make infra-up${NC}"
    fi

    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Command: restart
cmd_restart() {
    print_header

    echo -e "${YELLOW}→${NC} Restarting infrastructure..."
    echo ""

    cmd_down
    echo ""
    cmd_up
}

# Command: logs
cmd_logs() {
    check_docker
    check_compose_file

    local service="${1:-}"

    if [ -z "$service" ]; then
        echo -e "${CYAN}Following logs for all services (Ctrl+C to exit)...${NC}"
        echo ""
        docker compose logs -f
    else
        echo -e "${CYAN}Following logs for ${service} (Ctrl+C to exit)...${NC}"
        echo ""
        docker compose logs -f "$service"
    fi
}

# Command: ps
cmd_ps() {
    check_docker
    check_compose_file

    print_header
    echo -e "${CYAN}Container Status:${NC}"
    echo ""
    docker compose ps
    echo ""
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  up          Start infrastructure services
  down        Stop all infrastructure services
  status      Show status of all services
  restart     Restart infrastructure
  logs [svc]  Show logs (optionally for specific service)
  ps          Show container status (docker compose ps)
  help        Show this help message

Examples:
  $0 up                 # Start required services (postgres, redis)
  $0 down               # Stop all services
  $0 status             # Check service status
  $0 restart            # Restart infrastructure
  $0 logs               # Follow all logs
  $0 logs postgres      # Follow postgres logs only
  $0 ps                 # Show container status

Environment Variables:
  COMPOSE_FILE          Override compose file (default: docker-compose.yml)

EOF
}

# Main execution
main() {
    local command="${1:-}"

    case "$command" in
        up)
            cmd_up
            ;;
        down)
            cmd_down
            ;;
        status)
            cmd_status
            ;;
        restart)
            cmd_restart
            ;;
        logs)
            shift
            cmd_logs "$@"
            ;;
        ps)
            cmd_ps
            ;;
        help|--help|-h|"")
            show_help
            ;;
        *)
            echo -e "${RED}✗ Unknown command: $command${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
