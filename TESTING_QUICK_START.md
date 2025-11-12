# Testing Quick Start Guide

## 🚀 Quick Commands

### Start Everything

```bash
# Terminal 1: Start backend
make dev

# Terminal 2: Start frontend apps
cd frontend
pnpm dev:isp     # ISP Ops on http://localhost:3001
# OR
pnpm dev:admin   # Platform Admin on http://localhost:3002
```

### Run Tests

```bash
cd frontend

# Quick tests (type check + unit tests)
pnpm test:quick

# All tests
pnpm test:all

# E2E tests only
pnpm e2e

# E2E with visible browser
pnpm e2e:headed

# Interactive E2E UI mode
pnpm e2e:ui

# Comprehensive page tests
pnpm e2e:comprehensive
```

### Browser Inspector

```bash
cd frontend

# Inspect ISP Ops App
pnpm inspect:isp

# Inspect Platform Admin App
pnpm inspect:admin

# Or directly
node ../scripts/browser-inspector.mjs http://localhost:3001
```

### Interactive Testing

```bash
# Launch interactive testing menu
cd frontend
pnpm test:interactive
```

## 📝 Manual Testing Workflow

### 1. Check Apps Are Running

```bash
curl http://localhost:3001  # ISP Ops
curl http://localhost:3002  # Platform Admin
curl http://localhost:8000/api/v1/health  # Backend
```

### 2. Open Browser Inspector

```bash
cd frontend
pnpm inspect:isp
```

This opens Chrome with:
- ✅ DevTools auto-open
- ✅ Console log capture
- ✅ Network error monitoring
- ✅ Page metrics display

### 3. Test Critical Workflows

#### Login Flow
1. Navigate to http://localhost:3001/login
2. Enter credentials
3. Check console for errors
4. Verify redirect to dashboard

#### Subscriber Management
1. Go to `/dashboard/subscribers`
2. Check list loads
3. Test search/filter
4. Click subscriber → verify details load
5. Test create/edit forms

#### Billing Flow
1. Go to `/dashboard/billing-revenue`
2. Check invoices load
3. Test payment recording
4. Verify receipt generation

### 4. Check Console Logs

Expected logs:
- ℹ️ INFO: React DevTools message
- 📝 LOG: Auth provider messages
- ❌ ERROR: Only 401 (auth) expected

Unexpected logs to investigate:
- 💥 JavaScript errors
- ❌ 404 errors (except favicon before fix)
- ❌ 500 errors

## 🎯 Testing Scenarios

### Scenario 1: New Subscriber Onboarding

```bash
# 1. Start browser inspector
pnpm inspect:isp

# 2. Navigate through flow:
# - /dashboard/subscribers → Click "New Subscriber"
# - Fill form
# - Submit
# - Verify success message
# - Check subscriber appears in list
# - Verify RADIUS session created
```

### Scenario 2: Billing Cycle

```bash
# 1. Generate invoice
# - /dashboard/billing-revenue/invoices
# - Click "Generate Invoice"
# - Select subscriber
# - Submit

# 2. Record payment
# - /dashboard/billing-revenue/payments
# - Click "Record Payment"
# - Enter details
# - Submit

# 3. Verify receipt
# - /dashboard/billing-revenue/receipts
# - Check latest receipt
```

### Scenario 3: Support Ticket

```bash
# 1. Create ticket
# - /dashboard/support/new
# - Fill details
# - Submit

# 2. Update ticket
# - /dashboard/support/[id]
# - Add comment
# - Change status
# - Assign agent

# 3. Close ticket
# - Verify status updated
# - Check notifications sent
```

## 🔧 Test Data Setup

### Create Test User

```bash
cd backend
poetry run python scripts/create-test-users.py
```

Or via API:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "tenant_name": "Test ISP"
  }'
```

### Seed Test Data

```bash
cd backend
poetry run alembic upgrade head
poetry run python scripts/seed-test-data.py
```

## 📊 View Test Reports

### E2E Test Report

```bash
cd frontend
pnpm e2e:report
```

### Coverage Report

```bash
# Frontend
cd frontend
pnpm test:coverage
open apps/isp-ops-app/coverage/lcov-report/index.html

# Backend
cd backend
poetry run pytest --cov=src --cov-report=html tests/
open htmlcov/index.html
```

## 🐛 Debugging

### Failed E2E Test

```bash
# View trace
npx playwright show-trace test-results/trace.zip

# View screenshots
open test-results/*/test-failed-*.png

# Run single test with debug
pnpm e2e:debug tests/auth/login.spec.ts
```

### Backend API Issues

```bash
# Check logs
tail -f logs/app.log

# Test endpoint
curl http://localhost:8000/api/v1/subscribers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Build Issues

```bash
# Clean rebuild
cd frontend
pnpm clean
rm -rf node_modules
pnpm install
pnpm --filter @dotmac/headless build
pnpm --filter @dotmac/primitives build
pnpm build:isp
```

## ✅ Smoke Test Checklist

Quick verification that everything works:

```bash
# 1. Check services running
docker ps | grep -E "postgres|redis|minio"

# 2. Check backend
curl http://localhost:8000/api/v1/health

# 3. Check frontends
curl http://localhost:3001
curl http://localhost:3002

# 4. Run smoke tests
cd frontend
pnpm test:smoke

# 5. Test login page loads
open http://localhost:3001/login
```

## 📈 Performance Testing

### Page Load Times

```bash
# Use browser inspector to measure
node scripts/browser-inspector.mjs http://localhost:3001/dashboard

# Look for "Page loaded successfully!" and timing
```

Expected load times:
- Login page: < 2s
- Dashboard: < 3s
- List pages: < 4s

### Memory Usage

```bash
# Monitor with browser inspector running
# Check DevTools → Performance → Memory

# Or use Playwright test
pnpm e2e tests/comprehensive-page-tests.spec.ts --grep "memory"
```

## 🔄 Continuous Testing

### Watch Mode (Unit Tests)

```bash
cd frontend/apps/isp-ops-app
pnpm test:watch
```

### Watch Mode (Type Checking)

```bash
cd frontend
pnpm type-check --watch
```

### Auto-run E2E on Changes

```bash
cd frontend
pnpm e2e --ui
# Use the Playwright UI to watch and re-run tests
```

## 📚 Resources

- **Testing Guide**: `docs/TESTING_GUIDE.md` (comprehensive)
- **Browser Inspector**: `scripts/browser-inspector.mjs`
- **Test Runner**: `scripts/test-runner.sh`
- **Interactive Helper**: `scripts/interactive-test-helper.sh`

## 🆘 Common Issues

### Port Already in Use

```bash
# Kill process on port
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```

### Database Connection Error

```bash
# Restart database
docker-compose restart postgres

# Check connection
docker-compose exec postgres psql -U dotmac -d dotmac_dev -c "SELECT 1"
```

### Playwright Browser Not Found

```bash
cd frontend
npx playwright install chromium
```

### Module Not Found

```bash
# Rebuild shared packages
cd frontend
pnpm --filter @dotmac/headless build
pnpm --filter @dotmac/primitives build
pnpm --filter @dotmac/graphql build
```

## 💡 Pro Tips

1. **Use browser inspector in parallel** - Keep it running while manually testing
2. **Check Network tab** - Verify API calls are succeeding
3. **Monitor console** - Catch errors early
4. **Test in incognito** - Avoid cache issues
5. **Use React DevTools** - Inspect component state
6. **Check accessibility** - Use Lighthouse or axe DevTools
7. **Test different screen sizes** - Use device toolbar in DevTools
8. **Save test credentials** - Create a test-credentials.md (gitignored)

---

**Need help?** Check the full guide: `docs/TESTING_GUIDE.md`
