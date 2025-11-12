#!/bin/bash

# Find Migration Opportunities Script
# Identifies duplicated code that can be moved to @dotmac/features

set -e

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM_ADMIN="$FRONTEND_DIR/apps/platform-admin-app"
ISP_OPS="$FRONTEND_DIR/apps/isp-ops-app"

echo "🔍 Finding migration opportunities..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  QUICK WINS: Utilities & Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "${YELLOW}📊 Status Color Definitions${NC}"
echo "   Files with hardcoded status colors (can use shared utils):"
grep -r "bg-gray-500/10" "$PLATFORM_ADMIN" "$ISP_OPS" 2>/dev/null | grep -v node_modules | cut -d: -f1 | sort -u | head -10 || echo "   None found"
echo ""

echo "${YELLOW}💰 Currency Formatters${NC}"
echo "   Files with local formatCurrency function (can use shared):"
grep -r "function formatCurrency\|const formatCurrency\|formatCurrency =" "$PLATFORM_ADMIN/lib" "$ISP_OPS/lib" 2>/dev/null | grep -v node_modules | cut -d: -f1 | sort -u || echo "   None found"
echo ""

echo "${YELLOW}📋 Type Definitions${NC}"
echo "   Files with Invoice interface (should use shared types):"
grep -r "interface Invoice" "$PLATFORM_ADMIN/types" "$ISP_OPS/types" 2>/dev/null | grep -v node_modules | cut -d: -f1 | sort -u || echo "   None found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DUPLICATED COMPONENTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "${YELLOW}🔄 Identical Billing Components${NC}"
echo "   Checking for identical files..."

# Find identical billing components
if [ -d "$PLATFORM_ADMIN/components/billing" ] && [ -d "$ISP_OPS/components/billing" ]; then
  identical_count=0
  for file in "$PLATFORM_ADMIN/components/billing"/*.tsx; do
    filename=$(basename "$file")
    isp_file="$ISP_OPS/components/billing/$filename"

    if [ -f "$isp_file" ]; then
      if diff -q "$file" "$isp_file" > /dev/null 2>&1; then
        echo "   ${GREEN}✓ IDENTICAL:${NC} $filename"
        identical_count=$((identical_count + 1))
      fi
    fi
  done

  if [ $identical_count -eq 0 ]; then
    echo "   No identical files found (components may have diverged)"
  else
    echo ""
    echo "   ${GREEN}Found $identical_count identical component(s)!${NC}"
    echo "   These are prime candidates for extraction to shared library."
  fi
else
  echo "   Billing components directory not found"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CURRENT SHARED PACKAGE USAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

platform_imports=$(grep -r "@dotmac/features" "$PLATFORM_ADMIN" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
isp_imports=$(grep -r "@dotmac/features" "$ISP_OPS" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')

echo "${YELLOW}📦 Import Count${NC}"
echo "   Platform Admin App: $platform_imports import(s)"
echo "   ISP Ops App:        $isp_imports import(s)"
echo ""

if [ "$platform_imports" -eq 0 ] && [ "$isp_imports" -eq 0 ]; then
  echo "   ${RED}⚠️  No apps are using @dotmac/features yet!${NC}"
  echo "   Start by migrating utilities (status colors, formatCurrency)"
  echo ""
  echo "   Quick start:"
  echo "   1. Add to package.json: \"@dotmac/features\": \"workspace:*\""
  echo "   2. Import shared utils: import { formatCurrency } from '@dotmac/features/billing'"
  echo "   3. Delete local duplicates"
else
  echo "   ${GREEN}✓ Apps are using shared package${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RECOMMENDED ACTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. ${GREEN}Start with utilities${NC} (easiest wins):"
echo "   - Replace status color maps with getInvoiceStatusColor()"
echo "   - Replace local formatCurrency with shared version"
echo "   - Update types to use shared Invoice interface"
echo ""

echo "2. ${YELLOW}Measure progress${NC}:"
echo "   - Track lines eliminated"
echo "   - Update PHASE2A_MIGRATION_EXAMPLE.md log"
echo ""

echo "3. ${YELLOW}Test frequently${NC}:"
echo "   - Run 'pnpm dev' after each change"
echo "   - Verify both apps still work"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "See PHASE2A_MIGRATION_EXAMPLE.md for detailed migration guide"
echo ""
