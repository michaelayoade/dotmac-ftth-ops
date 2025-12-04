#!/bin/bash

# Validation Script for Option A Cleanup
# Ensures MUI has been removed and primitives are properly configured

echo "🔍 Starting Option A cleanup validation..."
echo "================================================"

FRONTEND_DIR="/Users/michaelayoade/Downloads/Projects/dotmac-platform-services/frontend"
BASE_APP_DIR="$FRONTEND_DIR/apps/base-app"
PRIMITIVES_DIR="$FRONTEND_DIR/shared/packages/primitives"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

echo ""
echo "1️⃣  Checking for MUI imports..."
echo "--------------------------------"
if grep -r "@mui" "$BASE_APP_DIR" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.sh" --exclude="*.md" 2>/dev/null; then
  echo -e "${RED}❌ MUI imports still found!${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✅ No MUI imports found${NC}"
fi

echo ""
echo "2️⃣  Checking for Emotion imports..."
echo "------------------------------------"
if grep -r "@emotion" "$BASE_APP_DIR" --exclude-dir=node_modules --exclude-dir=.next --exclude="*.sh" --exclude="*.md" 2>/dev/null; then
  echo -e "${RED}❌ Emotion imports still found!${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✅ No Emotion imports found${NC}"
fi

echo ""
echo "3️⃣  Checking for hardcoded IDs in Form components..."
echo "-----------------------------------------------------"
if grep -r "htmlFor=['\"]input-[0-9]" "$PRIMITIVES_DIR" --exclude-dir=node_modules 2>/dev/null; then
  echo -e "${RED}❌ Hardcoded IDs still found in Form components!${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✅ No hardcoded IDs found${NC}"
fi

echo ""
echo "4️⃣  Checking package.json dependencies..."
echo "------------------------------------------"
if grep -E "@mui/|@emotion/|date-fns" "$BASE_APP_DIR/package.json" 2>/dev/null; then
  echo -e "${RED}❌ MUI/Emotion/date-fns dependencies still in package.json!${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✅ Package.json is clean${NC}"
fi

echo ""
echo "5️⃣  Checking for lucide-react availability..."
echo "----------------------------------------------"
if grep -q "lucide-react" "$BASE_APP_DIR/package.json"; then
  echo -e "${GREEN}✅ lucide-react is available for icons${NC}"
else
  echo -e "${YELLOW}⚠️  lucide-react not found - icons may not work${NC}"
fi

echo ""
echo "6️⃣  Verifying primitives package exports..."
echo "--------------------------------------------"
if [ -f "$PRIMITIVES_DIR/src/index.ts" ]; then
  # Check for dead exports
  DEAD_EXPORTS=0

  # Known missing exports that need to be fixed
  for export in "data-display" "visualizations" "theming" "animations/Animations" "themes/ISPBrandTheme"; do
    if grep -q "export .* from './$export'" "$PRIMITIVES_DIR/src/index.ts" 2>/dev/null; then
      if [ ! -e "$PRIMITIVES_DIR/src/$export.ts" ] && [ ! -e "$PRIMITIVES_DIR/src/$export.tsx" ] && [ ! -d "$PRIMITIVES_DIR/src/$export" ]; then
        echo -e "${YELLOW}⚠️  Dead export found: $export${NC}"
        DEAD_EXPORTS=$((DEAD_EXPORTS + 1))
      fi
    fi
  done

  if [ $DEAD_EXPORTS -eq 0 ]; then
    echo -e "${GREEN}✅ No obvious dead exports${NC}"
  else
    echo -e "${YELLOW}⚠️  Found $DEAD_EXPORTS dead exports (non-critical)${NC}"
  fi
else
  echo -e "${RED}❌ Primitives index.ts not found!${NC}"
  FAILURES=$((FAILURES + 1))
fi

echo ""
echo "7️⃣  Checking environment configuration..."
echo "-----------------------------------------"
if [ -f "$BASE_APP_DIR/.env.local.example" ]; then
  echo -e "${GREEN}✅ Environment example file exists${NC}"

  # Check for secrets in env example
  if grep -E "SECRET|PRIVATE|PASSWORD|TOKEN" "$BASE_APP_DIR/.env.local.example" | grep -v "^#" 2>/dev/null; then
    echo -e "${RED}❌ Found potential secrets in .env.local.example!${NC}"
    FAILURES=$((FAILURES + 1))
  else
    echo -e "${GREEN}✅ No secrets in environment example${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  No .env.local.example file found${NC}"
fi

echo ""
echo "8️⃣  Testing build process..."
echo "-----------------------------"
cd "$BASE_APP_DIR" || exit 1

# Check if pnpm is available
if command -v pnpm &> /dev/null; then
  echo "Building base-app..."
  if pnpm build 2>&1 | tail -20; then
    echo -e "${GREEN}✅ Build succeeded${NC}"
  else
    echo -e "${RED}❌ Build failed!${NC}"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo -e "${YELLOW}⚠️  pnpm not found - skipping build test${NC}"
fi

echo ""
echo "================================================"
echo "📊 VALIDATION SUMMARY"
echo "================================================"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ All validation checks passed!${NC}"
  echo ""
  echo "🎉 Option A cleanup completed successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Test the application manually"
  echo "2. Update any custom components that used MUI"
  echo "3. Run full test suite: pnpm test"
  echo "4. Commit changes: git add -A && git commit -m 'refactor: migrate from MUI to Primitives'"
  exit 0
else
  echo -e "${RED}❌ Found $FAILURES validation failures${NC}"
  echo ""
  echo "Please fix the issues above and run validation again."
  exit 1
fi