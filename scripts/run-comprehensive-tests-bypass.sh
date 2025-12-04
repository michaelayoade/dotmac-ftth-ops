#!/bin/bash

###############################################################################
# Run Comprehensive UI/UX Tests with Auth Bypass
###############################################################################

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Running Comprehensive UI/UX Tests (Auth Bypass Mode)     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Stop existing dev servers
echo -e "${YELLOW}Stopping existing dev servers...${NC}"
pkill -f "next-server" || true
pkill -f "pnpm --filter @dotmac/isp-ops-app dev" || true
sleep 2

# 2. Start ISP Ops App with Auth Bypass
echo -e "${YELLOW}Starting ISP Ops App with authentication bypass...${NC}"
cd frontend
NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true \
NEXT_PUBLIC_MSW_ENABLED=false \
pnpm --filter @dotmac/isp-ops-app dev > /tmp/isp-app-test.log 2>&1 &
ISP_PID=$!
cd ..

echo "ISP App started with PID: $ISP_PID"
echo "Waiting for app to be ready..."

# Wait for app to be accessible
for i in {1..60}; do
    if curl -s http://localhost:3001 > /dev/null; then
        echo -e "${GREEN}✓ App is up!${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Give it a few more seconds to fully hydrate
sleep 5

# 3. Run Playwright Tests
echo -e "${CYAN}Running Playwright tests...${NC}"
cd frontend

# We use E2E_USE_DEV_SERVER=true so Playwright uses our running instance
# We increase timeouts to be safe
E2E_USE_DEV_SERVER=true \
ISP_OPS_URL="http://localhost:3001" \
npx playwright test e2e/tests/comprehensive-ui-ux.spec.ts \
    --reporter=html,list \
    --timeout=60000 \
    --output=e2e/test-results-auth-bypass

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Tests Passed!${NC}"
else
    echo -e "${RED}✗ Tests Failed!${NC}"
fi

# 4. Generate Report
echo -e "${CYAN}Serving test report on port 9323...${NC}"
npx playwright show-report e2e/test-results-auth-bypass/playwright-report --host 0.0.0.0 --port 9323 &
REPORT_PID=$!

echo ""
echo -e "${GREEN}Test run complete.${NC}"
echo -e "View report at: ${CYAN}http://149.102.135.97:9323${NC}"
echo ""
echo -e "${YELLOW}Note: The dev server (PID $ISP_PID) and Report server (PID $REPORT_PID) are still running.${NC}"
echo -e "To stop them later, run: kill $ISP_PID $REPORT_PID"
