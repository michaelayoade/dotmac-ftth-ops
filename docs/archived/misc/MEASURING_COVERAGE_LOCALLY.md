# Measuring Coverage Locally

## The Challenge

This codebase has:
- **33,000+ lines of code**
- **7,047 tests**
- **42 routers** with extensive initialization
- **Event bus** with many handlers

Coverage measurement is inherently slow due to the size and complexity. Full coverage can take **15-30 minutes** locally.

## Practical Solutions

### Option 1: Module-by-Module Coverage (RECOMMENDED)

Measure critical modules one at a time to track your progress:

```bash
# Auth module (90% target)
poetry run pytest tests/auth/test_dependencies.py \
  --cov=src/dotmac/platform/auth/dependencies.py \
  --cov-report=term-missing \
  -v

# Billing core (80% target)
poetry run pytest tests/billing/test_config_comprehensive.py \
  --cov=src/dotmac/platform/billing/config.py \
  --cov-report=term-missing \
  -v

# Webhooks (90% target)
poetry run pytest tests/webhooks/test_service_unit_complete.py \
  --cov=src/dotmac/platform/webhooks/service.py \
  --cov-report=term-missing \
  -v
```

**Advantages**:
- Fast (< 2 minutes per module)
- Focused on specific areas
- Easy to track progress

### Option 2: Use CI for Full Coverage

Let CI handle full coverage measurement:

```bash
# 1. Write your code + tests locally
make test-fast  # Quick validation (<1 min)

# 2. Commit and push
git add . && git commit -m "feat: add feature"
git push

# 3. Check CI for full coverage report
# CI runs with optimizations:
# - Parallel execution
# - Sysmon tracing
# - 30-minute timeout
```

**Advantages**:
- No local slowdown
- Accurate measurement
- Module-specific results in CI

### Option 3: Test Specific Files with Coverage

Focus on files you're working on:

```bash
# Test single file with coverage on that file only
poetry run pytest tests/auth/test_dependencies.py \
  --cov=src/dotmac/platform/auth/dependencies.py \
  --cov-report=term-missing

# Much faster than measuring entire module!
```

### Option 4: Run Coverage Overnight (If Needed)

If you absolutely need full local coverage:

```bash
# Start before leaving for the day
nohup poetry run pytest tests/ \
  --cov=src/dotmac \
  --cov-branch \
  --cov-report=html \
  --cov-report=xml \
  > coverage_run.log 2>&1 &

# Check next morning:
cat coverage_run.log | tail -50
python scripts/check_coverage.py coverage.xml
open htmlcov/index.html
```

## Tracking Progress

### Check Module Coverage Status

```bash
# After any test run that generates coverage.xml
poetry run python scripts/check_coverage.py coverage.xml

# Shows:
# 🔒 auth: 45.2% (target: 90.0%) ❌
# 📦 billing: 67.8% (target: 80.0%) ⚠️
# etc.
```

### Track Critical Modules

Create a tracking file:

```bash
# coverage_progress.md
## Coverage Progress Tracking

### Critical Modules (Target: 90%)
- [ ] auth: 45% → 90% (need 45% more)
- [ ] secrets: 30% → 90% (need 60% more)
- [ ] tenant: 55% → 90% (need 35% more)
- [ ] webhooks: 40% → 90% (need 50% more)

### Core Modules (Target: 80%)
- [ ] billing: 68% → 80% (need 12% more)
- [ ] customer_management: 50% → 80% (need 30% more)
...
```

### Weekly Coverage Snapshots

```bash
# Run once per week, save results
date >> coverage_history.txt
poetry run python scripts/check_coverage.py coverage.xml >> coverage_history.txt
echo "---" >> coverage_history.txt

# Track trends over time
```

## Estimating Coverage Without Measuring

You can estimate coverage by counting tests:

```bash
# Count tests for a module
poetry run pytest tests/auth/ --collect-only -q | tail -1
# 629 tests collected

# Count files in module
find src/dotmac/platform/auth -name "*.py" | wc -l
# 20 files

# Rough estimate: 629 tests / 20 files = ~31 tests per file
# This suggests decent coverage (if tests are good quality)
```

## CI Reports

CI generates detailed reports you can download:

1. Go to GitHub Actions → Your PR → backend-test job
2. Download artifacts: `coverage-3.12.zip`
3. Extract and open `htmlcov/index.html`
4. See detailed line-by-line coverage

## Practical Workflow

### Day-to-Day Development

```bash
# Fast iteration
make test-fast  # <1 minute

# Test specific area
poetry run pytest tests/billing/ -x -q

# Check if your new code has tests
poetry run pytest tests/billing/test_new_feature.py -v
```

### Before Creating PR

```bash
# Run tests
make test-fast

# Optional: Check one critical module you touched
poetry run pytest tests/auth/test_dependencies.py \
  --cov=src/dotmac/platform/auth/dependencies.py \
  --cov-report=term-missing

# Push and let CI handle full coverage
git push
```

### Weekly Progress Check

```bash
# Let CI run on main branch
# Download coverage reports
# Update tracking document
# Plan focus areas for next week
```

## Why This Approach Works

**Local**:
- ✅ Fast feedback (<1 minute)
- ✅ Test specific areas you're working on
- ✅ No waiting for full coverage

**CI**:
- ✅ Accurate full coverage measurement
- ✅ Optimized for performance
- ✅ Generates detailed reports
- ✅ Enforces thresholds

**Tracking**:
- ✅ Module-by-module progress
- ✅ Focus on critical areas first
- ✅ Weekly snapshots show trends

## Commands Quick Reference

```bash
# RECOMMENDED for local dev
make test-fast                     # No coverage, <1 min

# Module coverage (one file at a time)
poetry run pytest tests/auth/test_dependencies.py \
  --cov=src/dotmac/platform/auth/dependencies.py \
  --cov-report=term-missing

# Check coverage report
poetry run python scripts/check_coverage.py coverage.xml

# Let CI handle full coverage
git push  # CI measures everything
```

## Bottom Line

**Full coverage locally**: Too slow (15-30 min)
**Solution**: Use CI for full coverage, measure modules locally as needed
**Result**: Fast development + accurate coverage tracking

**Focus on**:
1. Writing tests for your code
2. Running tests quickly (`make test-fast`)
3. Letting CI measure coverage
4. Tracking progress module-by-module
