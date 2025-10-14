#!/bin/bash
# Update Local Repository After GitHub Rename
# Run this AFTER you've renamed the repository on GitHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Repository Rename - Local Update${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}Error: Not in a git repository!${NC}"
    echo "Please run this script from the repository root."
    exit 1
fi

# Get current remote URL
CURRENT_URL=$(git remote get-url origin)
echo -e "${YELLOW}Current origin URL:${NC} $CURRENT_URL"
echo ""

# Check if already updated
if echo "$CURRENT_URL" | grep -q "dotmac-isp-ops"; then
    echo -e "${GREEN}✓ Remote URL already updated to dotmac-isp-ops${NC}"
else
    echo -e "${YELLOW}Updating remote URL...${NC}"

    # New URL
    NEW_URL="https://github.com/michaelayoade/dotmac-isp-ops.git"

    # Update origin remote
    git remote set-url origin "$NEW_URL"

    echo -e "${GREEN}✓ Remote URL updated${NC}"
fi

echo ""
echo -e "${BLUE}Current remotes:${NC}"
git remote -v
echo ""

# Test connectivity
echo -e "${YELLOW}Testing connection to new repository...${NC}"
if git ls-remote origin HEAD &>/dev/null; then
    echo -e "${GREEN}✓ Successfully connected to new repository!${NC}"
else
    echo -e "${RED}✗ Could not connect to repository${NC}"
    echo -e "${YELLOW}This might mean:${NC}"
    echo "  1. You haven't renamed the repository on GitHub yet"
    echo "  2. GitHub is still propagating the change (wait a few minutes)"
    echo "  3. There's a network issue"
    echo ""
    echo "Please rename the repository on GitHub first:"
    echo "https://github.com/michaelayoade/dotmac-ftth-ops/settings"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Local Update Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. (Optional) Rename your local folder:"
echo "   cd .."
echo "   mv dotmac-ftth-ops dotmac-isp-ops"
echo "   cd dotmac-isp-ops"
echo ""
echo "2. Continue working:"
echo "   git fetch origin"
echo "   git pull origin main"
echo ""
echo -e "${GREEN}Your local repository is now pointing to:${NC}"
echo "https://github.com/michaelayoade/dotmac-isp-ops"
