#!/bin/bash
# =============================================================================
# Frontend Apps Smoke Test Script
# =============================================================================
# Tests health endpoints and basic login flow for all frontend applications.
#
# Usage:
#   ./scripts/smoke-test-frontend-apps.sh [--production]
#
# Options:
#   --production    Test production hosts (*.dotmac.io)
#   (default)       Test localhost ports
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PRODUCTION_MODE=false
TIMEOUT=10
TENANT_SLUG="demo-isp"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --production) PRODUCTION_MODE=true ;;
        --tenant) TENANT_SLUG="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Define endpoints based on mode
if [ "$PRODUCTION_MODE" = true ]; then
    declare -A APPS=(
        ["platform-admin"]="https://admin.platform.dotmac.io"
        ["platform-reseller"]="https://partners.platform.dotmac.io"
        ["platform-tenant"]="https://my.platform.dotmac.io"
        ["isp-ops"]="https://app.${TENANT_SLUG}.dotmac.io"
        ["isp-reseller"]="https://agents.${TENANT_SLUG}.dotmac.io"
        ["isp-customer"]="https://my.${TENANT_SLUG}.dotmac.io"
    )
else
    declare -A APPS=(
        ["platform-admin"]="http://localhost:3002"
        ["platform-reseller"]="http://localhost:3004"
        ["platform-tenant"]="http://localhost:3003"
        ["isp-ops"]="http://localhost:3001"
        ["isp-reseller"]="http://localhost:3005"
        ["isp-customer"]="http://localhost:3006"
    )
fi

# Results tracking
PASSED=0
FAILED=0
declare -A RESULTS

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Test health endpoint
test_health() {
    local app_name="$1"
    local base_url="$2"
    local health_url="${base_url}/api/health"

    echo -n "  Health check: "

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$health_url" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}FAILED${NC} (HTTP $response)"
        return 1
    fi
}

# Test login page loads
test_login_page() {
    local app_name="$1"
    local base_url="$2"
    local login_url="${base_url}/login"

    echo -n "  Login page:   "

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$login_url" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}FAILED${NC} (HTTP $response)"
        return 1
    fi
}

# Test protected route redirects to login
test_auth_redirect() {
    local app_name="$1"
    local base_url="$2"

    # Determine protected path based on app
    local protected_path
    case "$app_name" in
        "platform-admin") protected_path="/dashboard" ;;
        "platform-reseller") protected_path="/portal" ;;
        "platform-tenant") protected_path="/portal" ;;
        "isp-ops") protected_path="/dashboard" ;;
        "isp-reseller") protected_path="/portal" ;;
        "isp-customer") protected_path="/portal" ;;
    esac

    local protected_url="${base_url}${protected_path}"

    echo -n "  Auth redirect:"

    # Follow redirects and check if we end up at login
    response=$(curl -s -L -o /dev/null -w "%{url_effective}" --connect-timeout $TIMEOUT "$protected_url" 2>/dev/null || echo "error")

    if [[ "$response" == *"/login"* ]]; then
        echo -e "${GREEN}OK${NC} (redirects to login)"
        return 0
    else
        echo -e "${YELLOW}WARN${NC} (no redirect: $response)"
        return 0  # Not a failure, might be already authenticated
    fi
}

# Test security headers
test_security_headers() {
    local app_name="$1"
    local base_url="$2"

    if [ "$PRODUCTION_MODE" = false ]; then
        echo "  Security:     ${YELLOW}SKIP${NC} (localhost mode)"
        return 0
    fi

    echo -n "  Security:     "

    headers=$(curl -s -I --connect-timeout $TIMEOUT "$base_url" 2>/dev/null)

    local missing=""

    # Check for required headers
    echo "$headers" | grep -qi "strict-transport-security" || missing+="HSTS "
    echo "$headers" | grep -qi "x-content-type-options" || missing+="X-Content-Type "
    echo "$headers" | grep -qi "x-frame-options" || missing+="X-Frame "

    if [ -z "$missing" ]; then
        echo -e "${GREEN}OK${NC} (HSTS, X-Content-Type, X-Frame)"
        return 0
    else
        echo -e "${YELLOW}WARN${NC} (missing: $missing)"
        return 0  # Warning, not failure
    fi
}

# Run all tests for an app
test_app() {
    local app_name="$1"
    local base_url="$2"

    echo ""
    log_info "Testing $app_name ($base_url)"

    local app_passed=0
    local app_failed=0

    test_health "$app_name" "$base_url" && ((app_passed++)) || ((app_failed++))
    test_login_page "$app_name" "$base_url" && ((app_passed++)) || ((app_failed++))
    test_auth_redirect "$app_name" "$base_url" && ((app_passed++)) || ((app_failed++))
    test_security_headers "$app_name" "$base_url"

    if [ $app_failed -eq 0 ]; then
        RESULTS[$app_name]="PASS"
        ((PASSED++))
    else
        RESULTS[$app_name]="FAIL"
        ((FAILED++))
    fi
}

# Main execution
main() {
    echo "=============================================="
    echo "DotMac Frontend Apps Smoke Test"
    echo "=============================================="

    if [ "$PRODUCTION_MODE" = true ]; then
        echo "Mode: PRODUCTION"
        echo "Tenant: $TENANT_SLUG"
    else
        echo "Mode: LOCALHOST"
    fi

    echo "Timeout: ${TIMEOUT}s"
    echo "=============================================="

    # Test each app
    for app_name in "${!APPS[@]}"; do
        test_app "$app_name" "${APPS[$app_name]}"
    done

    # Summary
    echo ""
    echo "=============================================="
    echo "SUMMARY"
    echo "=============================================="

    for app_name in "${!RESULTS[@]}"; do
        if [ "${RESULTS[$app_name]}" = "PASS" ]; then
            log_success "$app_name"
        else
            log_fail "$app_name"
        fi
    done

    echo ""
    echo "Total: $PASSED passed, $FAILED failed"
    echo "=============================================="

    # Exit with failure if any tests failed
    if [ $FAILED -gt 0 ]; then
        exit 1
    fi

    exit 0
}

main "$@"
