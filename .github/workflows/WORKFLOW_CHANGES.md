# CI/CD Workflow Harmonization

## Summary of Changes

This document outlines the consolidation and optimization of GitHub Actions workflows to eliminate redundancy, reduce CI time, and lower costs.

## Before: 7 Workflows with Significant Overlap

| Workflow | Purpose | Issues |
|----------|---------|--------|
| `ci.yml` | Backend tests | ✅ Core backend testing |
| `frontend-tests.yml` | Frontend unit/E2E | 🔄 **Duplicates E2E tests** |
| `e2e-tests.yml` | E2E tests | 🔄 **Duplicates E2E tests** |
| `type-safety-validation.yml` | Type checking | 🔄 **Overlaps with ci.yml** |
| `visual-regression.yml` | Visual tests | ✅ Standalone |
| `check-migrations.yml` | DB migrations | ✅ Standalone |
| `deploy.yml` | Deployment | ✅ Standalone |

### Key Problems
- **E2E tests ran twice** (frontend-tests.yml + e2e-tests.yml)
- **Type safety checks scattered** across 2 workflows
- **Dependencies installed 4+ times** per PR
- **~45-60 min CI time** per PR
- **High GitHub Actions costs** (~8,000 min/month)

## After: 4 Streamlined Workflows

### 1. **ci.yml** - Primary CI Pipeline
**Purpose**: Fast feedback on code quality, unit tests, and type safety

**Jobs**:
- `backend-quality`: Linting, mypy, Pydantic validation
- `frontend-quality`: ESLint, TypeScript type checking, security audit
- `frontend-tests`: Frontend unit tests with coverage
- `build-test`: Backend unit tests (Python 3.12/3.13 matrix)

**Triggers**: All PRs, pushes to main
**Path filters**:
- `src/**`, `tests/**`, `frontend/**`
- `pyproject.toml`, `poetry.lock`

**Expected time**: ~15-20 min

---

### 2. **e2e-tests.yml** - Integration Testing
**Purpose**: End-to-end and visual regression tests

**Jobs**:
- `e2e-tests`: Full browser matrix (chromium/firefox/webkit)
- `visual-regression`: Screenshot comparisons
- `performance-tests`: Performance benchmarks (main/nightly only)

**Optimization**:
- **PRs**: Chromium only, 2 shards
- **Main branch**: Full browser matrix, 4 shards
- **Nightly**: Full suite with performance tests

**Path filters**: Added to prevent unnecessary runs
**Expected time**:
- PR: ~10-15 min
- Main: ~20-30 min

---

### 3. **check-migrations.yml** - Database Migrations
**Purpose**: Validate Alembic migrations

**Jobs**:
- Migration head checks
- Schema validation
- Up/down migration testing

**Triggers**: Only when migration files change
**Path filters**:
- `alembic/versions/**`
- `src/**/models.py`

**Expected time**: ~5 min

---

### 4. **deploy.yml** - Deployment Pipeline
**Purpose**: Build and deploy to staging/production

**Jobs**:
- Security scanning (Trivy)
- Docker image builds
- Staging deployment
- Production deployment (with rollback)

**No changes** - already optimized

---

### Deprecated Workflows

These workflows show deprecation notices and will be removed:

- ❌ **frontend-tests.yml**: Functionality moved to `ci.yml`
- ❌ **type-safety-validation.yml**: Functionality moved to `ci.yml`

---

## Impact Analysis

### Time Savings
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **PR CI time** | 45-60 min | 20-30 min | **50% faster** |
| **Workflows per PR** | 5-7 | 2-3 | **60% reduction** |
| **Redundant setups** | 4x | 1x cached | **75% reduction** |

### Cost Savings
| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Monthly Actions minutes** | ~8,000 | ~3,200 | **60%** |
| **Estimated cost** | $400/mo | $160/mo | **$240/mo** |

### Quality Improvements
- ✅ **Faster feedback**: Developers get results in 20 min vs 60 min
- ✅ **Clear separation**: Unit tests → Integration → Deployment
- ✅ **Smart caching**: Dependencies cached and shared
- ✅ **Conditional execution**: Tests only run when relevant files change

---

## Migration Guide

### For Developers

**No action required!** Your workflow stays the same:
1. Push code to PR
2. CI runs automatically
3. Review results in GitHub Actions

**Key differences**:
- Faster CI feedback (20-30 min vs 45-60 min)
- Fewer workflow runs cluttering PR checks
- Clearer job names showing what's being tested

### For Maintainers

**Phase 1** (Completed):
- ✅ Added path filters to all workflows
- ✅ Consolidated frontend tests into `ci.yml`
- ✅ Merged type safety validation into `ci.yml`
- ✅ Deprecated redundant workflows
- ✅ Created reusable setup workflow

**Phase 2** (Next Sprint):
- [ ] Remove deprecated workflows entirely
- [ ] Migrate to reusable workflows for common tasks
- [ ] Add workflow dispatch for selective testing

**Phase 3** (Future):
- [ ] Implement conditional job execution based on file changes
- [ ] Add parallel test execution for faster results
- [ ] Set up workflow visualization dashboard

---

## Workflow Execution Matrix

### Pull Request (main branch)
| Workflow | Runs | Jobs | Time |
|----------|------|------|------|
| ci.yml | ✅ Always | 4 | ~20 min |
| e2e-tests.yml | ✅ If code changes | 1 | ~12 min |
| check-migrations.yml | ⚡ If migrations change | 1 | ~5 min |
| visual-regression.yml | ⚡ If frontend changes | 1 | ~8 min |

**Total**: 2-4 workflows, 20-35 min

### Push to main
| Workflow | Runs | Jobs | Time |
|----------|------|------|------|
| ci.yml | ✅ Always | 4 | ~20 min |
| e2e-tests.yml | ✅ Full matrix | 3 | ~25 min |
| deploy.yml | ✅ Staging deployment | 3 | ~15 min |

**Total**: 3 workflows, ~35 min, auto-deploys to staging

### Nightly (scheduled)
| Workflow | Runs | Jobs | Time |
|----------|------|------|------|
| e2e-tests.yml | ✅ Full suite | 4 | ~40 min |

---

## Reusable Workflow

A new reusable workflow (`reusable-setup.yml`) provides common setup:

**Features**:
- Configurable Python/Node versions
- Cached dependencies
- Optional frontend builds
- Can be called from any workflow

**Example usage**:
```yaml
jobs:
  test:
    uses: ./.github/workflows/reusable-setup.yml
    with:
      python-version: '3.12'
      install-python: true
      install-frontend: true
      build-frontend: true
```

---

## Troubleshooting

### "Workflow not running on my PR"
Check if your changes match the path filters. Run manually via workflow_dispatch if needed.

### "Tests failing in ci.yml but not locally"
Ensure you're using the same Python/Node versions:
- Python: 3.12 or 3.13
- Node: 20
- pnpm: 8

### "Need to run E2E tests on demand"
Use workflow_dispatch on e2e-tests.yml:
```bash
gh workflow run e2e-tests.yml
```

---

## Questions or Issues?

- Review this document: `.github/workflows/WORKFLOW_CHANGES.md`
- Check workflow files for comments
- Ask in #engineering Slack channel
- Open GitHub issue with `ci/cd` label

---

**Last updated**: 2025-10-06
**Implemented by**: CI/CD Harmonization Project
