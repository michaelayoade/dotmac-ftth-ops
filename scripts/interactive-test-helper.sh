#!/bin/bash

###############################################################################
# Interactive Testing Helper
#
# Helps manually test pages and functionality with browser automation
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
ISP_OPS_URL="http://localhost:3001"
PLATFORM_ADMIN_URL="http://localhost:3002"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo ""
}

print_menu() {
    echo -e "${BLUE}What would you like to test?${NC}"
    echo ""
    echo "  1) Test ISP Ops App (port 3001)"
    echo "  2) Test Platform Admin App (port 3002)"
    echo "  3) Run comprehensive E2E tests"
    echo "  4) Check if apps are running"
    echo "  5) Open browser inspector"
    echo "  6) Test all critical pages (smoke test)"
    echo "  7) Generate test report"
    echo "  q) Quit"
    echo ""
}

check_apps_running() {
    print_header "Checking Running Apps"

    # Check ISP Ops
    if curl -s -o /dev/null -w "%{http_code}" "$ISP_OPS_URL" | grep -q "200"; then
        echo -e "${GREEN}✓ ISP Ops App running on $ISP_OPS_URL${NC}"
    else
        echo -e "${RED}✗ ISP Ops App NOT running on $ISP_OPS_URL${NC}"
        echo -e "  ${YELLOW}Start with: cd frontend && pnpm dev:isp${NC}"
    fi

    # Check Platform Admin
    if curl -s -o /dev/null -w "%{http_code}" "$PLATFORM_ADMIN_URL" | grep -q "200"; then
        echo -e "${GREEN}✓ Platform Admin App running on $PLATFORM_ADMIN_URL${NC}"
    else
        echo -e "${RED}✗ Platform Admin App NOT running on $PLATFORM_ADMIN_URL${NC}"
        echo -e "  ${YELLOW}Start with: cd frontend && pnpm dev:admin${NC}"
    fi

    echo ""
}

open_browser_inspector() {
    local url=$1
    print_header "Opening Browser Inspector"

    echo "Opening browser for: $url"
    echo ""
    echo "This will:"
    echo "  • Open Chrome with DevTools"
    echo "  • Capture console logs"
    echo "  • Show network errors"
    echo "  • Display page metrics"
    echo ""
    echo "Press Ctrl+C to close when done."
    echo ""

    node "$SCRIPT_DIR/browser-inspector.mjs" "$url"
}

test_page_list() {
    local base_url=$1
    local app_name=$2

    print_header "Testing $app_name Pages"

    echo "Testing critical pages for accessibility..."
    echo ""

    local pages=(
        "/"
        "/login"
        "/dashboard"
        "/dashboard/subscribers"
        "/dashboard/billing-revenue"
        "/dashboard/settings"
    )

    for page in "${pages[@]}"; do
        local full_url="$base_url$page"
        echo -n "Testing $page... "

        if curl -s -o /dev/null -w "%{http_code}" "$full_url" | grep -q "200\|302"; then
            echo -e "${GREEN}✓ OK${NC}"
        else
            echo -e "${RED}✗ FAILED${NC}"
        fi
    done

    echo ""
}

run_e2e_tests() {
    print_header "Running E2E Tests"

    cd "$SCRIPT_DIR/../frontend" || exit 1

    echo "Starting Playwright E2E tests..."
    echo ""

    E2E_SKIP_SERVER=true pnpm e2e --reporter=list

    echo ""
    echo "Test complete! View detailed report:"
    echo "  npx playwright show-report"
}

smoke_test() {
    print_header "Running Smoke Test"

    echo "Quickly testing all critical pages..."
    echo ""

    test_page_list "$ISP_OPS_URL" "ISP Ops"
    test_page_list "$PLATFORM_ADMIN_URL" "Platform Admin"

    print_header "Smoke Test Complete"
}

generate_test_report() {
    print_header "Generating Test Report"

    local report_file="$SCRIPT_DIR/../test-report-$(date +%Y%m%d-%H%M%S).txt"

    {
        echo "DotMac Platform Test Report"
        echo "Generated: $(date)"
        echo ""
        echo "=========================================="
        echo ""

        echo "App Status:"
        curl -s -o /dev/null -w "ISP Ops (3001): HTTP %{http_code}\n" "$ISP_OPS_URL"
        curl -s -o /dev/null -w "Platform Admin (3002): HTTP %{http_code}\n" "$PLATFORM_ADMIN_URL"
        echo ""

        echo "Page Accessibility:"
        echo ""

        for page in "/" "/login" "/dashboard" "/dashboard/subscribers"; do
            printf "%-40s " "$page"
            curl -s -o /dev/null -w "HTTP %{http_code}\n" "$ISP_OPS_URL$page"
        done

        echo ""
        echo "=========================================="
    } | tee "$report_file"

    echo ""
    echo -e "${GREEN}Report saved to: $report_file${NC}"
    echo ""
}

# Main loop
print_header "Interactive Testing Helper"

while true; do
    print_menu

    read -p "Select an option: " choice

    case $choice in
        1)
            check_apps_running
            echo ""
            read -p "Open browser inspector for ISP Ops? (y/n): " confirm
            if [ "$confirm" = "y" ]; then
                open_browser_inspector "$ISP_OPS_URL"
            fi
            ;;
        2)
            check_apps_running
            echo ""
            read -p "Open browser inspector for Platform Admin? (y/n): " confirm
            if [ "$confirm" = "y" ]; then
                open_browser_inspector "$PLATFORM_ADMIN_URL"
            fi
            ;;
        3)
            run_e2e_tests
            ;;
        4)
            check_apps_running
            ;;
        5)
            echo ""
            echo "Which app?"
            echo "  1) ISP Ops (3001)"
            echo "  2) Platform Admin (3002)"
            read -p "Select: " app_choice

            case $app_choice in
                1) open_browser_inspector "$ISP_OPS_URL" ;;
                2) open_browser_inspector "$PLATFORM_ADMIN_URL" ;;
                *) echo "Invalid choice" ;;
            esac
            ;;
        6)
            smoke_test
            ;;
        7)
            generate_test_report
            ;;
        q|Q)
            echo ""
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo ""
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
done
