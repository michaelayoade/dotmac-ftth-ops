# Parallel Development with Git Worktrees & Multiple Claude Instances

## Overview

This guide explains how to use git worktrees to enable multiple Claude Code instances (or developers) to work on different features simultaneously without conflicts.

## 🎯 Benefits

- **Zero Conflicts**: Each instance works in complete isolation
- **Fast Switching**: No need to stash/commit when switching features
- **Independent Builds**: Each worktree has its own `.next` cache
- **Parallel Testing**: Test multiple features simultaneously
- **Easy Cleanup**: Remove worktrees without affecting main repo

---

## 🏗️ Architecture

```
dotmac-ftth-ops/                     # Main repository (base)
├── frontend/
├── src/
└── ...

../dotmac-worktrees/                 # Worktrees directory
├── genieacs/                        # Feature 1: GenieACS
│   ├── frontend/
│   │   └── apps/base-app/
│   ├── src/
│   └── ...
├── diagnostics/                     # Feature 2: Diagnostics
│   ├── frontend/
│   └── ...
├── billing/                         # Feature 3: Billing
│   ├── frontend/
│   └── ...
└── [13 more feature worktrees...]
```

Each worktree is a **complete copy** of the repository on a different branch.

---

## 🚀 Quick Start

### 1. Run Setup Script

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
chmod +x scripts/setup-worktrees.sh
./scripts/setup-worktrees.sh
```

This creates 16 worktrees for all planned features.

### 2. Navigate to a Worktree

```bash
cd ../dotmac-worktrees/genieacs
cd frontend/apps/base-app
```

### 3. Install Dependencies (First Time Only)

```bash
pnpm install
```

### 4. Start Development

Open Claude Code in this worktree:
```bash
# From the worktree directory
code .
```

Each Claude instance works in its own worktree!

---

## 📋 Available Worktrees

### Phase 1 - Critical Infrastructure (5 worktrees)

| Worktree | Branch | Feature | Pages |
|----------|--------|---------|-------|
| `genieacs` | `feature/genieacs-tr069-management` | TR-069 CPE Management | 6-8 |
| `diagnostics` | `feature/diagnostics-system` | Network Diagnostics | 3-4 |
| `voltha` | `feature/voltha-gpon-management` | GPON/OLT Management | 6-8 |
| `ansible` | `feature/ansible-automation` | Network Automation | 8-10 |
| `data-import` | `feature/data-import-export` | Bulk Data Operations | 4-5 |

### Phase 2 - Network Operations (3 worktrees)

| Worktree | Branch | Feature | Pages |
|----------|--------|---------|-------|
| `netbox` | `feature/netbox-dcim-ipam` | DCIM/IPAM Enhancement | 10-12 |
| `faults` | `feature/fault-management-enhanced` | Fault Management | 4-5 |
| `deployment` | `feature/deployment-management` | Deployment Orchestration | 4-5 |

### Phase 3 - Business Operations (3 worktrees)

| Worktree | Branch | Feature | Pages |
|----------|--------|---------|-------|
| `billing` | `feature/billing-enhancements` | Billing Sub-Modules | 18-22 |
| `ticketing` | `feature/ticketing-system` | Ticketing Enhancement | 5-6 |
| `crm` | `feature/crm-enhancements` | CRM Advanced Features | 6-8 |

### Phase 4 - Advanced Features (4 worktrees)

| Worktree | Branch | Feature | Pages |
|----------|--------|---------|-------|
| `workflows` | `feature/workflows-system` | Workflow Builder | 8-10 |
| `data-transfer` | `feature/data-transfer-service` | File Transfer | 3-4 |
| `config` | `feature/config-management` | Config Management | 2-3 |
| `rate-limits` | `feature/rate-limiting` | Rate Limiting | 2-3 |

---

## 🔄 Workflow Examples

### Scenario 1: Multiple Claude Instances

**Claude Instance 1** (Terminal 1):
```bash
cd ../dotmac-worktrees/genieacs
cd frontend/apps/base-app
# Work on GenieACS feature
```

**Claude Instance 2** (Terminal 2):
```bash
cd ../dotmac-worktrees/diagnostics
cd frontend/apps/base-app
# Work on Diagnostics feature
```

**Claude Instance 3** (Terminal 3):
```bash
cd ../dotmac-worktrees/billing
cd frontend/apps/base-app
# Work on Billing enhancements
```

All three work **simultaneously** without any conflicts!

---

### Scenario 2: Development Cycle

```bash
# 1. Start in a worktree
cd ../dotmac-worktrees/genieacs
cd frontend/apps/base-app

# 2. Develop features
# Create pages, components, etc.

# 3. Test build
pnpm build

# 4. Commit changes
cd ../..  # Back to worktree root
git add frontend/
git commit -m "feat(genieacs): implement TR-069 device management

- Add device list page
- Add device details page
- Add parameter configuration
- Add firmware management"

# 5. Push branch
git push origin feature/genieacs-tr069-management

# 6. Create PR (via GitHub UI or gh cli)
gh pr create --title "GenieACS TR-069 Management" --base feature/bss-phase1-isp-enhancements
```

---

## 🔧 Advanced Operations

### Check Worktree Status

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
git worktree list
```

### Add a New Worktree Manually

```bash
git worktree add ../dotmac-worktrees/new-feature feature/new-feature-name
```

### Remove a Worktree

```bash
# Option 1: Using git worktree command
git worktree remove ../dotmac-worktrees/genieacs

# Option 2: Manual cleanup
rm -rf ../dotmac-worktrees/genieacs
git worktree prune
```

### Delete Feature Branch

```bash
# After merging PR
git branch -d feature/genieacs-tr069-management

# Force delete if not merged
git branch -D feature/genieacs-tr069-management
```

### Sync Worktree with Base Branch

```bash
cd ../dotmac-worktrees/genieacs
git fetch origin
git merge origin/feature/bss-phase1-isp-enhancements
```

---

## 📝 Task Assignment Strategy

### Option A: Assign by Phase

- **Claude 1**: All of Phase 1 (Critical Infrastructure)
- **Claude 2**: All of Phase 2 (Network Operations)
- **Claude 3**: All of Phase 3 (Business Operations)

### Option B: Assign by Priority

- **Claude 1**: High-priority features (GenieACS, Diagnostics, VOLTHA)
- **Claude 2**: Medium-priority features (Billing, Ticketing)
- **Claude 3**: Quick wins (Config, Rate Limits)

### Option C: Assign by Domain

- **Claude 1**: Network features (GenieACS, VOLTHA, Ansible, NetBox)
- **Claude 2**: Business features (Billing, CRM, Ticketing)
- **Claude 3**: Infrastructure features (Deployment, Workflows, Config)

---

## ⚠️ Important Considerations

### 1. Shared Files
If multiple worktrees modify the same file, you'll need to merge carefully:
- **Solution**: Assign features that touch different files
- **Example**: GenieACS (devices pages) vs Billing (billing pages) = no overlap

### 2. Shared Components
If you create shared components, coordinate between instances:
- **Solution**: Create shared components in base repo first
- **Then**: Use them in worktrees

### 3. Node Modules
Each worktree needs its own `node_modules`:
```bash
cd ../dotmac-worktrees/genieacs/frontend/apps/base-app
pnpm install
```

### 4. Database Migrations
Backend migrations should be coordinated:
- **Solution**: Run migrations in base repo
- **Then**: Pull into worktrees

---

## 🎯 Recommended Workflow for Multiple Claudes

### Setup Phase (5 minutes)
```bash
# Run once
./scripts/setup-worktrees.sh
```

### Assignment Phase (2 minutes per Claude)

**Claude 1 Instructions:**
```
Please work on GenieACS feature in:
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/genieacs

Implement:
- Device list page
- Device details page
- Parameter configuration
- Firmware management
```

**Claude 2 Instructions:**
```
Please work on Diagnostics feature in:
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/diagnostics

Implement:
- Diagnostics dashboard
- Network tests page
- Speed tests page
- History page
```

**Claude 3 Instructions:**
```
Please work on Billing enhancements in:
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/billing

Implement:
- Credit notes pages
- Dunning pages
- Payment methods pages
```

### Development Phase (Parallel)
Each Claude works independently in its worktree.

### Integration Phase
```bash
# Each feature PR is created separately
# Merge them one by one after review
```

---

## 📊 Tracking Progress

Create a tracking file:

```bash
# In base repo
touch FEATURE_PROGRESS.md
```

Update with status:
```markdown
# Feature Implementation Progress

## Phase 1 - Critical Infrastructure
- [x] GenieACS - @claude1 - feature/genieacs-tr069-management - PR #123
- [x] Diagnostics - @claude2 - feature/diagnostics-system - PR #124
- [ ] VOLTHA - @claude3 - In Progress
- [ ] Ansible - Pending
- [ ] Data Import - Pending

## Phase 2 - Network Operations
- [ ] NetBox - Pending
...
```

---

## 🐛 Troubleshooting

### Issue: "fatal: invalid reference"
**Solution:**
```bash
git fetch --all
git branch [branch-name] origin/feature/bss-phase1-isp-enhancements
```

### Issue: "worktree already locked"
**Solution:**
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
git worktree unlock ../dotmac-worktrees/[worktree-name]
```

### Issue: Build fails in worktree
**Solution:**
```bash
cd ../dotmac-worktrees/[worktree-name]/frontend/apps/base-app
rm -rf .next node_modules
pnpm install
pnpm build
```

### Issue: Out of sync with base branch
**Solution:**
```bash
cd ../dotmac-worktrees/[worktree-name]
git fetch origin
git merge origin/feature/bss-phase1-isp-enhancements
```

---

## 🎉 Benefits Summary

| Benefit | Traditional | With Worktrees |
|---------|------------|----------------|
| **Switch Features** | git stash, checkout | cd ../worktree |
| **Parallel Work** | Impossible | ✅ Multiple Claudes |
| **Build Cache** | Cleared on switch | Independent |
| **Conflicts** | Constant | Zero |
| **Testing** | One at a time | All simultaneously |

---

## 📚 Additional Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- [Backend Features Analysis](./docs/BACKEND_FEATURES.md)

---

## 💡 Pro Tips

1. **Name worktrees after features** (not developers) for clarity
2. **Use consistent branch naming**: `feature/[module-name]`
3. **Keep worktrees short-lived**: Merge and delete after feature complete
4. **Run builds in each worktree** before creating PR
5. **Coordinate shared components** in base repo first

---

## 🚦 Next Steps

1. Run setup script: `./scripts/setup-worktrees.sh`
2. Assign features to Claude instances
3. Start parallel development!
4. Create PRs as features complete
5. Merge and clean up

Happy parallel coding! 🎉
