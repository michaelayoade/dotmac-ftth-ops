# GitHub Actions Workflows

This directory contains the CI/CD workflows for the DotMac Platform Services project.

## Active Workflows

### 🚀 ci.yml - Primary CI Pipeline
**Status**: ✅ Active
**Triggers**: All PRs, pushes to main
**Purpose**: Fast feedback on code quality and unit tests

**Jobs**:
- `backend-quality`: Python type checking, Pydantic validation
- `frontend-quality`: TypeScript checking, linting, security audit
- `frontend-tests`: Frontend unit tests with coverage
- `build-test`: Backend unit tests (Python 3.12/3.13 matrix)

**Typical runtime**: 15-20 minutes

---

### 🧪 e2e-tests.yml - End-to-End Tests
**Status**: ✅ Active
**Triggers**: PRs/pushes (with path filters), nightly, manual
**Purpose**: Integration testing with full stack

**Jobs**:
- `e2e-tests`: Browser testing (Playwright)
- `visual-regression`: Screenshot comparisons (PRs only)
- `performance-tests`: Performance benchmarks (main/nightly)

**Optimization**:
- PRs: Chromium only, 2 shards (~12 min)
- Main: Full browser matrix, 4 shards (~25 min)
- Nightly: Complete suite with performance tests

---

### 🗄️ check-migrations.yml - Database Migrations
**Status**: ✅ Active
**Triggers**: PRs touching migrations or models
**Purpose**: Validate Alembic migrations

**Jobs**:
- Check for multiple migration heads
- Test migrations up/down
- Verify schema integrity

**Typical runtime**: 5 minutes

---

### 🎨 visual-regression.yml - Visual Testing
**Status**: ✅ Active
**Triggers**: PRs/pushes to frontend code
**Purpose**: Detect unintended UI changes

**Jobs**:
- Screenshot comparison tests
- Baseline management

**Typical runtime**: 8 minutes

---

### 🚢 deploy.yml - Deployment Pipeline
**Status**: ✅ Active
**Triggers**: Push to main, version tags, manual
**Purpose**: Build and deploy to staging/production

**Jobs**:
- `security-scan`: Trivy vulnerability scanning
- `build-and-test`: Docker image builds
- `deploy-staging`: Auto-deploy to staging
- `deploy-production`: Manual production deployment

**Typical runtime**: 15-20 minutes

---

## Deprecated Workflows

### ⚠️ frontend-tests.yml
**Status**: 🔶 Deprecated
**Replacement**: Functionality moved to `ci.yml`

This workflow now only shows a deprecation notice. It will be removed in a future update.

### ⚠️ type-safety-validation.yml
**Status**: 🔶 Deprecated
**Replacement**: Functionality moved to `ci.yml`

Type safety checks are now part of the main CI pipeline for faster feedback.

---

## Reusable Workflows

### reusable-setup.yml
**Purpose**: Common environment setup for Python and Node.js

**Inputs**:
- `python-version`: Python version (default: 3.12)
- `node-version`: Node.js version (default: 20)
- `pnpm-version`: pnpm version (default: 8)
- `install-python`: Install Python deps (default: false)
- `install-frontend`: Install frontend deps (default: false)
- `build-frontend`: Build frontend packages (default: false)

**Example**:
```yaml
jobs:
  my-job:
    uses: ./.github/workflows/reusable-setup.yml
    with:
      install-python: true
      install-frontend: true
```

---

## Workflow Execution Flow

### On Pull Request
```
┌─────────────────────────────────────────┐
│ Developer opens/updates PR              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ ci.yml runs (always)                    │
│ • Backend quality checks                │
│ • Frontend quality checks               │
│ • Backend tests (3.12, 3.13)            │
│ • Frontend unit tests                   │
│ Time: ~20 min                           │
└─────────────────┬───────────────────────┘
                  │
                  ├─── If code changes ───┐
                  │                        │
                  ▼                        ▼
┌─────────────────────────────┐ ┌──────────────────────────┐
│ e2e-tests.yml               │ │ visual-regression.yml    │
│ • E2E tests (chromium)      │ │ • Screenshot tests       │
│ Time: ~12 min               │ │ Time: ~8 min             │
└─────────────────────────────┘ └──────────────────────────┘
                  │
                  ├─── If migrations ─────┐
                  │                        │
                  ▼                        ▼
┌─────────────────────────────────────────┐
│ check-migrations.yml                    │
│ • Migration validation                  │
│ Time: ~5 min                            │
└─────────────────────────────────────────┘
```

### On Push to Main
```
┌─────────────────────────────────────────┐
│ Code merged to main                     │
└─────────────────┬───────────────────────┘
                  │
                  ├──────┬──────┬─────────┐
                  ▼      ▼      ▼         ▼
         ┌────────┐ ┌────┐ ┌────┐  ┌──────┐
         │ ci.yml │ │E2E │ │VR  │  │Deploy│
         │        │ │Full│ │    │  │Stg.  │
         │ 20 min │ │25m │ │8m  │  │15m   │
         └────────┘ └────┘ └────┘  └──────┘
```

---

## Performance Optimizations

### Caching Strategy
All workflows use aggressive caching:
- **pip**: `~/.cache/pip` (Poetry dependencies)
- **Poetry**: `.venv` (virtualenv)
- **pnpm**: pnpm store (frontend dependencies)
- **Docker**: GitHub Actions cache

### Path Filters
Workflows only run when relevant files change:
- Backend tests: `src/**`, `tests/**`, `pyproject.toml`
- Frontend tests: `frontend/**`
- Migrations: `alembic/versions/**`, `**/models.py`

### Concurrency Control
Workflows use concurrency groups to cancel outdated runs:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Manual Workflow Execution

### Using GitHub CLI
```bash
# Run E2E tests manually
gh workflow run e2e-tests.yml

# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production
gh workflow run deploy.yml -f environment=production
```

### Using GitHub UI
1. Go to **Actions** tab
2. Select workflow from left sidebar
3. Click **Run workflow** button
4. Select branch and inputs
5. Click **Run workflow**

---

## Monitoring & Debugging

### View Workflow Results
- **GitHub Actions tab**: See all workflow runs
- **PR Checks**: View workflow status inline
- **Artifacts**: Download test reports, coverage, screenshots

### Common Issues

**Workflow not running**
- Check path filters match your changes
- Verify branch name in trigger conditions
- Check concurrency settings

**Slow workflow**
- Review caching effectiveness
- Check if dependencies need updating
- Consider splitting into parallel jobs

**Failing tests**
- Download artifacts for detailed logs
- Check for environment differences
- Verify secrets/env variables are set

---

## Cost Optimization

### Monthly GitHub Actions Usage

| Workflow | Runs/Month | Avg Time | Minutes/Month |
|----------|------------|----------|---------------|
| ci.yml | ~400 | 20 min | 8,000 |
| e2e-tests.yml | ~100 | 15 min | 1,500 |
| check-migrations.yml | ~50 | 5 min | 250 |
| visual-regression.yml | ~80 | 8 min | 640 |
| deploy.yml | ~30 | 15 min | 450 |
| **Total** | | | **~10,840** |

**Estimated cost**: ~$175/month (includes 2,000 free minutes)

### Optimizations Applied
- ✅ Eliminated duplicate E2E runs (saved ~4,000 min/month)
- ✅ Added path filters (saved ~2,000 min/month)
- ✅ Optimized caching (20% faster)
- ✅ Smart browser matrix (PRs use chromium only)

---

## Contributing

### Adding a New Workflow
1. Create `.github/workflows/my-workflow.yml`
2. Add path filters to prevent unnecessary runs
3. Use reusable workflows for common setup
4. Add caching for dependencies
5. Document in this README

### Modifying Existing Workflows
1. Test changes on a feature branch first
2. Use `workflow_dispatch` for manual testing
3. Update this README with changes
4. Monitor first few runs for issues

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Workflow Changes Guide](.github/workflows/WORKFLOW_CHANGES.md)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)

---

**Last Updated**: 2025-10-06
**Maintained by**: DevOps Team
