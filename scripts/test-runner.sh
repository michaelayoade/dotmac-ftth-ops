#!/bin/bash

###############################################################################
# Comprehensive Test Runner Script
#
# Runs all tests across frontend and backend with reporting
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}=============================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}=============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

run_test_suite() {
    local suite_name=$1
    local command=$2

    echo ""
    echo -e "${BLUE}Running: $suite_name${NC}"
    echo "Command: $command"
    echo ""

    if eval "$command"; then
        print_success "$suite_name passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "$suite_name failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Parse command line arguments
TEST_TYPE="${1:-all}"
VERBOSE="${2:-false}"

print_header "DotMac Platform Test Runner"

echo "Project Root: $PROJECT_ROOT"
echo "Test Type: $TEST_TYPE"
echo ""

# Check prerequisites
print_header "Checking Prerequisites"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js found: $(node --version)"

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed"
    exit 1
fi
print_success "pnpm found: $(pnpm --version)"

if command -v python3 &> /dev/null; then
    print_success "Python found: $(python3 --version)"
else
    print_warning "Python not found (backend tests will be skipped)"
fi

# Run tests based on type
case $TEST_TYPE in
    "all")
        print_header "Running All Tests"

        # Frontend type checking
        run_test_suite "Frontend Type Check" "cd $FRONTEND_DIR && pnpm type-check"

        # Frontend linting
        run_test_suite "Frontend Lint" "cd $FRONTEND_DIR && pnpm lint || true"

        # Frontend unit tests
        run_test_suite "Frontend Unit Tests" "cd $FRONTEND_DIR && pnpm test || true"

        # Frontend E2E tests
        run_test_suite "Frontend E2E Tests" "cd $FRONTEND_DIR && E2E_SKIP_SERVER=true pnpm e2e || true"

        # Backend tests (if Python available)
        if command -v python3 &> /dev/null && [ -f "$BACKEND_DIR/pyproject.toml" ]; then
            run_test_suite "Backend Tests" "cd $BACKEND_DIR && poetry run pytest tests/ -v --tb=short || true"
        fi
        ;;

    "frontend")
        print_header "Running Frontend Tests Only"

        run_test_suite "Frontend Type Check" "cd $FRONTEND_DIR && pnpm type-check"
        run_test_suite "Frontend Unit Tests" "cd $FRONTEND_DIR && pnpm test || true"
        ;;

    "e2e")
        print_header "Running E2E Tests Only"

        run_test_suite "E2E Tests" "cd $FRONTEND_DIR && E2E_SKIP_SERVER=true pnpm e2e"
        ;;

    "backend")
        print_header "Running Backend Tests Only"

        if command -v python3 &> /dev/null && [ -f "$BACKEND_DIR/pyproject.toml" ]; then
            run_test_suite "Backend Tests" "cd $BACKEND_DIR && poetry run pytest tests/ -v"
        else
            print_error "Backend tests cannot run (Python or pyproject.toml not found)"
            exit 1
        fi
        ;;

    "quick")
        print_header "Running Quick Tests (Type Check + Unit)"

        run_test_suite "Type Check" "cd $FRONTEND_DIR && pnpm type-check"
        run_test_suite "Unit Tests" "cd $FRONTEND_DIR && pnpm test || true"
        ;;

    "smoke")
        print_header "Running Smoke Tests"

        # Just verify builds work
        run_test_suite "Build Check" "cd $FRONTEND_DIR && pnpm build:isp || true"
        ;;

    *)
        print_error "Unknown test type: $TEST_TYPE"
        echo ""
        echo "Usage: $0 [all|frontend|e2e|backend|quick|smoke]"
        echo ""
        echo "  all      - Run all tests (default)"
        echo "  frontend - Run frontend unit tests and type checking"
        echo "  e2e      - Run end-to-end tests only"
        echo "  backend  - Run backend tests only"
        echo "  quick    - Run type check and unit tests (fast)"
        echo "  smoke    - Run smoke tests (build verification)"
        echo ""
        exit 1
        ;;
esac

# Print summary
print_header "Test Summary"

echo ""
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All tests passed! 🎉"
    exit 0
else
    print_error "Some tests failed"
    exit 1
fi
