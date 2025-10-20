# E2E Testing Guide - Tenant Billing Portal

## Quick Start

The fastest way to run E2E tests for the tenant billing portal:

```bash
# Run the automated script
./scripts/run-e2e-tenant-billing.sh
```

This script will:
1. ✓ Verify infrastructure is running
2. ✓ Seed E2E billing fixtures into test database
3. ✓ Start backend server on port 8000
4. ✓ Start frontend dev server on port 3000
5. ✓ Install Playwright browsers if needed
6. ✓ Run tenant portal E2E tests
7. ✓ Clean up processes on exit

## Manual Testing Steps

If you prefer to run components individually:

### 1. Prerequisites

Ensure infrastructure is running:

```bash
make infra-up
make infra-status  # Verify PostgreSQL, Redis, etc. are healthy
```

### 2. Seed Test Fixtures

The E2E tests require realistic billing data. Two fixtures are available:

**Option A: Comprehensive fixture** (recommended for full testing)
- 1 tenant (Professional plan)
- 10 invoices (2 overdue, 3 due soon, 4 paid, 1 draft)
- 15 payments (mixed statuses)

```python
# In a Python shell or test
from tests.billing.e2e_tenant_fixtures import tenant_portal_billing_data

# Use in pytest
@pytest.mark.asyncio
async def test_portal_with_data(async_session):
    data = await tenant_portal_billing_data(async_session)
    # data contains tenant, invoices, payments, and summary
```

**Option B: Minimal fixture** (for smoke tests)
- 1 tenant (Starter plan)
- 1 open invoice
- 1 successful payment

```python
from tests.billing.e2e_tenant_fixtures import minimal_tenant_billing_data
```

**Manual seeding** (for interactive testing):

```bash
# Use the automated script's seeding component
DATABASE_URL="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac_test" \
  .venv/bin/python scripts/seed_e2e_billing.py
```

### 3. Start Backend

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-platform-services

# Set database to test database
export DATABASE_URL="postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac_test"
export DOTMAC_DATABASE_URL_ASYNC="$DATABASE_URL"

# Start server
.venv/bin/uvicorn dotmac.platform.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify backend is ready:
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### 4. Start Frontend

In a separate terminal:

```bash
cd frontend/apps/base-app
pnpm dev
```

Frontend will be available at: http://localhost:3000

### 5. Run E2E Tests

**Run all tenant portal tests:**
```bash
cd frontend/apps/base-app
pnpm test:e2e tenant-portal.spec.ts
```

**Run specific test:**
```bash
pnpm exec playwright test tenant-portal.spec.ts -g "shows key summary cards"
```

**Run with UI mode (interactive):**
```bash
pnpm exec playwright test tenant-portal.spec.ts --ui
```

**Debug mode:**
```bash
pnpm exec playwright test tenant-portal.spec.ts --debug
```

### 6. View Test Reports

After tests complete:

```bash
# Open HTML report
pnpm exec playwright show-report

# View trace for failed tests
pnpm exec playwright show-trace trace.zip
```

## Test Coverage

The `tenant-portal.spec.ts` file covers:

### ✓ Portal Navigation
- Login flow
- Navigation to tenant billing page
- Page title and headers

### ✓ Summary Cards
- Current plan display
- Monthly spend metrics
- Open invoices count
- Payment health status

### ✓ Invoice List
- Invoice table rendering
- Search/filter functionality
- Invoice selection
- Status badges (overdue, due soon, paid)

### ✓ Payment Table
- Recent payments display
- Payment status badges
- Amount formatting (with minor units)
- Payment method details
- Processed date display

## Test Data Overview

The comprehensive fixture creates this data structure:

```
Tenant: E2E Test Corporation (Professional Plan)
├── Usage: 15/25 users, 45.5/100 GB storage, 125K/500K API calls
├── Invoices (10 total):
│   ├── Overdue (2): INV-2025-1001, INV-2025-1002
│   │   └── Amount: $3,248.99 each (past due)
│   ├── Due Soon (3): INV-2025-1003, 1004, 1005
│   │   └── Amount: $3,248.99 each (due in 15-25 days)
│   ├── Paid (4): INV-2025-1006, 1007, 1008, 1009
│   │   └── Amount: $3,248.99 each (fully paid)
│   └── Draft (1): INV-2025-1010
│       └── Amount: $3,248.99 (not yet issued)
└── Payments (15 total):
    ├── Successful (8):
    │   ├── 4 invoice payments ($3,248.99 each)
    │   └── 4 add-on charges ($999.00 each)
    ├── Failed (4): Card declined errors
    └── Pending (3): Bank transfers in progress
```

## Troubleshooting

### Backend not starting

Check logs:
```bash
tail -f /tmp/backend-e2e.log
```

Common issues:
- Database not running: `make infra-up`
- Port 8000 in use: `lsof -ti:8000 | xargs kill`
- Missing dependencies: `poetry install --with dev`

### Frontend not starting

Check logs:
```bash
tail -f /tmp/frontend-e2e.log
```

Common issues:
- Port 3000 in use: `lsof -ti:3000 | xargs kill`
- Missing dependencies: `pnpm install`
- Environment variables: Check `.env.local`

### Tests failing

**"No invoices found"**
- Ensure fixtures are seeded
- Check database connection
- Verify tenant_id matches in fixtures

**"Element not found"**
- Frontend may not be fully loaded
- Increase timeout in test
- Check `data-testid` attributes match

**Authentication errors**
- Ensure test user exists
- Check JWT token generation
- Verify RBAC permissions

### Playwright issues

**Browsers not installed:**
```bash
pnpm exec playwright install
```

**Test timeout:**
```bash
# Increase timeout in playwright.config.ts
timeout: 60000  # 60 seconds
```

## CI/CD Integration

The E2E tests can be integrated into CI pipelines:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start infrastructure
        run: make infra-up
      - name: Run E2E tests
        run: ./scripts/run-e2e-tenant-billing.sh
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/apps/base-app/playwright-report/
```

## Adding New E2E Tests

When adding new tests to `tenant-portal.spec.ts`:

1. **Use data-testid attributes:**
```tsx
<div data-testid="invoice-row">...</div>
```

2. **Follow existing patterns:**
```typescript
test('new test case', async ({ page }) => {
  await loginAndOpenTenantView(page);

  // Test implementation
  const element = page.locator('[data-testid="element-id"]');
  await expect(element).toBeVisible();
});
```

3. **Test tenant isolation:**
```typescript
test('data scoped to tenant', async ({ page }) => {
  // Verify data from tenant A not visible when viewing tenant B
});
```

4. **Verify currency formatting:**
```typescript
test('amounts display correctly', async ({ page }) => {
  const amount = await page.locator('[data-testid="amount"]').textContent();
  expect(amount).toMatch(/^\$[\d,]+\.\d{2}$/);  // $3,248.99
});
```

## Next Steps

After validating tenant portal:

1. **Enhance test assertions** (see Task 4):
   - Add metric card value validation
   - Test invoice selection behavior
   - Verify payment method details
   - Test pagination and sorting

2. **Partner portal integration** (see Task 5):
   - Mirror tenant portal patterns
   - Add revenue share endpoints
   - Create partner-specific fixtures
   - Build partner E2E tests

## Related Documentation

- [Testing Strategy](./testing-strategy.md)
- [Billing Module Guide](./billing-module.md)
- [Multi-Tenant Architecture](./multi-tenant-architecture.md)
- [Frontend Development](../frontend/README.md)
