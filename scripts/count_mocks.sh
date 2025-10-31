#!/bin/bash
# Mock Usage Tracking Script
# Measures mock/patch usage across test suite
#
# Usage:
#   bash scripts/count_mocks.sh           # Human-readable report
#   bash scripts/count_mocks.sh --json    # JSON output for CI

JSON_OUTPUT=false
if [[ "$1" == "--json" ]]; then
    JSON_OUTPUT=true
fi

if [[ "$JSON_OUTPUT" == "false" ]]; then
    echo "==========================================="
    echo "Mock Usage Report - $(date +%Y-%m-%d)"
    echo "==========================================="
    echo ""
fi

# Total mock usage (count imports and instance creations separately to avoid double-counting)
mock_imports=$(grep -rh "from unittest.mock import\|import unittest.mock" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
async_mock_usage=$(grep -r "AsyncMock\(" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
magic_mock_usage=$(grep -r "MagicMock\(" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
mock_usage=$(grep -rE "\bMock\(" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
patch_usage=$(grep -rE "@patch|@mock\.patch|with patch\(" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
total=$((mock_imports + async_mock_usage + magic_mock_usage + mock_usage + patch_usage))

echo "📊 Total mock import/usage lines: $total"
echo "  - Mock imports:        $mock_imports"
echo "  - AsyncMock instances: $async_mock_usage"
echo "  - MagicMock instances: $magic_mock_usage"
echo "  - Mock instances:      $mock_usage"
echo "  - @patch decorators:   $patch_usage"
echo ""

# Mock types breakdown
echo "📦 Mock Type Breakdown:"
echo "  AsyncMock:    $async_mock_usage"
echo "  MagicMock:    $magic_mock_usage"
echo "  @patch:       $patch_usage"
echo "  Mock():       $mock_usage"
echo ""

# Auth mocking (should be removed)
auth_mocks=$(grep -r "patch.*get_current_user\|patch.*get_current_tenant_id" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
echo "🔐 Auth mocking (target: 0): $auth_mocks"
echo ""

# Database mocking (should be minimal)
db_mocks=$(grep -r "mock.*session\|mock.*engine\|AsyncMock.*execute" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
echo "🗄️  Database mocking (target: <50): $db_mocks"
echo ""

# Service mocking (should be reduced)
service_mocks=$(grep -r "mock.*service\|mock.*Service" tests/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
echo "⚙️  Service mocking (target: <500): $service_mocks"
echo ""

echo "📂 Mock Usage by Module (Top 20):"
echo "=================================="
for dir in tests/*/; do
    if [ -d "$dir" ]; then
        module_name=$(basename "$dir")
        # Count unique lines containing mock usage to avoid double-counting
        count=$(grep -rhE "from unittest.mock import|import unittest.mock|AsyncMock\(|MagicMock\(|\bMock\(|@patch|@mock\.patch|with patch\(" "$dir" --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$count" -gt 0 ]; then
            echo "$count|$module_name"
        fi
    fi
done | sort -t'|' -k1 -rn | head -20 | while IFS='|' read count module; do
    printf "  %-30s %5s lines\n" "$module" "$count"
done

echo ""
if [[ "$JSON_OUTPUT" == "true" ]]; then
    # Output JSON format
    echo "{"
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"total_lines\": $total,"
    echo "  \"breakdown\": {"
    echo "    \"imports\": $mock_imports,"
    echo "    \"async_mock\": $async_mock_usage,"
    echo "    \"magic_mock\": $magic_mock_usage,"
    echo "    \"mock\": $mock_usage,"
    echo "    \"patch\": $patch_usage"
    echo "  },"
    echo "  \"categories\": {"
    echo "    \"auth_mocks\": $auth_mocks,"
    echo "    \"db_mocks\": $db_mocks,"
    echo "    \"service_mocks\": $service_mocks"
    echo "  },"
    echo "  \"modules\": {"

    # Module breakdown as JSON
    FIRST=true
    for dir in tests/*/; do
        if [ -d "$dir" ]; then
            module_name=$(basename "$dir")
            count=$(grep -rhE "from unittest.mock import|import unittest.mock|AsyncMock\(|MagicMock\(|\bMock\(|@patch|@mock\.patch|with patch\(" "$dir" --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$count" -gt 0 ]; then
                if [ "$FIRST" = true ]; then
                    FIRST=false
                else
                    echo ","
                fi
                echo -n "    \"$module_name\": $count"
            fi
        fi
    done
    echo ""
    echo "  }"
    echo "}"
else
    # Human-readable output
    echo "🎯 Reduction Goals:"
    echo "==================="
    echo "  Current:   $total lines"
    # Calculate phase targets with minimum of 0
    phase1_target=$((total > 1000 ? total - 1000 : 0))
    phase2_target=$((total > 4000 ? total - 4000 : 0))
    final_target=$((total > 17000 ? 10000 : total / 2))
    echo "  Phase 1:   ~$phase1_target lines (remove auth mocks, quick wins)"
    echo "  Phase 2:   ~$phase2_target lines (replace DB mocks with factories)"
    echo "  Target:    ~$final_target lines (use fakes for external services)"
    echo ""
fi
