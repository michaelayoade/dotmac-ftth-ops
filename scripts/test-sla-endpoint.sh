#!/usr/bin/env bash
#
# Test SLA Compliance Endpoint
#
# Tests the /api/v1/faults/sla/compliance endpoint with sample data
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:8000}"
TOKEN="${API_TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SLA Compliance Endpoint Test Script                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if token is provided
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠ No API_TOKEN provided. Skipping authenticated tests.${NC}"
    echo -e "${YELLOW}  Set API_TOKEN environment variable to test with authentication.${NC}"
    echo ""
    AUTHENTICATED=false
else
    echo -e "${GREEN}✓ Authentication token found${NC}"
    AUTHENTICATED=true
fi

# Calculate from_date (30 days ago)
if command -v gdate &> /dev/null; then
    # macOS with GNU date (brew install coreutils)
    FROM_DATE=$(gdate -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)
else
    # Linux with GNU date
    FROM_DATE=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
fi

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Base URL: ${BASE_URL}"
echo -e "  From Date: ${FROM_DATE}"
echo ""

# Test 1: Basic endpoint check (no auth)
echo -e "${BLUE}Test 1: Checking endpoint availability...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/faults/sla/compliance?from_date=${FROM_DATE}")

if [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
    echo -e "${GREEN}✓ Endpoint exists (requires authentication)${NC}"
elif [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ Endpoint accessible${NC}"
else
    echo -e "${RED}✗ Unexpected status code: $HTTP_CODE${NC}"
fi
echo ""

# Test 2: With authentication (if token provided)
if [ "$AUTHENTICATED" = true ]; then
    echo -e "${BLUE}Test 2: Fetching SLA compliance data (authenticated)...${NC}"

    HEADERS="-H \"Authorization: Bearer ${TOKEN}\""
    if [ -n "$TENANT_ID" ]; then
        HEADERS="${HEADERS} -H \"X-Tenant-ID: ${TENANT_ID}\""
    fi

    RESPONSE=$(curl -s \
        -H "Authorization: Bearer ${TOKEN}" \
        ${TENANT_ID:+-H "X-Tenant-ID: ${TENANT_ID}"} \
        -H "Content-Type: application/json" \
        "${BASE_URL}/api/v1/faults/sla/compliance?from_date=${FROM_DATE}")

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${TOKEN}" \
        ${TENANT_ID:+-H "X-Tenant-ID: ${TENANT_ID}"} \
        "${BASE_URL}/api/v1/faults/sla/compliance?from_date=${FROM_DATE}")

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ Request successful (HTTP 200)${NC}"

        # Check if response is valid JSON
        if echo "$RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Response is valid JSON${NC}"

            # Count records
            RECORD_COUNT=$(echo "$RESPONSE" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
            echo -e "${GREEN}✓ Received ${RECORD_COUNT} records${NC}"

            # Show first record
            if [ "$RECORD_COUNT" -gt 0 ]; then
                echo ""
                echo -e "${BLUE}Sample Record (first):${NC}"
                echo "$RESPONSE" | python3 -m json.tool | head -15

                # Validate record structure
                FIRST_RECORD=$(echo "$RESPONSE" | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin)[0]))")

                HAS_DATE=$(echo "$FIRST_RECORD" | python3 -c "import json, sys; print('date' in json.load(sys.stdin))")
                HAS_COMPLIANCE=$(echo "$FIRST_RECORD" | python3 -c "import json, sys; print('compliance_percentage' in json.load(sys.stdin))")
                HAS_TARGET=$(echo "$FIRST_RECORD" | python3 -c "import json, sys; print('target_percentage' in json.load(sys.stdin))")

                echo ""
                if [ "$HAS_DATE" == "True" ] && [ "$HAS_COMPLIANCE" == "True" ] && [ "$HAS_TARGET" == "True" ]; then
                    echo -e "${GREEN}✓ Record structure is valid${NC}"
                else
                    echo -e "${RED}✗ Record structure is invalid${NC}"
                fi
            else
                echo -e "${YELLOW}⚠ Response is empty array (Phase 1 mode)${NC}"
            fi
        else
            echo -e "${RED}✗ Response is not valid JSON${NC}"
            echo "Response: $RESPONSE"
        fi
    else
        echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
        echo "Response: $RESPONSE"
    fi
    echo ""

    # Test 3: Invalid date format
    echo -e "${BLUE}Test 3: Testing error handling (invalid date)...${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${TOKEN}" \
        ${TENANT_ID:+-H "X-Tenant-ID: ${TENANT_ID}"} \
        "${BASE_URL}/api/v1/faults/sla/compliance?from_date=invalid-date")

    if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "422" ]; then
        echo -e "${GREEN}✓ Invalid date format rejected correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Expected 400/422, got $HTTP_CODE${NC}"
    fi
    echo ""

    # Test 4: Large date range (>90 days)
    echo -e "${BLUE}Test 4: Testing date range validation...${NC}"

    if command -v gdate &> /dev/null; then
        OLD_DATE=$(gdate -u -d '100 days ago' +%Y-%m-%dT%H:%M:%SZ)
    else
        OLD_DATE=$(date -u -d '100 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-100d +%Y-%m-%dT%H:%M:%SZ)
    fi

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${TOKEN}" \
        ${TENANT_ID:+-H "X-Tenant-ID: ${TENANT_ID}"} \
        "${BASE_URL}/api/v1/faults/sla/compliance?from_date=${OLD_DATE}")

    if [ "$HTTP_CODE" == "400" ]; then
        echo -e "${GREEN}✓ Date range > 90 days rejected correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Expected 400, got $HTTP_CODE${NC}"
    fi
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Test Suite Complete                                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$AUTHENTICATED" = false ]; then
    echo -e "${YELLOW}To test with authentication:${NC}"
    echo -e "  export API_TOKEN=\"your_jwt_token\""
    echo -e "  export TENANT_ID=\"your_tenant_id\"  # optional"
    echo -e "  ./scripts/test-sla-endpoint.sh"
    echo ""
fi
