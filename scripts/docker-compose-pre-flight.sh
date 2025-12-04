#!/bin/bash
# scripts/docker-compose-pre-flight.sh
# Pre-flight checks for Docker Compose deployment
# Validates configuration for portability and best practices

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
INFO_COUNT=0

# Print functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
    ERRORS=$((ERRORS + 1))
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

print_info() {
    echo -e "${GREEN}ℹ️  INFO:${NC} $1"
    INFO_COUNT=$((INFO_COUNT + 1))
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check functions
check_hardcoded_platform() {
    print_header "1. Checking for Hardcoded Platform Architecture"

    if grep -r "platform: linux/amd64" docker-compose*.yml 2>/dev/null; then
        print_warning "Hardcoded platform architecture found"
        echo "   File(s):"
        grep -rn "platform: linux/amd64" docker-compose*.yml | sed 's/^/   /'
        echo ""
        echo "   Fix: Remove platform constraint or use \${PLATFORM_ARCH:-linux/amd64}"
        echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.1"
        echo ""
    else
        print_success "No hardcoded platform architecture"
    fi
    echo ""
}

check_relative_paths() {
    print_header "2. Checking for Relative Path Mounts"

    local found_paths=false
    local allowed_regex="^\\s+- \\./config/prometheus/(prometheus\\.yml|alerts\\.yml):"

    for file in docker-compose*.yml; do
        if [ -f "$file" ]; then
            local matches filtered allowed
            matches=$(grep -nE "^\s+- \./config" "$file" 2>/dev/null || true)
            if [ -n "$matches" ]; then
                filtered=$(echo "$matches" | grep -Ev "config/prometheus/(prometheus\.yml|alerts\.yml):" || true)
                allowed=$(echo "$matches" | grep -E "config/prometheus/(prometheus\.yml|alerts\.yml):" || true)

                if [ -n "$filtered" ]; then
                    if [ "$found_paths" = false ]; then
                        print_warning "Relative path mounts found"
                        found_paths=true
                    fi
                    echo "   In $file:"
                    echo "$filtered" | sed 's/^/   /'
                elif [ -n "$allowed" ]; then
                    print_info "Prometheus config mounts found in $file (allowed for infra stack)"
                fi
            fi
        fi
    done

    if [ "$found_paths" = true ]; then
        echo ""
        echo "   Fix: Run ./scripts/setup-config-files.sh to create missing files"
        echo "   Or build configs into Docker images (recommended for production)"
        echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.2"
        echo ""
    else
        print_success "No problematic relative path mounts"
    fi
    echo ""
}

check_host_mounts() {
    print_header "3. Checking for Host System Path Mounts"

    local found_mounts=false
    local dangerous_mounts=(
        "- /:"
        "- /proc:"
        "- /sys:"
        "- /lib/modules:"
        "- /var/run/docker.sock:"
    )

    for file in docker-compose*.yml; do
        if [ -f "$file" ]; then
            for mount in "${dangerous_mounts[@]}"; do
                if grep -q "$mount" "$file" 2>/dev/null; then
                    if [ "$found_mounts" = false ]; then
                        print_warning "Host system path mounts found (security/portability concern)"
                        found_mounts=true
                    fi
                    echo "   In $file:"
                    grep -n "$mount" "$file" | sed 's/^/   /'
                fi
            done
        fi
    done

    if [ "$found_mounts" = true ]; then
        echo ""
        echo "   Fix: Deploy node-exporter/cadvisor on host instead of Docker Compose"
        echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.3"
        echo ""
    else
        print_success "No host system path mounts"
    fi
    echo ""
}

check_custom_images() {
    print_header "4. Checking for Custom Images Not in Registry"

    # Allowlist of official images we rely on (avoid network lookup in restricted CI)
    local official_images=(
        "mongo:7"
        "postgres:15-alpine"
        "redis:7-alpine"
    )

    # Extract image names from docker-compose files
    local images=$(grep -h "image:" docker-compose*.yml 2>/dev/null | awk '{print $2}' | sort -u || true)

    local found_custom=false

    for img in $images; do
        # Skip known official images to avoid registry lookups in offline CI
        if printf '%s\n' "${official_images[@]}" | grep -qx "$img"; then
            continue
        fi
        # Skip if image has a registry (contains / or .)
        if [[ ! "$img" =~ [/.] ]] || [[ "$img" =~ ^[a-z-]+:[a-z0-9.-]+$ ]]; then
            # Check if image exists in local or remote registry
            if ! docker manifest inspect "$img" > /dev/null 2>&1 && ! docker image inspect "$img" > /dev/null 2>&1; then
                if [ "$found_custom" = false ]; then
                    print_error "Custom images not found in registry or locally"
                    found_custom=true
                fi
                echo "   Missing: $img"
            fi
        fi
    done

    if [ "$found_custom" = true ]; then
        echo ""
        echo "   Fix: Build and push images to a registry"
        echo "   Run: ./scripts/build-and-push-freeradius.sh"
        echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.4"
        echo ""
    else
        print_success "All images available or have registry path"
    fi
    echo ""
}

check_database_config() {
    print_header "5. Checking Database Configuration"

    if [ -f "database/init/01-init.sql" ]; then
        if grep -q "ALTER SYSTEM SET shared_buffers" "database/init/01-init.sql"; then
            print_warning "Hardcoded database configuration found"
            echo "   File: database/init/01-init.sql"
            echo ""
            echo "   Fix: Generate environment-specific config"
            echo "   Run: ./scripts/generate-db-config.sh"
            echo "   Or:  ./scripts/pgtune.sh 4096 web ssd"
            echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.5"
            echo ""
        else
            print_success "Database configuration appears flexible"
        fi
    else
        print_info "No database init SQL found (may be configured elsewhere)"
    fi
    echo ""
}

check_env_file() {
    print_header "6. Checking Environment Configuration"

    if [ -f ".env" ]; then
        print_success ".env file exists"

        # Check for critical variables
        local required_vars=(
            "RADIUS_SECRET"
            "POSTGRES_PASSWORD"
            "REDIS_PASSWORD"
            "SECRET_KEY"
        )

        local missing_vars=()

        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" .env; then
                missing_vars+=("$var")
            fi
        done

        if [ ${#missing_vars[@]} -gt 0 ]; then
            print_warning "Missing environment variables:"
            for var in "${missing_vars[@]}"; do
                echo "   - $var"
            done
            echo ""
        fi

        # Check for default/insecure values
        if grep -q "changeme" .env 2>/dev/null; then
            print_warning "Default 'changeme' values detected in .env"
            echo "   Update with secure passwords before deployment!"
            echo ""
        fi
    else
        if [ -f ".env.example" ]; then
            print_info ".env not found (using .env.example as template)"
        else
            print_warning ".env file not found"
            echo "   Create with: ./scripts/setup-config-files.sh"
            echo ""
        fi
    fi
    echo ""
}

check_storage_paths() {
    print_header "7. Checking Storage Path Configuration"

    if grep -r "/tmp/storage" src/ 2>/dev/null | grep -v ".pyc" | grep -q .; then
        print_warning "Ephemeral /tmp storage path found in code"
        echo "   Files:"
        grep -rn "/tmp/storage" src/ | grep -v ".pyc" | head -5 | sed 's/^/   /'
        echo ""
        echo "   Fix: Use persistent volumes instead"
        echo "   See: DOCKER_COMPOSE_PORTABILITY_FIXES.md Phase 7.6"
        echo ""
    else
        print_success "No ephemeral storage paths detected"
    fi
    echo ""
}

check_required_files() {
    print_header "8. Checking Required Configuration Files"

    local required_files=(
        "config/radius/clients.conf"
        "config/radius/dictionary"
        "monitoring/prometheus/prometheus.yml"
    )

    local missing_files=()

    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file")
        fi
    done

    if [ ${#missing_files[@]} -gt 0 ]; then
        print_warning "Missing configuration files:"
        for file in "${missing_files[@]}"; do
            echo "   - $file"
        done
        echo ""
        echo "   Create with: ./scripts/setup-config-files.sh"
        echo ""
    else
        print_success "All required configuration files present"
    fi
    echo ""
}

# Summary
print_summary() {
    print_header "Pre-Flight Check Summary"

    echo "Results:"
    echo "  ❌ Errors:   $ERRORS"
    echo "  ⚠️  Warnings: $WARNINGS"
    echo "  ℹ️  Info:     $INFO_COUNT"
    echo ""

    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}❌ Pre-flight check FAILED${NC}"
        echo "   Fix critical errors before deployment"
        echo ""
        return 1
    elif [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Pre-flight check PASSED with warnings${NC}"
        echo "   Review warnings and fix if needed for production"
        echo ""
        return 0
    else
        echo -e "${GREEN}✅ Pre-flight check PASSED${NC}"
        echo "   Configuration looks good!"
        echo ""
        return 0
    fi
}

# Main execution
main() {
    clear
    print_header "🚀 Docker Compose Pre-Flight Check"
    echo "Checking deployment configuration for portability issues..."
    echo ""

    check_hardcoded_platform
    check_relative_paths
    check_host_mounts
    check_custom_images
    check_database_config
    check_env_file
    check_storage_paths
    check_required_files

    print_summary
}

# Run main function
main
exit_code=$?

# Additional help if there are issues
if [ $exit_code -ne 0 ] || [ $WARNINGS -gt 0 ]; then
    echo "📚 Additional Resources:"
    echo "   Documentation: DOCKER_COMPOSE_PORTABILITY_FIXES.md"
    echo "   Setup script:  ./scripts/setup-config-files.sh"
    echo "   Validation:    ./scripts/validate-docker-compose-env.sh"
    echo ""
fi

exit $exit_code
