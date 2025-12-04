#!/bin/bash

###############################################################################
# Create Test Users via API
###############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:8000}"

echo -e "${CYAN}🔧 Creating Test Users for E2E Testing${NC}"
echo ""

# Test users to create
declare -a users=(
    '{"email":"test@example.com","password":"TestPass123!","full_name":"Test User","tenant_name":"Test ISP"}'
    '{"email":"operator@test.com","password":"OperatorPass123!","full_name":"Test Operator","tenant_name":"Test ISP"}'
    '{"email":"customer@test.com","password":"CustomerPass123!","full_name":"Test Customer","tenant_name":"Test ISP"}'
)

CREATED=0
EXISTING=0

for user_json in "${users[@]}"; do
    email=$(echo "$user_json" | grep -o '"email":"[^"]*"' | cut -d'"' -f4)

    echo -n "Creating $email... "

    response=$(curl -s -w "%{http_code}" -o /tmp/user_response.json \
        -X POST "$API_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d "$user_json")

    http_code="${response: -3}"

    if [ "$http_code" == "201" ] || [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓ Created${NC}"
        CREATED=$((CREATED+1))
    elif [ "$http_code" == "400" ]; then
        # Check if user already exists
        if grep -q "already registered\|already exists" /tmp/user_response.json 2>/dev/null; then
            echo -e "${YELLOW}✓ Already exists${NC}"
            EXISTING=$((EXISTING+1))
        else
            echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
            cat /tmp/user_response.json 2>/dev/null
        fi
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    fi
done

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "  Created: $CREATED"
echo -e "  Existing: $EXISTING"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

if [ $CREATED -gt 0 ] || [ $EXISTING -gt 0 ]; then
    echo -e "${GREEN}✅ Test users ready!${NC}"
    echo ""
    echo -e "${YELLOW}Test Credentials:${NC}"
    echo "─────────────────────────────────────────"
    echo "Admin:    test@example.com / TestPass123!"
    echo "Operator: operator@test.com / OperatorPass123!"
    echo "Customer: customer@test.com / CustomerPass123!"
    echo ""
    echo -e "${YELLOW}Set for E2E tests:${NC}"
    echo 'export TEST_USER_EMAIL="test@example.com"'
    echo 'export TEST_USER_PASSWORD="TestPass123!"'
    echo ""

    # Save to env file
    cat > /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/.env.test << EOF
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPass123!
TEST_OPERATOR_EMAIL=operator@test.com
TEST_OPERATOR_PASSWORD=OperatorPass123!
TEST_CUSTOMER_EMAIL=customer@test.com
TEST_CUSTOMER_PASSWORD=CustomerPass123!
API_URL=$API_URL
EOF

    echo -e "${GREEN}✓ Credentials saved to .env.test${NC}"
    exit 0
else
    echo -e "${RED}❌ Failed to create test users${NC}"
    echo "Make sure the backend is running on $API_URL"
    exit 1
fi
