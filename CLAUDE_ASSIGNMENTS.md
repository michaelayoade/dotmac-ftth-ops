# Multiple Claude Instance Assignment Guide

## 🎯 Quick Start

Run this command once to set up all worktrees:
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
./scripts/setup-worktrees.sh
```

---

## 📝 Assignment Templates

Copy and paste these instructions to each Claude Code instance:

---

### 🤖 Claude Instance #1 - GenieACS (TR-069 Management)

**Working Directory:**
```
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/genieacs/frontend/apps/base-app
```

**Task:**
Implement GenieACS TR-069 CPE/ONT device management system.

**Pages to Create:**
1. `app/dashboard/devices/page.tsx` - Device list with search/filter
2. `app/dashboard/devices/[deviceId]/page.tsx` - Device details
3. `app/dashboard/devices/[deviceId]/parameters/page.tsx` - TR-069 parameters
4. `app/dashboard/devices/[deviceId]/diagnostics/page.tsx` - Remote diagnostics
5. `app/dashboard/devices/[deviceId]/firmware/page.tsx` - Firmware management
6. `app/dashboard/devices/provision/page.tsx` - Bulk provisioning
7. `app/dashboard/devices/presets/page.tsx` - Configuration presets

**Backend API:**
- Base URL: `/api/v1/genieacs/`
- Router: `src/dotmac/platform/genieacs/router.py`

**Key Features:**
- Device inventory with real-time status
- TR-069 parameter management
- Remote diagnostics (ping, traceroute, speed test)
- Firmware upgrade orchestration
- Configuration templates
- Bulk operations

**Acceptance Criteria:**
- All pages build without errors
- API integration complete
- Real-time device status updates
- Search and filtering work
- Responsive design

---

### 🤖 Claude Instance #2 - Diagnostics System

**Working Directory:**
```
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/diagnostics/frontend/apps/base-app
```

**Task:**
Implement network diagnostics and troubleshooting tools.

**Pages to Create:**
1. `app/dashboard/diagnostics/page.tsx` - Diagnostics dashboard
2. `app/dashboard/diagnostics/network-tests/page.tsx` - Ping, traceroute, MTR
3. `app/dashboard/diagnostics/speed-tests/page.tsx` - Bandwidth testing
4. `app/dashboard/diagnostics/history/page.tsx` - Test history & reports

**Backend API:**
- Base URL: `/api/v1/diagnostics/`
- Router: `src/dotmac/platform/diagnostics/router.py`

**Key Features:**
- Network connectivity tests (ping, traceroute, MTR, DNS)
- Speed test execution with real-time progress
- Test history with export
- Scheduled automated tests
- Visual test results (graphs/charts)

**Acceptance Criteria:**
- All diagnostic tools functional
- Real-time test progress display
- Test history searchable
- Export results to PDF/CSV
- Build succeeds

---

### 🤖 Claude Instance #3 - VOLTHA (GPON Management)

**Working Directory:**
```
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/voltha/frontend/apps/base-app
```

**Task:**
Implement VOLTHA-based GPON/OLT management for FTTH operations.

**Pages to Create:**
1. `app/dashboard/gpon/page.tsx` - GPON dashboard
2. `app/dashboard/gpon/olts/page.tsx` - OLT device list
3. `app/dashboard/gpon/olts/[oltId]/page.tsx` - OLT details
4. `app/dashboard/gpon/olts/[oltId]/pons/page.tsx` - PON ports
5. `app/dashboard/gpon/onus/page.tsx` - ONU/ONT list
6. `app/dashboard/gpon/onus/[onuId]/page.tsx` - ONU details
7. `app/dashboard/gpon/onus/provision/page.tsx` - ONU provisioning
8. `app/dashboard/gpon/analytics/page.tsx` - PON analytics

**Backend API:**
- Base URL: `/api/v1/voltha/`
- Router: `src/dotmac/platform/voltha/router.py`
- Existing tenant page: `/tenant/voltha` (may use as reference)

**Key Features:**
- OLT device management
- PON port monitoring with status
- ONU discovery and provisioning
- Optical signal levels (RX/TX power)
- PON topology visualization
- Alarm management
- Performance metrics dashboard

**Acceptance Criteria:**
- GPON topology visualized
- ONU provisioning workflow complete
- Signal level monitoring active
- Alarms displayed properly
- Build succeeds

---

### 🤖 Claude Instance #4 - Billing Enhancements

**Working Directory:**
```
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/billing/frontend/apps/base-app
```

**Task:**
Implement comprehensive billing sub-modules.

**Pages to Create:**

**Credit Notes (2 pages):**
1. `app/dashboard/billing/credit-notes/page.tsx`
2. `app/dashboard/billing/credit-notes/[id]/page.tsx`

**Dunning (4 pages):**
3. `app/dashboard/billing/dunning/page.tsx`
4. `app/dashboard/billing/dunning/rules/page.tsx`
5. `app/dashboard/billing/dunning/campaigns/page.tsx`
6. `app/dashboard/billing/dunning/history/page.tsx`

**Payment Methods (3 pages):**
7. `app/dashboard/billing/payment-methods/page.tsx`
8. `app/dashboard/billing/payment-methods/[id]/page.tsx`
9. `app/dashboard/billing/payment-methods/types/page.tsx`

**Pricing (5 pages):**
10. `app/dashboard/billing/pricing/page.tsx`
11. `app/dashboard/billing/pricing/tiers/page.tsx`
12. `app/dashboard/billing/pricing/rules/page.tsx`
13. `app/dashboard/billing/pricing/promotions/page.tsx`
14. `app/dashboard/billing/pricing/simulator/page.tsx`

**Receipts (2 pages):**
15. `app/dashboard/billing/receipts/page.tsx`
16. `app/dashboard/billing/receipts/[id]/page.tsx`

**Reconciliation (4 pages):**
17. `app/dashboard/billing/reconciliation/page.tsx`
18. `app/dashboard/billing/reconciliation/matches/page.tsx`
19. `app/dashboard/billing/reconciliation/disputes/page.tsx`
20. `app/dashboard/billing/reconciliation/reports/page.tsx`

**Backend APIs:**
- Multiple routers in `src/dotmac/platform/billing/*/router.py`
- Existing tenant pages in `/tenant/billing/*` (for reference)

**Acceptance Criteria:**
- All CRUD operations functional
- Dunning rules engine working
- Price simulator accurate
- Reconciliation auto-match working
- Build succeeds

---

### 🤖 Claude Instance #5 - Ansible Automation

**Working Directory:**
```
/Users/michaelayoade/Downloads/Projects/dotmac-worktrees/ansible/frontend/apps/base-app
```

**Task:**
Implement Ansible-based network automation and orchestration.

**Pages to Create:**

**Playbooks:**
1. `app/dashboard/automation/playbooks/page.tsx`
2. `app/dashboard/automation/playbooks/[id]/page.tsx`
3. `app/dashboard/automation/playbooks/new/page.tsx`
4. `app/dashboard/automation/playbooks/[id]/run/page.tsx`

**Inventory:**
5. `app/dashboard/automation/inventory/page.tsx`
6. `app/dashboard/automation/inventory/hosts/page.tsx`

**Jobs:**
7. `app/dashboard/automation/jobs/page.tsx`
8. `app/dashboard/automation/jobs/[jobId]/page.tsx`

**Templates:**
9. `app/dashboard/automation/templates/page.tsx`

**Backend API:**
- Base URLs: `/api/v1/ansible/`, `/api/v1/ansible/management/`
- Routers: `src/dotmac/platform/ansible/router.py`, `router_management.py`

**Key Features:**
- Playbook management (CRUD)
- Inventory management (hosts, groups)
- Job execution with real-time output
- Scheduled automation
- Template library
- Credential management

**Acceptance Criteria:**
- Playbook execution works
- Real-time output streaming
- Inventory management complete
- Template library functional
- Build succeeds

---

## 🔄 Workflow

### For Each Claude Instance:

1. **Navigate to worktree:**
   ```bash
   cd /Users/michaelayoade/Downloads/Projects/dotmac-worktrees/[feature-name]
   cd frontend/apps/base-app
   ```

2. **Install dependencies (first time only):**
   ```bash
   pnpm install
   ```

3. **Develop features:**
   - Create pages as specified
   - Integrate with backend APIs
   - Test functionality

4. **Test build:**
   ```bash
   pnpm build
   ```

5. **Commit and push:**
   ```bash
   cd ../..  # Back to worktree root
   git add .
   git commit -m "feat([module]): implement [feature description]"
   git push origin [branch-name]
   ```

6. **Create PR:**
   ```bash
   gh pr create --title "[Feature Name]" --base feature/bss-phase1-isp-enhancements
   ```

---

## 📊 Progress Tracking

Update this table as work progresses:

| Claude | Feature | Branch | Status | PR |
|--------|---------|--------|--------|-----|
| #1 | GenieACS | `feature/genieacs-tr069-management` | 🔄 In Progress | - |
| #2 | Diagnostics | `feature/diagnostics-system` | 🔄 In Progress | - |
| #3 | VOLTHA | `feature/voltha-gpon-management` | 🔄 In Progress | - |
| #4 | Billing | `feature/billing-enhancements` | 🔄 In Progress | - |
| #5 | Ansible | `feature/ansible-automation` | 🔄 In Progress | - |

Status Legend:
- 📋 Not Started
- 🔄 In Progress
- ✅ Complete
- 🔍 In Review
- ✔️ Merged

---

## 🚨 Important Notes

### Avoid Conflicts:
- Each Claude works on **completely different pages**
- No shared file modifications
- All features are isolated

### Shared Components:
If you need a shared component (e.g., a special table), create it in the **main repo** first:
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
# Create shared component
git add .
git commit -m "feat(shared): add [component]"
git push
```

Then pull into worktrees:
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-worktrees/[feature]
git pull origin feature/bss-phase1-isp-enhancements
```

### Communication:
Use a shared document or chat to coordinate:
- Shared component needs
- API endpoint questions
- Design pattern decisions

---

## 🎉 Expected Timeline

With 5 Claude instances working in parallel:

| Week | Milestone |
|------|-----------|
| Week 1 | Setup complete, 5 features started |
| Week 2 | GenieACS & Diagnostics complete |
| Week 3 | VOLTHA complete |
| Week 4 | Billing & Ansible complete |
| Week 5 | Integration & testing |
| Week 6 | Bug fixes & polish |

**Total Duration:** ~6 weeks for Phase 1 (vs 12-16 weeks sequential)

---

## 🔧 Helper Commands

### Check all worktrees:
```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
git worktree list
```

### See branch status for all worktrees:
```bash
for dir in ../dotmac-worktrees/*/; do
  echo "=== $(basename $dir) ==="
  cd "$dir" && git status -sb
  cd - > /dev/null
done
```

### Build all worktrees:
```bash
for dir in ../dotmac-worktrees/*/frontend/apps/base-app/; do
  echo "=== Building $(basename $(dirname $(dirname $(dirname $dir)))) ==="
  cd "$dir" && pnpm build
  cd - > /dev/null
done
```

---

## 📞 Need Help?

- **Git worktree issues**: See `PARALLEL_DEVELOPMENT.md`
- **API questions**: Check `src/dotmac/platform/[module]/router.py`
- **Design patterns**: Review existing pages in `app/dashboard/`
- **Build errors**: Run `pnpm install && rm -rf .next && pnpm build`

Happy parallel coding! 🚀
