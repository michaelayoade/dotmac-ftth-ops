#!/bin/bash
# =============================================================================
# Frontend Repository Extraction Script
# =============================================================================
# This script extracts frontend apps into separate Git repositories
# with shared packages as Git submodules.
#
# Repository Structure:
#   - dotmac-shared-packages (shared UI, primitives, providers, etc.)
#   - dotmac-isp-customer (end customer portal)
#   - dotmac-isp-reseller (sales agent portal)
#   - dotmac-platform-tenant (ISP owner portal)
#   - dotmac-platform-reseller (channel partner portal)
#   - dotmac-isp-ops (existing ISP admin app)
#   - dotmac-platform-admin (existing platform admin app)
#
# Usage:
#   ./scripts/extract-frontend-repos.sh [output-dir]
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
OUTPUT_DIR="${1:-$PROJECT_ROOT/extracted-repos}"

# Repository names
SHARED_REPO="dotmac-shared-packages"
declare -A APP_REPOS=(
    ["isp-customer"]="dotmac-isp-customer"
    ["isp-reseller"]="dotmac-isp-reseller"
    ["platform-tenant"]="dotmac-platform-tenant"
    ["platform-reseller"]="dotmac-platform-reseller"
    ["isp-ops-app"]="dotmac-isp-ops"
    ["platform-admin-app"]="dotmac-platform-admin"
)

# Shared packages to extract
SHARED_PACKAGES=(
    "ui"
    "primitives"
    "providers"
    "rbac"
    "http-client"
    "graphql"
    "headless"
    "icons"
    "eslint-plugin"
)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create output directory
create_output_dir() {
    log_info "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
}

# Extract shared packages repository
extract_shared_packages() {
    log_info "Extracting shared packages to $SHARED_REPO..."

    local shared_dir="$OUTPUT_DIR/$SHARED_REPO"
    mkdir -p "$shared_dir/packages"

    # Copy each shared package
    for pkg in "${SHARED_PACKAGES[@]}"; do
        local src="$FRONTEND_DIR/shared/packages/$pkg"
        if [ -d "$src" ]; then
            log_info "  Copying package: $pkg"
            cp -r "$src" "$shared_dir/packages/"
        else
            log_warning "  Package not found: $pkg"
        fi
    done

    # Copy shared runtime
    if [ -d "$FRONTEND_DIR/shared/runtime" ]; then
        cp -r "$FRONTEND_DIR/shared/runtime" "$shared_dir/"
    fi

    # Copy shared types
    if [ -d "$FRONTEND_DIR/shared/types" ]; then
        cp -r "$FRONTEND_DIR/shared/types" "$shared_dir/"
    fi

    # Create root package.json for shared packages
    cat > "$shared_dir/package.json" << 'EOF'
{
  "name": "@dotmac/shared-packages",
  "version": "1.0.0",
  "private": true,
  "description": "Shared packages for DotMac frontend applications",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test --passWithNoTests",
    "type-check": "pnpm -r run type-check",
    "lint": "pnpm -r run lint",
    "clean": "pnpm -r run clean"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=9"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3"
  }
}
EOF

    # Create pnpm-workspace.yaml
    cat > "$shared_dir/pnpm-workspace.yaml" << 'EOF'
packages:
  - "packages/*"
EOF

    # Initialize git repo
    cd "$shared_dir"
    git init
    git add .
    git commit -m "Initial commit: Extract shared packages from monorepo"

    log_success "Shared packages extracted to $shared_dir"
}

# Extract individual app repository
extract_app_repo() {
    local app_name="$1"
    local repo_name="$2"

    log_info "Extracting $app_name to $repo_name..."

    local app_src="$FRONTEND_DIR/apps/$app_name"
    local app_dir="$OUTPUT_DIR/$repo_name"

    if [ ! -d "$app_src" ]; then
        log_error "App not found: $app_src"
        return 1
    fi

    mkdir -p "$app_dir"

    # Copy app files
    cp -r "$app_src"/* "$app_dir/"

    # Create .gitmodules for shared packages
    cat > "$app_dir/.gitmodules" << EOF
[submodule "shared"]
	path = shared
	url = git@github.com:dotmac/$SHARED_REPO.git
EOF

    # Update package.json to reference shared as local path
    if [ -f "$app_dir/package.json" ]; then
        # Create updated package.json with correct workspace references
        local tmp_pkg=$(mktemp)
        python3 << PYTHON > "$tmp_pkg"
import json
import sys

with open("$app_dir/package.json", "r") as f:
    pkg = json.load(f)

# Update workspace dependencies to point to shared submodule
deps = pkg.get("dependencies", {})
dev_deps = pkg.get("devDependencies", {})

workspace_deps = [
    "@dotmac/ui",
    "@dotmac/primitives",
    "@dotmac/providers",
    "@dotmac/rbac",
    "@dotmac/http-client",
    "@dotmac/graphql",
    "@dotmac/headless",
    "@dotmac/icons",
    "@dotmac/eslint-plugin"
]

for dep in workspace_deps:
    pkg_name = dep.split("/")[1]
    if dep in deps:
        deps[dep] = f"file:./shared/packages/{pkg_name}"
    if dep in dev_deps:
        dev_deps[dep] = f"file:./shared/packages/{pkg_name}"

print(json.dumps(pkg, indent=2))
PYTHON
        mv "$tmp_pkg" "$app_dir/package.json"
    fi

    # Create Dockerfile for the app
    create_dockerfile "$app_dir" "$app_name"

    # Create docker-compose.yml
    create_docker_compose "$app_dir" "$app_name"

    # Create README
    create_app_readme "$app_dir" "$app_name" "$repo_name"

    # Initialize git repo
    cd "$app_dir"
    git init

    # Create placeholder for submodule
    mkdir -p shared
    touch shared/.gitkeep

    git add .
    git commit -m "Initial commit: Extract $app_name from monorepo"

    log_success "App $app_name extracted to $app_dir"
}

# Create Dockerfile for an app
create_dockerfile() {
    local app_dir="$1"
    local app_name="$2"

    cat > "$app_dir/Dockerfile" << 'EOF'
# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy shared packages first (submodule)
COPY shared/ ./shared/

# Copy app package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Build the app
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
EOF
}

# Create docker-compose.yml for an app
create_docker_compose() {
    local app_dir="$1"
    local app_name="$2"

    # Determine port based on app name
    local port
    case "$app_name" in
        "isp-ops-app") port=3001 ;;
        "platform-admin-app") port=3002 ;;
        "platform-tenant") port=3003 ;;
        "platform-reseller") port=3004 ;;
        "isp-reseller") port=3005 ;;
        "isp-customer") port=3006 ;;
        *) port=3000 ;;
    esac

    cat > "$app_dir/docker-compose.yml" << EOF
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${port}:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=\${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
}

# Create README for an app
create_app_readme() {
    local app_dir="$1"
    local app_name="$2"
    local repo_name="$3"

    # Determine description based on app name
    local description
    local user_type
    case "$app_name" in
        "isp-customer")
            description="End customer self-service portal for ISP subscribers"
            user_type="ISP End Customers"
            ;;
        "isp-reseller")
            description="Sales agent portal for ISP resellers"
            user_type="ISP Sales Agents"
            ;;
        "platform-tenant")
            description="ISP owner portal for managing their tenant subscription"
            user_type="ISP Owners (Tenants)"
            ;;
        "platform-reseller")
            description="Channel partner portal for platform resellers"
            user_type="Channel Partners"
            ;;
        "isp-ops-app")
            description="ISP operations dashboard for managing subscribers and network"
            user_type="ISP Administrators"
            ;;
        "platform-admin-app")
            description="Platform administration portal for DotMac staff"
            user_type="Platform Administrators"
            ;;
        *)
            description="DotMac frontend application"
            user_type="Users"
            ;;
    esac

    cat > "$app_dir/README.md" << EOF
# $repo_name

$description

## User Type

**$user_type**

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Git with submodule support

### Clone with Submodules

\`\`\`bash
git clone --recurse-submodules git@github.com:dotmac/$repo_name.git
cd $repo_name
\`\`\`

Or if already cloned:

\`\`\`bash
git submodule update --init --recursive
\`\`\`

### Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### Development

\`\`\`bash
pnpm dev
\`\`\`

### Build

\`\`\`bash
pnpm build
\`\`\`

### Docker

\`\`\`bash
docker-compose up --build
\`\`\`

## Project Structure

\`\`\`
$repo_name/
├── app/                    # Next.js app router pages
├── components/             # App-specific components
├── hooks/                  # App-specific hooks
├── lib/                    # App utilities and config
│   ├── auth/              # Authentication context
│   └── config.ts          # App configuration
├── providers/              # App providers
├── shared/                 # Git submodule: @dotmac/shared-packages
│   └── packages/
│       ├── ui/            # UI components
│       ├── primitives/    # Base primitives
│       └── ...
├── Dockerfile
├── docker-compose.yml
└── package.json
\`\`\`

## Shared Packages

This app uses shared packages from the \`$SHARED_REPO\` repository as a Git submodule.

To update shared packages:

\`\`\`bash
git submodule update --remote shared
\`\`\`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| \`NEXT_PUBLIC_API_URL\` | Backend API URL | \`http://localhost:8000\` |

## License

Proprietary - DotMac Technologies
EOF
}

# Main execution
main() {
    log_info "Starting frontend repository extraction..."
    log_info "Source: $FRONTEND_DIR"
    log_info "Output: $OUTPUT_DIR"
    echo ""

    create_output_dir

    # Extract shared packages first
    extract_shared_packages
    echo ""

    # Extract each app
    for app_name in "${!APP_REPOS[@]}"; do
        extract_app_repo "$app_name" "${APP_REPOS[$app_name]}"
        echo ""
    done

    log_success "Repository extraction complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. Create GitHub repositories for each extracted repo"
    echo "  2. Push $SHARED_REPO first"
    echo "  3. Update .gitmodules in each app to point to actual GitHub URL"
    echo "  4. Initialize submodules: git submodule add <shared-repo-url> shared"
    echo "  5. Push each app repository"
    echo ""
    log_info "Extracted repositories:"
    ls -la "$OUTPUT_DIR"
}

main "$@"
