#!/bin/bash
# Git Worktree Setup for Parallel Development
# This script creates isolated worktrees for multiple developers

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_BASE="../dotmac-worktrees"
BASE_BRANCH="feature/bss-phase1-isp-enhancements"

echo "🌳 Setting up Git Worktrees for Parallel Development"
echo "=================================================="
echo ""

cd "$PROJECT_ROOT"

# Ensure we're on the base branch and up to date
echo "📌 Current branch: $(git branch --show-current)"
echo ""

# Define feature worktrees based on implementation plan
declare -A WORKTREES=(
    # Phase 1 - Critical Infrastructure
    ["genieacs"]="feature/genieacs-tr069-management"
    ["diagnostics"]="feature/diagnostics-system"
    ["voltha"]="feature/voltha-gpon-management"
    ["ansible"]="feature/ansible-automation"
    ["data-import"]="feature/data-import-export"

    # Phase 2 - Network Operations
    ["netbox"]="feature/netbox-dcim-ipam"
    ["faults"]="feature/fault-management-enhanced"
    ["deployment"]="feature/deployment-management"

    # Phase 3 - Business Operations
    ["billing"]="feature/billing-enhancements"
    ["ticketing"]="feature/ticketing-system"
    ["crm"]="feature/crm-enhancements"

    # Phase 4 - Advanced Features
    ["workflows"]="feature/workflows-system"
    ["data-transfer"]="feature/data-transfer-service"
    ["config"]="feature/config-management"
)

# Create worktrees
echo "🔨 Creating worktrees..."
echo ""

for name in "${!WORKTREES[@]}"; do
    branch="${WORKTREES[$name]}"
    worktree_path="$WORKTREE_BASE/$name"

    echo "Creating worktree: $name"
    echo "  Branch: $branch"
    echo "  Path: $worktree_path"

    # Create branch if it doesn't exist
    if ! git show-ref --verify --quiet "refs/heads/$branch"; then
        git branch "$branch" "$BASE_BRANCH"
        echo "  ✓ Created branch $branch"
    else
        echo "  ✓ Branch $branch already exists"
    fi

    # Create worktree if it doesn't exist
    if [ ! -d "$worktree_path" ]; then
        git worktree add "$worktree_path" "$branch"
        echo "  ✓ Created worktree at $worktree_path"
    else
        echo "  ⚠ Worktree already exists at $worktree_path"
    fi

    echo ""
done

echo "✅ Worktree setup complete!"
echo ""
echo "📋 Summary:"
git worktree list
echo ""

echo "🚀 Usage Instructions:"
echo "===================="
echo ""
echo "To work on a feature, navigate to its worktree:"
echo "  cd $WORKTREE_BASE/genieacs"
echo "  cd frontend/apps/isp-ops-app"
echo ""
echo "Each worktree is an isolated workspace with its own:"
echo "  • Separate working directory"
echo "  • Independent branch"
echo "  • Own node_modules (after npm install)"
echo "  • Own .next build cache"
echo ""
echo "Multiple developers can work simultaneously!"
echo ""

echo "🔧 To start development in a worktree:"
echo "  1. cd $WORKTREE_BASE/[feature-name]"
echo "  2. cd frontend/apps/isp-ops-app"
echo "  3. pnpm install (if first time)"
echo "  4. Start coding!"
echo ""

echo "🔄 To merge back to main branch:"
echo "  1. cd [worktree]"
echo "  2. git add . && git commit -m 'Implement feature'"
echo "  3. git push origin [branch-name]"
echo "  4. Create PR via GitHub"
echo ""

echo "🗑️  To remove a worktree when done:"
echo "  git worktree remove $WORKTREE_BASE/[feature-name]"
echo "  git branch -d [branch-name]"
echo ""
