#!/bin/bash
# Setup script for split repositories
# Run from repo root: ./scripts/setup-split-repos.sh

set -e

STAGING_DIR="split-staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=============================================="
echo "DotMac Split Repository Setup"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}python3 required but not found${NC}"; exit 1; }
echo -e "${GREEN}✓ python3 found${NC}"

# Optional: Check for pnpm (for frontend builds)
if command -v pnpm >/dev/null 2>&1; then
    echo -e "${GREEN}✓ pnpm found (frontend builds available)${NC}"
    HAS_PNPM=1
else
    echo -e "${YELLOW}⚠ pnpm not found (frontend builds skipped)${NC}"
    HAS_PNPM=0
fi

# Setup function for Python packages
setup_python_package() {
    local pkg_name=$1
    local pkg_dir="$STAGING_DIR/$pkg_name"

    echo -e "\n${YELLOW}Setting up $pkg_name...${NC}"

    if [ ! -d "$pkg_dir" ]; then
        echo -e "${RED}✗ Directory not found: $pkg_dir${NC}"
        return 1
    fi

    cd "$pkg_dir"

    # Create venv if not exists
    if [ ! -d ".venv" ]; then
        echo "  Creating virtual environment..."
        python3 -m venv .venv
    fi

    # Activate and install
    source .venv/bin/activate

    echo "  Installing package..."
    pip install -q --upgrade pip
    pip install -q -e . 2>/dev/null || pip install -q -e ".[dev]" 2>/dev/null || true

    # Run tests if pytest is available
    if pip show pytest >/dev/null 2>&1; then
        echo "  Running tests..."
        if pytest --tb=short -q 2>/dev/null; then
            echo -e "${GREEN}  ✓ Tests passed${NC}"
        else
            echo -e "${YELLOW}  ⚠ Some tests failed (check manually)${NC}"
        fi
    fi

    deactivate
    cd "$PROJECT_ROOT"

    echo -e "${GREEN}✓ $pkg_name setup complete${NC}"
}

# Setup extracted packages (schema libraries)
echo -e "\n${YELLOW}=== Setting up extracted schema packages ===${NC}"
for pkg in dotmac-core dotmac-db dotmac-plugins dotmac-auth dotmac-events \
           dotmac-billing dotmac-notifications dotmac-filestorage dotmac-search \
           dotmac-ticketing dotmac-crm dotmac-sales; do
    if [ -d "$STAGING_DIR/$pkg" ]; then
        setup_python_package "$pkg"
    fi
done

# Setup main applications
echo -e "\n${YELLOW}=== Setting up main applications ===${NC}"
for pkg in dotmac-shared dotmac-platform dotmac-isp; do
    if [ -d "$STAGING_DIR/$pkg" ]; then
        setup_python_package "$pkg"
    fi
done

# Run alembic for platform (if applicable)
if [ -d "$STAGING_DIR/dotmac-platform/alembic" ]; then
    echo -e "\n${YELLOW}Checking database migrations...${NC}"
    cd "$STAGING_DIR/dotmac-platform"
    source .venv/bin/activate

    if command -v alembic >/dev/null 2>&1 || pip show alembic >/dev/null 2>&1; then
        echo "  Alembic available - run 'alembic upgrade head' when database is ready"
        echo "  Set WORKFLOW_DEFAULT_TENANT_ID for tenant backfill if needed"
    fi

    deactivate
    cd "$PROJECT_ROOT"
fi

# Frontend setup (if pnpm available)
if [ "$HAS_PNPM" = "1" ]; then
    echo -e "\n${YELLOW}=== Setting up frontend packages ===${NC}"

    # Shared frontend packages
    if [ -d "$STAGING_DIR/dotmac-shared/frontend" ]; then
        echo "Setting up shared frontend packages..."
        cd "$STAGING_DIR/dotmac-shared/frontend"
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
        pnpm build 2>/dev/null || echo -e "${YELLOW}⚠ Shared frontend build needs review${NC}"
        cd "$PROJECT_ROOT"
    fi

    # Platform admin app
    if [ -d "$STAGING_DIR/dotmac-platform/frontend/apps/platform-admin-app" ]; then
        echo "Setting up platform-admin-app..."
        cd "$STAGING_DIR/dotmac-platform/frontend/apps/platform-admin-app"
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
        pnpm build 2>/dev/null || echo -e "${YELLOW}⚠ Platform admin build needs review${NC}"
        cd "$PROJECT_ROOT"
    fi

    # ISP ops app
    if [ -d "$STAGING_DIR/dotmac-isp/frontend/apps/isp-ops-app" ]; then
        echo "Setting up isp-ops-app..."
        cd "$STAGING_DIR/dotmac-isp/frontend/apps/isp-ops-app"
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
        pnpm build 2>/dev/null || echo -e "${YELLOW}⚠ ISP ops build needs review${NC}"
        cd "$PROJECT_ROOT"
    fi
fi

echo -e "\n${GREEN}=============================================="
echo "Setup Complete!"
echo "==============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Initialize git repos: cd split-staging/<repo> && git init"
echo "2. Add remotes: git remote add origin <new-repo-url>"
echo "3. Commit: git add . && git commit -m 'Initial split import'"
echo "4. Push: git push -u origin main"
echo ""
echo "For database migrations:"
echo "  cd split-staging/dotmac-platform"
echo "  source .venv/bin/activate"
echo "  export WORKFLOW_DEFAULT_TENANT_ID=<your-tenant>  # optional"
echo "  alembic upgrade head"
