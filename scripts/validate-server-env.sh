#!/usr/bin/env bash
#
# Environment Validation Script for Server Deployment
# ----------------------------------------------------
# Validates .env file configuration before deployment
# Checks for common misconfigurations that cause startup failures
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Environment Validation - Server Deployment${NC}       ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

error() {
    echo -e "${RED}✗ ERROR:${NC} $1"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠ WARNING:${NC} $1"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

info() {
    echo -e "${CYAN}→${NC} $1"
}

# Check if .env file exists
check_env_file() {
    echo -e "${CYAN}Checking .env file...${NC}"
    if [[ ! -f .env ]]; then
        error ".env file not found"
        info "Create it from .env.server: cp .env.server .env"
        return 1
    fi
    success ".env file exists"
    echo ""
}

# Check for required variables
check_required_vars() {
    echo -e "${CYAN}Checking required variables...${NC}"

    local required_vars=(
        "DATABASE__HOST"
        "DATABASE__PORT"
        "DATABASE__DATABASE"
        "DATABASE__USERNAME"
        "DATABASE__PASSWORD"
        "REDIS__HOST"
        "REDIS__PORT"
        "STORAGE__ENDPOINT"
        "STORAGE__ACCESS_KEY"
        "STORAGE__SECRET_KEY"
        "SECRET_KEY"
        "AUTH__JWT_SECRET_KEY"
    )

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            error "Missing variable: ${var}"
        else
            success "Found: ${var}"
        fi
    done
    echo ""
}

# Check for localhost usage (common mistake)
check_localhost_usage() {
    echo -e "${CYAN}Checking for localhost usage (common mistake)...${NC}"

    if grep -q "DATABASE__HOST=localhost" .env 2>/dev/null; then
        error "DATABASE__HOST uses 'localhost' instead of container name"
        info "Should be: DATABASE__HOST=dotmac-postgres"
    else
        success "DATABASE__HOST uses container name"
    fi

    if grep -q "REDIS__HOST=localhost" .env 2>/dev/null; then
        error "REDIS__HOST uses 'localhost' instead of container name"
        info "Should be: REDIS__HOST=dotmac-redis"
    else
        success "REDIS__HOST uses container name"
    fi

    if grep -q "localhost:9000" .env 2>/dev/null; then
        warning "STORAGE__ENDPOINT might use 'localhost' instead of container name"
        info "Should be: STORAGE__ENDPOINT=http://dotmac-minio:9000"
    else
        success "STORAGE__ENDPOINT uses container name"
    fi

    if grep -q "OTEL.*localhost" .env 2>/dev/null; then
        warning "OTEL endpoint uses 'localhost' instead of container name"
        info "Should be: OTEL_EXPORTER_OTLP_ENDPOINT=http://dotmac-jaeger:4317"
    else
        success "OTEL endpoint uses container name (or not set)"
    fi

    echo ""
}

# Check password matching with infrastructure
check_password_matching() {
    echo -e "${CYAN}Checking password consistency with infrastructure...${NC}"

    if [[ ! -f docker-compose.infra.yml ]]; then
        warning "docker-compose.infra.yml not found, skipping password validation"
        echo ""
        return
    fi

    # Extract PostgreSQL password from infrastructure
    local infra_pg_pass=$(grep -A 5 "postgres:" docker-compose.infra.yml | grep "POSTGRES_PASSWORD:" | sed 's/.*POSTGRES_PASSWORD: *//' | tr -d ' ')
    local env_pg_pass=$(grep "^DATABASE__PASSWORD=" .env | cut -d'=' -f2)

    if [[ -n "$infra_pg_pass" ]] && [[ -n "$env_pg_pass" ]]; then
        if [[ "$infra_pg_pass" == "$env_pg_pass" ]]; then
            success "PostgreSQL password matches infrastructure"
        else
            error "PostgreSQL password mismatch!"
            info "Infrastructure: $infra_pg_pass"
            info ".env file: $env_pg_pass"
        fi
    else
        warning "Could not verify PostgreSQL password"
    fi

    # Extract MinIO password from infrastructure
    local infra_minio_pass=$(grep -A 10 "minio:" docker-compose.infra.yml | grep "MINIO_ROOT_PASSWORD:" | sed 's/.*MINIO_ROOT_PASSWORD: *//' | tr -d ' ')
    local env_minio_pass=$(grep "^STORAGE__SECRET_KEY=" .env | cut -d'=' -f2)

    if [[ -n "$infra_minio_pass" ]] && [[ -n "$env_minio_pass" ]]; then
        if [[ "$infra_minio_pass" == "$env_minio_pass" ]]; then
            success "MinIO password matches infrastructure"
        else
            error "MinIO password mismatch!"
            info "Infrastructure: $infra_minio_pass"
            info ".env file: $env_minio_pass"
        fi
    else
        warning "Could not verify MinIO password"
    fi

    echo ""
}

# Check secret key strength
check_secret_strength() {
    echo -e "${CYAN}Checking secret key strength...${NC}"

    local secret_key=$(grep "^SECRET_KEY=" .env | cut -d'=' -f2)
    local jwt_secret=$(grep "^AUTH__JWT_SECRET_KEY=" .env | cut -d'=' -f2)

    if [[ "$secret_key" == "dev-secret-change-me"* ]]; then
        warning "SECRET_KEY still uses default value"
        info "Generate secure key: openssl rand -hex 32"
    else
        success "SECRET_KEY appears to be custom"
    fi

    if [[ "$jwt_secret" == "dev-jwt-secret-change-me"* ]]; then
        warning "AUTH__JWT_SECRET_KEY still uses default value"
        info "Generate secure key: openssl rand -hex 32"
    else
        success "AUTH__JWT_SECRET_KEY appears to be custom"
    fi

    echo ""
}

# Check ISP backend configuration
check_isp_backend_config() {
    echo -e "${CYAN}Checking ISP backend configuration...${NC}"

    # Check if ISP-specific vars exist
    if grep -q "^ISP_DATABASE__HOST=" .env; then
        success "ISP backend database config found"

        # Verify it also uses container names
        if grep -q "^ISP_DATABASE__HOST=dotmac-postgres" .env; then
            success "ISP backend uses correct database host"
        else
            error "ISP backend database host should be: dotmac-postgres"
        fi
    else
        warning "ISP backend specific config not found (may inherit from platform)"
    fi

    echo ""
}

# Check port conflicts
check_port_config() {
    echo -e "${CYAN}Checking port configuration...${NC}"

    local platform_backend_port=$(grep "^PLATFORM_BACKEND_PORT=" .env | cut -d'=' -f2)
    local isp_backend_port=$(grep "^ISP_BACKEND_PORT=" .env | cut -d'=' -f2)
    local platform_frontend_port=$(grep "^PLATFORM_FRONTEND_PORT=" .env | cut -d'=' -f2)
    local isp_frontend_port=$(grep "^ISP_FRONTEND_PORT=" .env | cut -d'=' -f2)

    if [[ "$platform_backend_port" == "$isp_backend_port" ]]; then
        error "Port conflict: Platform and ISP backend use same port: $platform_backend_port"
    else
        success "Backend ports are different (Platform: ${platform_backend_port:-8001}, ISP: ${isp_backend_port:-8000})"
    fi

    if [[ "$platform_frontend_port" == "$isp_frontend_port" ]]; then
        error "Port conflict: Platform and ISP frontend use same port: $platform_frontend_port"
    else
        success "Frontend ports are different (Platform: ${platform_frontend_port:-3002}, ISP: ${isp_frontend_port:-3001})"
    fi

    echo ""
}

# Check Docker Compose files
check_compose_files() {
    echo -e "${CYAN}Checking Docker Compose files...${NC}"

    if [[ ! -f docker-compose.infra.yml ]]; then
        error "docker-compose.infra.yml not found"
    else
        success "docker-compose.infra.yml exists"
    fi

    if [[ ! -f docker-compose.base.yml ]]; then
        error "docker-compose.base.yml not found"
    else
        success "docker-compose.base.yml exists"
    fi

    if [[ ! -f docker-compose.isp.yml ]]; then
        error "docker-compose.isp.yml not found"
    else
        success "docker-compose.isp.yml exists"
    fi

    echo ""
}

# Print summary
print_summary() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}Validation Summary${NC}                               ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ All checks passed!${NC}"
        echo -e "${GREEN}Your environment is ready for deployment.${NC}"
        echo ""
        echo -e "${CYAN}Next steps:${NC}"
        echo "  1. make start-all"
        echo "  2. Wait for services to become healthy"
        echo "  3. Access the platform at http://localhost:3002 and http://localhost:3001"
        return 0
    elif [[ $ERRORS -eq 0 ]]; then
        echo -e "${YELLOW}⚠ Validation completed with $WARNINGS warning(s)${NC}"
        echo -e "${YELLOW}Review warnings above before deploying.${NC}"
        echo ""
        echo -e "${CYAN}You can proceed with deployment:${NC}"
        echo "  make start-all"
        return 0
    else
        echo -e "${RED}✗ Validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
        echo -e "${RED}Fix errors above before deploying.${NC}"
        echo ""
        echo -e "${CYAN}Common fixes:${NC}"
        echo "  1. Copy server config: cp .env.server .env"
        echo "  2. Review and update passwords"
        echo "  3. Run this script again: ./scripts/validate-server-env.sh"
        return 1
    fi
}

# Main
main() {
    print_header

    check_env_file || exit 1
    check_compose_files
    check_required_vars
    check_localhost_usage
    check_password_matching
    check_secret_strength
    check_isp_backend_config
    check_port_config

    print_summary
}

main
