#!/bin/bash
# Test Pyramid Quick Commands
# Save this file and source it for quick access to common commands
#
# Usage:
#   source scripts/test_pyramid_aliases.sh
#   # or add to your ~/.bashrc or ~/.zshrc:
#   source /path/to/dotmac-ftth-ops/scripts/test_pyramid_aliases.sh

# =============================================================================
# RUNNING TESTS
# =============================================================================

# Run only unit tests (fast feedback)
alias test-unit='pytest -m unit tests/ -v'

# Run unit + integration tests (pre-commit)
alias test-pre-commit='pytest -m "unit or integration" tests/'

# Run full suite
alias test-all='pytest -m "" tests/'

# Run with coverage
alias test-unit-cov='pytest -m unit tests/ --cov=src/dotmac/platform --cov-report=html'

# =============================================================================
# BILLING MODULE
# =============================================================================

# Run billing unit tests
alias test-billing-unit='pytest tests/billing/test_money_utils.py tests/billing/test_currency_utils.py tests/billing/test_tax_calculator_complete.py tests/billing/test_pricing_models.py -m unit -v'

# Categorize billing tests
alias billing-categorize='python scripts/categorize_billing_tests.py'

# =============================================================================
# INTERNET PLANS MODULE
# =============================================================================

# Run internet plans unit tests
alias test-plans-unit='pytest tests/services/internet_plans/test_validator.py -m unit -v'

# Run internet plans integration tests
alias test-plans-integration='pytest tests/services/internet_plans/test_service.py -m integration -v'

# =============================================================================
# CI MONITORING
# =============================================================================

# Monitor CI performance
alias ci-monitor='python scripts/monitor_ci_performance.py'

# Generate CI report
alias ci-report='python scripts/monitor_ci_performance.py --output ci_report.md'

# List recent GitHub workflow runs
alias gh-runs='gh run list --workflow=unified-ci.yml --limit 10'

# Watch current run
alias gh-watch='gh run watch'

# =============================================================================
# TEST COLLECTION
# =============================================================================

# See what tests would run (without running them)
alias test-collect-unit='pytest -m unit tests/ --collect-only'
alias test-collect-integration='pytest -m integration tests/ --collect-only'
alias test-collect-e2e='pytest -m e2e tests/ --collect-only'

# Count tests by marker
alias test-count-unit='pytest -m unit tests/ --collect-only -q | tail -1'
alias test-count-integration='pytest -m integration tests/ --collect-only -q | tail -1'
alias test-count-e2e='pytest -m e2e tests/ --collect-only -q | tail -1'

# =============================================================================
# HELPERS
# =============================================================================

# Show test pyramid documentation
test-docs() {
    echo "📚 Test Pyramid Documentation:"
    echo ""
    echo "  Quick Reference:  docs/guides/TEST_PYRAMID_QUICK_REFERENCE.md"
    echo "  Team Onboarding:  docs/guides/TEST_PYRAMID_TEAM_ONBOARDING.md"
    echo "  Guidelines:       docs/guides/TEST_PYRAMID_MARKER_GUIDELINES.md"
    echo "  Billing Rollout:  docs/guides/TEST_PYRAMID_BILLING_ROLLOUT.md"
    echo ""
}

# Show test pyramid stats
test-stats() {
    echo "📊 Test Pyramid Statistics:"
    echo ""
    echo "Unit tests:"
    pytest -m unit tests/ --collect-only -q 2>/dev/null | tail -1 || echo "  Run 'pytest -m unit tests/ --collect-only' to see details"
    echo ""
    echo "Integration tests:"
    pytest -m integration tests/ --collect-only -q 2>/dev/null | tail -1 || echo "  Run 'pytest -m integration tests/ --collect-only' to see details"
    echo ""
    echo "E2E tests:"
    pytest -m e2e tests/ --collect-only -q 2>/dev/null | tail -1 || echo "  Run 'pytest -m e2e tests/ --collect-only' to see details"
    echo ""
}

echo "✅ Test Pyramid commands loaded!"
echo ""
echo "Available aliases:"
echo "  test-unit              - Run unit tests (fast)"
echo "  test-pre-commit        - Run unit + integration"
echo "  test-all               - Run full suite"
echo "  test-billing-unit      - Run billing unit tests"
echo "  test-plans-unit        - Run internet plans unit tests"
echo "  billing-categorize     - Analyze billing tests"
echo "  ci-monitor             - Monitor CI performance"
echo "  gh-runs                - List recent CI runs"
echo ""
echo "Available functions:"
echo "  test-docs              - Show documentation links"
echo "  test-stats             - Show test counts by marker"
echo ""
echo "For more help, run: test-docs"
