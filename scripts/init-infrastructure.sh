#!/bin/bash
# ISP Operations Platform - Infrastructure Initialization Script
# This script sets up the complete infrastructure for the ISP platform

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if .env file exists
check_env_file() {
    print_header "Checking Environment Configuration"

    if [ ! -f .env ]; then
        print_warning ".env file not found"
        print_info "Copying .env.example to .env..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration!"
        print_warning "Press Enter to continue after editing .env, or Ctrl+C to exit"
        read
    else
        print_success ".env file exists"
    fi
}

# Check required tools
check_requirements() {
    print_header "Checking Requirements"

    local missing_tools=()

    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    else
        print_success "Docker installed: $(docker --version)"
    fi

    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        missing_tools+=("docker compose")
    else
        print_success "Docker Compose installed"
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install missing tools and try again"
        exit 1
    fi
}

# Create Docker network
create_network() {
    print_header "Creating Docker Network"

    NETWORK_NAME=${DOCKER_NETWORK_NAME:-dotmac-network}

    if docker network ls | grep -q "$NETWORK_NAME"; then
        print_warning "Network $NETWORK_NAME already exists"
    else
        docker network create "$NETWORK_NAME"
        print_success "Network $NETWORK_NAME created"
    fi
}

# Create required directories
create_directories() {
    print_header "Creating Required Directories"

    local dirs=(
        "data/postgres"
        "data/redis"
        "data/mongodb"
        "data/timescaledb"
        "data/minio"
        "data/openbao"
        "data/prometheus"
        "data/grafana"
        "data/loki"
        "data/alertmanager"
        "logs/radius"
        "logs/genieacs"
        "logs/celery"
        "logs/fastapi"
        "config/radius"
        "config/prometheus"
        "config/grafana/datasources"
        "config/grafana/dashboards"
        "config/alertmanager"
        "config/loki"
        "config/promtail"
    )

    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_success "Created directory: $dir"
        fi
    done
}

# Start core services
start_core_services() {
    print_header "Starting Core Services"

    print_info "Starting PostgreSQL, Redis, MinIO, OpenBao..."
    docker compose up -d postgres redis minio openbao

    print_info "Waiting for services to be healthy (30 seconds)..."
    sleep 30

    print_success "Core services started"
}

# Initialize databases
init_databases() {
    print_header "Initializing Databases"

    print_info "Creating additional databases..."

    # Create NetBox database
    docker compose exec -T postgres psql -U ${POSTGRES_USER:-dotmac_user} -d ${POSTGRES_DB:-dotmac} -c "CREATE DATABASE netbox;" 2>/dev/null || print_warning "NetBox database may already exist"

    # Create LibreNMS database
    docker compose exec -T postgres psql -U ${POSTGRES_USER:-dotmac_user} -d ${POSTGRES_DB:-dotmac} -c "CREATE DATABASE librenms;" 2>/dev/null || print_warning "LibreNMS database may already exist"

    # Create AWX database
    docker compose exec -T postgres psql -U ${POSTGRES_USER:-dotmac_user} -d ${POSTGRES_DB:-dotmac} -c "CREATE DATABASE awx;" 2>/dev/null || print_warning "AWX database may already exist"

    print_success "Databases initialized"
}

# Start ISP services
start_isp_services() {
    print_header "Starting ISP Services"

    print_info "Starting FreeRADIUS, NetBox, GenieACS, WireGuard, LibreNMS, AWX..."
    docker compose -f docker-compose.isp.yml up -d

    print_info "Waiting for ISP services to start (60 seconds)..."
    sleep 60

    print_success "ISP services started"
}

# Start monitoring services
start_monitoring_services() {
    print_header "Starting Monitoring Services"

    print_info "Starting Prometheus, Grafana, Jaeger, Alertmanager, Loki..."
    docker compose -f docker-compose.monitoring.yml up -d

    print_info "Waiting for monitoring services to start (30 seconds)..."
    sleep 30

    print_success "Monitoring services started"
}

# Show service status
show_status() {
    print_header "Service Status"

    echo ""
    print_info "Core Services:"
    docker compose ps

    echo ""
    print_info "ISP Services:"
    docker compose -f docker-compose.isp.yml ps

    echo ""
    print_info "Monitoring Services:"
    docker compose -f docker-compose.monitoring.yml ps
}

# Show service URLs
show_urls() {
    print_header "Service URLs"

    echo ""
    print_info "Core Services:"
    echo "  PostgreSQL:        localhost:5432"
    echo "  Redis:             localhost:6379"
    echo "  MinIO Console:     http://localhost:9001"
    echo "  OpenBao:           http://localhost:8200"

    echo ""
    print_info "ISP Services:"
    echo "  FreeRADIUS:        localhost:1812 (UDP - Auth)"
    echo "  FreeRADIUS:        localhost:1813 (UDP - Accounting)"
    echo "  NetBox:            http://localhost:8080"
    echo "  GenieACS UI:       http://localhost:7567"
    echo "  GenieACS API:      http://localhost:7557"
    echo "  WireGuard:         localhost:51820 (UDP)"
    echo "  LibreNMS:          http://localhost:8000"
    echo "  Ansible AWX:       http://localhost:8052"

    echo ""
    print_info "Monitoring Services:"
    echo "  Prometheus:        http://localhost:9090"
    echo "  Grafana:           http://localhost:3000"
    echo "  Jaeger UI:         http://localhost:16686"
    echo "  Alertmanager:      http://localhost:9093"
    echo "  Loki:              http://localhost:3100"

    echo ""
    print_info "Backend API:"
    echo "  API Docs:          http://localhost:8000/docs"
    echo "  API ReDoc:         http://localhost:8000/redoc"
}

# Show next steps
show_next_steps() {
    print_header "Next Steps"

    echo ""
    print_info "1. Backend Setup:"
    echo "   cd backend"
    echo "   poetry install --with dev"
    echo "   poetry run alembic upgrade head"
    echo "   poetry run uvicorn dotmac.platform.api.main:app --reload"

    echo ""
    print_info "2. Frontend Setup:"
    echo "   cd frontend"
    echo "   pnpm install"
    echo "   pnpm --filter @dotmac/base-app dev"

    echo ""
    print_info "3. Default Credentials:"
    echo "   Grafana:      admin / admin"
    echo "   NetBox:       admin / admin"
    echo "   AWX:          admin / changeme_awx_admin"
    echo "   LibreNMS:     admin / admin"

    echo ""
    print_warning "4. Security Reminders:"
    echo "   - Change all default passwords"
    echo "   - Update RADIUS shared secrets"
    echo "   - Configure SMTP for email notifications"
    echo "   - Review .env file for production settings"

    echo ""
    print_success "Infrastructure setup complete!"
}

# Main execution
main() {
    print_header "ISP Operations Platform - Infrastructure Setup"

    # Change to script directory
    cd "$(dirname "$0")/.."

    check_requirements
    check_env_file
    create_network
    create_directories
    start_core_services
    init_databases
    start_isp_services
    start_monitoring_services
    show_status
    show_urls
    show_next_steps
}

# Run main function
main
