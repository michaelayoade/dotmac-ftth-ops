#!/bin/bash
# Test script for AppBoundaryMiddleware route boundary enforcement
# This script tests real API calls to validate middleware behavior

set -e

BASE_URL="http://localhost:8000"
FAILED_TESTS=0
PASSED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================="
echo "Testing AppBoundaryMiddleware Route Boundaries"
echo "================================================="
echo ""

# Helper function to test endpoint
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local headers="$5"

    echo -n "Testing: $test_name ... "

    if [ -z "$headers" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$headers" "$BASE_URL$endpoint")
    fi

    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (got $response)"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $response)"
        ((FAILED_TESTS++))
    fi
}

# Test detailed endpoint with response body
test_endpoint_detailed() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local headers="$5"

    echo "Testing: $test_name"

    if [ -z "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -H "$headers" -X "$method" "$BASE_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "  Status: $status_code"
    echo "  Body: $body" | jq -C '.' 2>/dev/null || echo "  Body: $body"

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASS${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "  ${RED}✗ FAIL${NC} (expected $expected_status)"
        ((FAILED_TESTS++))
    fi
    echo ""
}

echo "===== 1. Public Routes (Should Always Pass) ====="
test_endpoint "Health check" "GET" "/health" 200
test_endpoint "Readiness check" "GET" "/ready" 200
test_endpoint "Health live" "GET" "/health/live" 200
test_endpoint "Health ready" "GET" "/health/ready" 200
test_endpoint "API docs" "GET" "/docs" 200
test_endpoint "OpenAPI spec" "GET" "/openapi.json" 200
echo ""

echo "===== 2. Platform Routes (No Auth - Should Fail 401) ====="
test_endpoint_detailed "Platform admin (no auth)" "GET" "/api/platform/v1/admin/users" 401
test_endpoint_detailed "Platform tenants (no auth)" "GET" "/api/platform/v1/tenants" 401
test_endpoint_detailed "Platform licensing (no auth)" "GET" "/api/platform/v1/licensing/plans" 401
echo ""

echo "===== 3. Tenant Routes (No Auth - Should Fail 401) ====="
test_endpoint_detailed "Tenant customers (no auth)" "GET" "/api/tenant/v1/customers" 401
test_endpoint_detailed "Tenant RADIUS (no auth)" "GET" "/api/tenant/v1/radius/sessions" 401
test_endpoint_detailed "Tenant billing (no auth)" "GET" "/api/tenant/v1/billing/invoices" 401
echo ""

echo "===== 4. Tenant Routes (No Tenant Context - Should Fail 400) ====="
# Note: These would need valid auth token, which we're not testing here
# The middleware runs after auth, so we'd need to create a test user first
echo -e "${YELLOW}[SKIPPED]${NC} Requires authentication setup"
echo ""

echo "===== 5. Shared Routes (Available to All) ====="
test_endpoint "API info" "GET" "/api" 200
test_endpoint "API v1 info" "GET" "/api/v1/info" 200
echo ""

echo "===== 6. Non-Existent Routes (Should Fail 404) ====="
test_endpoint "Invalid route" "GET" "/api/invalid/route" 404
echo ""

echo "================================================="
echo "Test Summary"
echo "================================================="
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo "Total: $((PASSED_TESTS + FAILED_TESTS))"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
