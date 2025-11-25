#!/bin/bash

###############################################################################
# Comprehensive UI/UX Testing Script for ISP Operations App
# Runs automated tests and generates detailed report with screenshots
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Comprehensive UI/UX Testing - ISP Operations App         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
ISP_OPS_URL="${ISP_OPS_URL:-http://localhost:3001}"
REPORT_DIR="frontend/e2e/test-results"
SCREENSHOT_DIR="$REPORT_DIR/screenshots"

echo -e "${YELLOW}Configuration:${NC}"
echo "  ISP Ops URL: $ISP_OPS_URL"
echo "  Report Directory: $REPORT_DIR"
echo "  Screenshot Directory: $SCREENSHOT_DIR"
echo ""

# Create directories
echo -e "${CYAN}Setting up test environment...${NC}"
mkdir -p "$SCREENSHOT_DIR"

# Check if app is running
echo -e "${CYAN}Checking if ISP Ops app is running...${NC}"
if curl -s -f "$ISP_OPS_URL" > /dev/null; then
    echo -e "${GREEN}✓ ISP Ops app is running${NC}"
else
    echo -e "${RED}✗ ISP Ops app is not accessible at $ISP_OPS_URL${NC}"
    echo -e "${YELLOW}Please start the app first:${NC}"
    echo "  cd frontend && pnpm dev:isp"
    exit 1
fi

echo ""
echo -e "${CYAN}Running comprehensive UI/UX tests...${NC}"
echo ""

# Run Playwright tests
cd frontend

# Install browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install chromium
fi

# Run the comprehensive UI/UX tests
echo -e "${CYAN}Executing test suite...${NC}"
E2E_USE_DEV_SERVER=true \
ISP_OPS_URL="$ISP_OPS_URL" \
npx playwright test \
    --config=e2e/playwright.config.ts \
    e2e/tests/comprehensive-ui-ux.spec.ts \
    --reporter=html,list \
    --output="$REPORT_DIR" \
    || true

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Test Execution Complete                                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Generate summary report
echo -e "${CYAN}Generating summary report...${NC}"

REPORT_FILE="$REPORT_DIR/ui-ux-summary.md"

cat > "$REPORT_FILE" << 'EOF'
# UI/UX Testing Report - ISP Operations App

**Date:** $(date +"%Y-%m-%d %H:%M:%S")
**Application:** ISP Operations App
**Base URL:** $ISP_OPS_URL

---

## Test Execution Summary

### Test Categories Executed

1. **Page Load & Visual Design**
   - Homepage
   - Login page
   - Dashboard
   - Subscribers page
   - Network dashboard
   - Billing dashboard
   - RADIUS dashboard
   - Devices page
   - Settings page
   - Customer portal

2. **Responsive Design**
   - Mobile view (375x667)
   - Tablet view (768x1024)
   - Desktop view (1920x1080)

3. **Navigation & User Flow**
   - Navigation menu accessibility
   - Page-to-page navigation
   - Breadcrumb navigation

4. **Performance & Loading**
   - Page load times
   - Console error detection
   - Image loading verification

5. **Accessibility**
   - Heading structure
   - Keyboard navigation
   - Button labels
   - Form labels

6. **Interactive Elements**
   - Button functionality
   - Link functionality
   - Table interactions

7. **Visual Consistency**
   - Color scheme
   - Typography
   - Spacing

---

## Screenshots Captured

All screenshots are available in: `$SCREENSHOT_DIR/`

### Page Screenshots
- `homepage.png` - Application homepage
- `login-page.png` - Login interface
- `dashboard.png` - Main dashboard
- `subscribers.png` - Subscribers management
- `network.png` - Network dashboard
- `billing.png` - Billing and revenue
- `radius.png` - RADIUS dashboard
- `devices.png` - Device management
- `settings.png` - Settings page
- `customer-portal.png` - Customer portal

### Responsive Screenshots
- `dashboard-mobile.png` - Mobile view
- `dashboard-tablet.png` - Tablet view
- `dashboard-desktop.png` - Desktop view

### Feature Screenshots
- `navigation.png` - Navigation menu
- `keyboard-focus.png` - Keyboard accessibility
- `buttons.png` - Button elements
- `table.png` - Table interactions
- `color-scheme.png` - Color scheme

---

## Detailed Test Results

See the full HTML report: `playwright-report/index.html`

To view the report:
```bash
cd frontend
npx playwright show-report e2e/test-results/playwright-report
```

---

## Next Steps

1. Review all screenshots for visual consistency
2. Check the HTML report for detailed test results
3. Address any failed tests or accessibility issues
4. Test on actual mobile devices if needed
5. Conduct user acceptance testing

EOF

# Replace variables in report
sed -i "s|\$(date +\"%Y-%m-%d %H:%M:%S\")|$(date +"%Y-%m-%d %H:%M:%S")|g" "$REPORT_FILE"
sed -i "s|\$ISP_OPS_URL|$ISP_OPS_URL|g" "$REPORT_FILE"
sed -i "s|\$SCREENSHOT_DIR|$SCREENSHOT_DIR|g" "$REPORT_FILE"

echo -e "${GREEN}✓ Summary report generated: $REPORT_FILE${NC}"
echo ""

# Count screenshots
SCREENSHOT_COUNT=$(find "$SCREENSHOT_DIR" -name "*.png" 2>/dev/null | wc -l)

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Results Summary                                           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Screenshots captured: ${GREEN}$SCREENSHOT_COUNT${NC}"
echo -e "  Report location: ${YELLOW}$REPORT_FILE${NC}"
echo -e "  Screenshot directory: ${YELLOW}$SCREENSHOT_DIR${NC}"
echo ""

# List all screenshots
if [ $SCREENSHOT_COUNT -gt 0 ]; then
    echo -e "${CYAN}Screenshots captured:${NC}"
    find "$SCREENSHOT_DIR" -name "*.png" -exec basename {} \; | sort | sed 's/^/  - /'
    echo ""
fi

echo -e "${GREEN}✓ UI/UX testing complete!${NC}"
echo ""
echo -e "${YELLOW}To view the full HTML report:${NC}"
echo "  cd frontend && npx playwright show-report e2e/test-results/playwright-report"
echo ""
echo -e "${YELLOW}To view screenshots:${NC}"
echo "  ls -lh $SCREENSHOT_DIR/"
echo ""
