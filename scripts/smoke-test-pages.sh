#!/bin/bash

###############################################################################
# Simple Smoke Test - Verify Critical Pages Are Accessible
###############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISP_OPS_URL="http://localhost:3001"
PLATFORM_ADMIN_URL="http://localhost:3002"

echo "🔥 Smoke Testing Critical Pages"
echo ""

# Test counter
PASSED=0
FAILED=0

test_page() {
    local url=$1
    local name=$2

    printf "%-60s " "$name..."

    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 5)

    if [ "$http_code" == "200" ] || [ "$http_code" == "302" ] || [ "$http_code" == "304" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "ISP Ops App ($ISP_OPS_URL)"
echo "────────────────────────────────────────────────────────────"
test_page "$ISP_OPS_URL/" "Home page"
test_page "$ISP_OPS_URL/login" "Login page"
test_page "$ISP_OPS_URL/dashboard" "Dashboard"
test_page "$ISP_OPS_URL/dashboard/subscribers" "Subscribers list"
test_page "$ISP_OPS_URL/dashboard/radius" "RADIUS dashboard"
test_page "$ISP_OPS_URL/dashboard/network" "Network dashboard"
test_page "$ISP_OPS_URL/dashboard/billing-revenue" "Billing dashboard"
test_page "$ISP_OPS_URL/dashboard/devices" "Devices list"
test_page "$ISP_OPS_URL/dashboard/settings" "Settings"
test_page "$ISP_OPS_URL/customer-portal" "Customer portal"
test_page "$ISP_OPS_URL/favicon.ico" "Favicon"

echo ""
echo "Platform Admin App ($PLATFORM_ADMIN_URL)"
echo "────────────────────────────────────────────────────────────"
test_page "$PLATFORM_ADMIN_URL/" "Home page"
test_page "$PLATFORM_ADMIN_URL/login" "Login page"
test_page "$PLATFORM_ADMIN_URL/dashboard" "Dashboard"
test_page "$PLATFORM_ADMIN_URL/dashboard/platform-admin/tenants" "Tenant management"
test_page "$PLATFORM_ADMIN_URL/dashboard/security-access" "Security access"
test_page "$PLATFORM_ADMIN_URL/dashboard/licensing" "Licensing"
test_page "$PLATFORM_ADMIN_URL/tenant-portal" "Tenant portal"
test_page "$PLATFORM_ADMIN_URL/dashboard/settings" "Settings"
test_page "$PLATFORM_ADMIN_URL/favicon.ico" "Favicon"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo "════════════════════════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
