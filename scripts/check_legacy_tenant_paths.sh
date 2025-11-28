#!/bin/bash
# =============================================================================
# Deprecated Tenant Path Check
# =============================================================================
# This script fails CI if any code references the deprecated /api/tenant/ prefix.
# All ISP routes should use /api/isp/v1 instead.
#
# Usage:
#   ./scripts/check_legacy_tenant_paths.sh
#
# Exit codes:
#   0 - No deprecated references found
#   1 - Deprecated references found (CI should fail)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "Checking for deprecated /api/tenant/ references..."
echo "============================================================"

# Directories to check
CHECK_DIRS=(
    "src/"
    "frontend/apps/"
    "frontend/packages/"
)

# Files to exclude
EXCLUDE_PATTERNS=(
    "check_legacy_tenant_paths.sh"     # This script itself
    "test_middleware_boundaries.sh"     # Test script that validates rejection
    "CHANGELOG.md"
    "MIGRATION.md"
    "*.pyc"
    "__pycache__"
    "node_modules"
    ".git"
)

# Build exclude arguments for grep
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern"
done
EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=.venv --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=__tests__ --exclude-dir=msw"

# Patterns that indicate deprecated usage
DEPRECATED_PATTERNS=(
    '"/api/tenant/'
    "'/api/tenant/"
    '`/api/tenant/'
    'api/tenant/v1'
    '/api/v1/tenant'
)

FOUND_DEPRECATED=0
FOUND_FILES=()

echo ""
echo "Scanning directories: ${CHECK_DIRS[*]}"
echo ""

for dir in "${CHECK_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}[SKIP]${NC} Directory not found: $dir"
        continue
    fi

    for pattern in "${DEPRECATED_PATTERNS[@]}"; do
        # Use grep with error suppression for "no matches" (exit code 1)
        matches=$(grep -rn $EXCLUDE_ARGS "$pattern" "$dir" 2>/dev/null || true)

        if [ -n "$matches" ]; then
            while IFS= read -r line; do
                # Filter out lines that are clearly about rejection/docs
                if ! echo "$line" | grep -qiE "(REJECTED|is no longer supported|removed|deprecated|410 Gone|previously)"; then
                    FOUND_DEPRECATED=1
                    FOUND_FILES+=("$line")
                    echo -e "${RED}[FOUND]${NC} $line"
                fi
            done <<< "$matches"
        fi
    done
done

echo ""
echo "============================================================"

if [ ${#FOUND_FILES[@]} -gt 0 ]; then
    echo -e "${RED}ERROR: Found ${#FOUND_FILES[@]} deprecated /api/tenant/ reference(s)${NC}"
    echo ""
    echo "The /api/tenant/ prefix is not supported. Use /api/isp/v1 instead."
    echo ""
    echo "Route mapping:"
    echo "  - /api/tenant/v1/*  ->  /api/isp/v1/*"
    echo "  - /api/v1/*         ->  /api/platform/v1/* or /api/isp/v1/*"
    echo ""
    echo "See docs/ARCHITECTURE.md for the routing structure."
    echo "============================================================"
    exit 1
else
    echo -e "${GREEN}SUCCESS: No deprecated /api/tenant/ references found${NC}"
    echo "============================================================"
    exit 0
fi
