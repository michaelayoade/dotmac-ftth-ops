#!/bin/bash
# scripts/count_mocks.sh
# Count mock usage in the test suite to track reduction over time

set -e

echo "Mock Usage Report"
echo "================="
echo ""

# Count mock imports and usage
MOCK_IMPORTS=$(grep -r "from unittest.mock import\|from unittest import mock\|import mock\|from mock import" tests/ 2>/dev/null | wc -l | tr -d ' ')
MOCK_PATCH=$(grep -r "@mock.patch\|@patch\|with patch\|with mock.patch" tests/ 2>/dev/null | wc -l | tr -d ' ')
MOCK_MAGICMOCK=$(grep -r "MagicMock\|Mock()" tests/ 2>/dev/null | wc -l | tr -d ' ')
MOCKER_FIXTURE=$(grep -r "mocker.patch\|mocker.Mock\|mocker.MagicMock" tests/ 2>/dev/null | wc -l | tr -d ' ')

echo "Mock imports:           $MOCK_IMPORTS"
echo "Mock decorators/ctx:    $MOCK_PATCH"
echo "MagicMock/Mock():       $MOCK_MAGICMOCK"
echo "pytest-mock (mocker):   $MOCKER_FIXTURE"
echo ""

TOTAL=$((MOCK_IMPORTS + MOCK_PATCH + MOCK_MAGICMOCK + MOCKER_FIXTURE))
echo "📊 Total mock import/usage lines: $TOTAL"
echo ""

# Show top files with most mocks
echo "Top 10 files by mock usage:"
echo "---------------------------"
grep -rcl "mock\|Mock\|patch" tests/ 2>/dev/null | while read -r file; do
    count=$(grep -c "mock\|Mock\|patch" "$file" 2>/dev/null || echo "0")
    echo "$count $file"
done | sort -rn | head -10 | while read -r count file; do
    echo "  $count: $file"
done

echo ""
echo "💡 Tip: Use factories (tests/billing/factories.py) instead of mocks"
echo "   See: docs/unit-test-review-verified.md for guidance"
