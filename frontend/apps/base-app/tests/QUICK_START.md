# Integration Tests - Quick Start Guide

Get up and running with integration tests in 5 minutes.

## ⚡ Quick Start

### 1. Start Required Services

```bash
# From project root
docker compose up -d postgres redis
```

### 2. Run Database Migrations

```bash
# From project root
poetry run alembic upgrade head
```

### 3. Start Backend Server

```bash
# From project root (in terminal 1)
poetry run uvicorn dotmac.platform.routers:app --reload
```

### 4. Start Frontend Server

```bash
# From project root (in terminal 2)
cd frontend/apps/base-app
pnpm dev
```

### 5. Run Tests

```bash
# From frontend/apps/base-app (in terminal 3)
pnpm test:integration
```

## 🎯 Common Commands

```bash
# Run all integration tests
pnpm test:integration

# Run with interactive UI
pnpm test:integration:ui

# Run only authentication tests
pnpm test:integration:auth

# Run only WireGuard tests
pnpm test:integration:wireguard

# Run in headed mode (see browser)
pnpm test:integration:headed

# Debug mode (step through)
pnpm test:integration:debug
```

## 📊 View Test Reports

After running tests:

```bash
pnpm exec playwright show-report
```

## 🐛 Troubleshooting

### Tests Failing with "Connection Refused"

**Problem**: Backend or frontend not running

**Solution**:

```bash
# Check if services are running
curl http://localhost:8000/health  # Backend
curl http://localhost:3000         # Frontend
```

### Database Connection Errors

**Problem**: PostgreSQL not running or migrations not applied

**Solution**:

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run migrations
poetry run alembic upgrade head

# Verify connection
psql postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac
```

### Tests Hanging or Timing Out

**Problem**: Network issues or slow services

**Solution**:

```bash
# Increase timeout in playwright.config.ts
timeout: 60000  // 60 seconds

# Or run with more time
pnpm exec playwright test --timeout=60000
```

### Browser Not Installed

**Problem**: Playwright browsers not installed

**Solution**:

```bash
pnpm exec playwright install chromium
```

## 📝 Example Test Run

```bash
$ pnpm test:integration

Running 97 tests using 4 workers

  ✓ [chromium] › cross-feature/auth-flow.spec.ts:6:5 › Authentication Flow › Login › should login successfully (2.1s)
  ✓ [chromium] › cross-feature/auth-flow.spec.ts:19:5 › Authentication Flow › Login › should show error with invalid email (1.8s)
  ✓ [chromium] › wireguard/server-crud.spec.ts:15:5 › WireGuard Server CRUD › Server List › should display list of servers (2.3s)
  ...

  97 passed (3.2m)

To open last HTML report run:

  pnpm exec playwright show-report
```

## ✅ Success Indicators

Your tests are working correctly when you see:

- ✅ All services start without errors
- ✅ Tests execute and pass
- ✅ HTML report is generated
- ✅ No connection or timeout errors

## 🎓 Next Steps

1. **Read Full Documentation**: `tests/README.md`
2. **View Test Files**: Browse `tests/integration/`
3. **Write Your Own Tests**: Follow patterns in existing tests
4. **Check CI/CD**: `.github/workflows/integration-tests.yml`

## 📚 Documentation

- **Full Testing Guide**: `tests/README.md`
- **Test Fixtures**: `tests/fixtures/test-data.ts`
- **Page Objects**: `tests/helpers/page-objects.ts`
- **API Helpers**: `tests/helpers/api-helpers.ts`
- **Phase 1 Complete**: `/docs/PHASE1_TESTING_COMPLETE.md`

## 🆘 Need Help?

1. Check test output for specific error messages
2. Read `tests/README.md` for detailed documentation
3. Review existing tests for examples
4. Check GitHub Actions for CI/CD issues

---

**You're all set! Happy testing! 🚀**
