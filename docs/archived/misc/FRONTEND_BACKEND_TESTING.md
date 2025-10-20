# Frontend-Backend Integration Testing Guide

## Overview

This document describes the comprehensive testing strategy for validating frontend-backend integration in the DotMac Platform Services.

## Testing Layers

### 1. E2E Tests with Real Backend (Playwright)

**Purpose**: Catch missing API wiring and ensure complete user journeys work end-to-end.

**Location**: `/frontend/e2e/tests/`

**Files**:
- `admin-integrations.spec.ts` - Service integrations dashboard
- `admin-data-transfer.spec.ts` - Import/export job monitoring
- `admin-operations.spec.ts` - System monitoring and health checks
- `api-contract-validation.spec.ts` - API contract compliance

**Run Commands**:
```bash
# Run all E2E tests with real backend
cd frontend/e2e
npm run test:e2e

# Run specific test file
npx playwright test tests/admin-integrations.spec.ts

# Run with UI mode
npx playwright test --ui

# Run in specific browser
npx playwright test --project=chromium
```

**What These Tests Catch**:
- ✅ Missing API endpoints
- ✅ Mismatched field names between frontend/backend
- ✅ Type mismatches in responses
- ✅ Broken user journeys
- ✅ Authentication/authorization issues
- ✅ Error handling gaps

### 2. API Contract Validation Tests

**Purpose**: Validate TypeScript interfaces match Pydantic models.

**Location**: `/frontend/e2e/tests/api-contract-validation.spec.ts`

**Coverage**:
- User Management endpoints (`/api/v1/user-management/*`)
- Settings endpoints (`/api/v1/admin/settings/*`)
- Plugins endpoints (`/api/v1/plugins/*`)
- Monitoring endpoints (`/api/v1/monitoring/*`)
- Data Transfer endpoints (`/api/v1/data-transfer/*`)
- Integrations endpoints (`/api/v1/integrations/*`)

**Run Command**:
```bash
cd frontend/e2e
npx playwright test tests/api-contract-validation.spec.ts -v
```

**Validation Checks**:
1. **Endpoint Existence**: All routes return 200/401/403 (not 404)
2. **Response Structure**: Required fields present
3. **Type Validation**: Fields have correct types (string, number, boolean, array)
4. **Enum Validation**: Status values match allowed enums
5. **Pagination**: Consistent paginated response format
6. **Timestamps**: Valid ISO 8601 format
7. **Error Responses**: Consistent error format

### 3. Backend Smoke Tests

**Purpose**: Fast backend-only tests that validate endpoints before frontend E2E.

**Location**: `/tests/integration/test_frontend_backend_smoke.py`

**Coverage**:
- All critical endpoints used by frontend
- Response structure validation
- Cross-module integration points

**Run Command**:
```bash
# Run smoke tests
pytest tests/integration/test_frontend_backend_smoke.py -v

# Run with coverage
pytest tests/integration/test_frontend_backend_smoke.py --cov=src/dotmac/platform --cov-report=term

# Run specific test class
pytest tests/integration/test_frontend_backend_smoke.py::TestMonitoringEndpoints -v
```

**Test Classes**:
- `TestUserManagementEndpoints` - User CRUD operations
- `TestSettingsEndpoints` - Platform settings
- `TestPluginsEndpoints` - Plugin management
- `TestMonitoringEndpoints` - System health and metrics
- `TestDataTransferEndpoints` - Import/export jobs
- `TestIntegrationsEndpoints` - Service integrations
- `TestCrossModuleIntegration` - Multi-module workflows

### 4. MSW Integration Tests

**Purpose**: Mock Service Worker tests that proxy to real backend for contract enforcement.

**Status**: ✅ Implemented

**Location**: `/frontend/apps/base-app/mocks/` and `/frontend/e2e/tests/msw-contract-validation.spec.ts`

**Files**:
- `handlers.ts` - Request handlers with backend proxy and contract validation
- `browser.ts` - MSW setup for browser environment (dev, Storybook)
- `server.ts` - MSW setup for Node.js environment (tests)
- `msw-contract-validation.spec.ts` - Playwright tests with MSW

**Run Commands**:
```bash
# Run MSW contract validation tests
cd frontend/e2e
npx playwright test tests/msw-contract-validation.spec.ts -v

# Run with proxy mode (default - forwards to real backend)
MSW_MODE=proxy npx playwright test tests/msw-contract-validation.spec.ts

# Run with mock mode (deterministic data)
MSW_MODE=mock npx playwright test tests/msw-contract-validation.spec.ts
```

**What These Tests Catch**:
- ✅ TypeScript interfaces don't match Pydantic models
- ✅ Field type mismatches (string vs number, etc.)
- ✅ Missing required fields in responses
- ✅ Invalid enum values
- ✅ Inconsistent pagination formats
- ✅ Invalid timestamp formats

**Example Handler**:
```typescript
// Proxy mode with contract validation
http.get(`${API_BASE}/integrations`, async ({ request }) => {
  // Forward to real backend
  const response = await fetch(new URL(request.url, BACKEND_URL), {
    headers: request.headers,
  });

  if (!response.ok) {
    return passthrough();
  }

  const data = await response.json();

  // Validate contract
  if (!data.integrations || !Array.isArray(data.integrations)) {
    throw new Error('Response must have integrations array');
  }

  // Validate each integration matches TypeScript interface
  data.integrations.forEach((integration: any, index: number) => {
    validateIntegrationContract(integration);
  });

  return HttpResponse.json(data);
})
```

## Test Execution Strategy

### Local Development

**Quick Validation**:
```bash
# 1. Start infrastructure
make infra-up

# 2. Run backend smoke tests (fastest)
pytest tests/integration/test_frontend_backend_smoke.py -v

# 3. Run E2E tests for specific feature
cd frontend/e2e
npx playwright test tests/admin-integrations.spec.ts
```

**Full Validation**:
```bash
# 1. Start full stack
make dev

# 2. Run all smoke tests
pytest tests/integration/test_frontend_backend_smoke.py -v

# 3. Run all E2E tests
cd frontend/e2e
npm run test:e2e

# 4. Run API contract validation
npx playwright test tests/api-contract-validation.spec.ts -v
```

### CI/CD Pipeline

**Recommended Pipeline Stages**:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  backend-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
      - name: Install dependencies
        run: poetry install
      - name: Start infrastructure
        run: make infra-up
      - name: Run smoke tests
        run: pytest tests/integration/test_frontend_backend_smoke.py -v

  e2e-tests:
    needs: backend-smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install Playwright
        run: cd frontend/e2e && npm ci && npx playwright install
      - name: Start backend
        run: make dev-backend &
      - name: Start frontend
        run: cd frontend/apps/base-app && npm run dev &
      - name: Wait for services
        run: sleep 30
      - name: Run E2E tests
        run: cd frontend/e2e && npm run test:e2e
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/e2e/playwright-report/
```

## Test Maintenance

### When to Update Tests

1. **New API Endpoint**:
   - Add to backend smoke tests (`test_frontend_backend_smoke.py`)
   - Add to API contract validation (`api-contract-validation.spec.ts`)
   - Add MSW handler with contract validation (`handlers.ts`)
   - Create E2E journey if user-facing

2. **API Response Change**:
   - Update TypeScript interface in hooks (`hooks/use*.ts`)
   - Update contract validation test (`api-contract-validation.spec.ts`)
   - Update MSW contract validation (`handlers.ts`)
   - Update smoke test assertions (`test_frontend_backend_smoke.py`)

3. **New Dashboard**:
   - Create E2E spec file (`admin-*.spec.ts`)
   - Add endpoint validation to contract tests
   - Add MSW handlers for all endpoints used
   - Add smoke tests for all endpoints used

### Anti-Patterns to Avoid

❌ **Don't**: Mock API responses in E2E tests
✅ **Do**: Use real backend or MSW proxy

❌ **Don't**: Skip contract validation for "internal" endpoints
✅ **Do**: Validate all endpoints used by frontend

❌ **Don't**: Only test happy paths
✅ **Do**: Test error states, loading states, empty states

❌ **Don't**: Hardcode API responses in tests
✅ **Do**: Fetch from real API and validate structure

## Current Test Coverage

### ✅ Completed Features

| Feature | E2E Tests | Contract Tests | MSW Tests | Smoke Tests |
|---------|-----------|----------------|-----------|-------------|
| Admin Users | ⏳ Pending | ✅ Complete | ✅ Complete | ✅ Complete |
| Admin Settings | ⏳ Pending | ✅ Complete | ✅ Complete | ✅ Complete |
| Plugins | ⏳ Pending | ✅ Complete | ✅ Complete | ✅ Complete |
| Operations Monitoring | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Complete |
| Data Transfer Jobs | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Complete |
| Integrations | ✅ Complete | ✅ Complete | ✅ Complete | ✅ Complete |

### 📊 Test Metrics

- **Total E2E Tests**: 30+ scenarios
- **MSW Contract Tests**: 15+ validation tests
- **API Endpoints Validated**: 20+
- **Response Fields Validated**: 100+
- **MSW Handlers**: 8+ with contract validation
- **Browser Coverage**: Chrome, Firefox, Safari, Mobile
- **Execution Time**:
  - Smoke tests: ~30 seconds
  - MSW contract tests: ~1 minute
  - Full E2E tests: ~5 minutes

## Debugging Failed Tests

### E2E Test Failures

```bash
# Run with debug output
npx playwright test --debug

# Run with headed browser
npx playwright test --headed

# Generate trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### Contract Test Failures

When a contract test fails:

1. **Check Backend Response**:
   ```bash
   curl -X GET http://localhost:8000/api/v1/endpoint \
     -H "Authorization: Bearer token"
   ```

2. **Compare with TypeScript Interface**:
   - Open `/frontend/apps/base-app/hooks/use*.ts`
   - Verify interface matches response

3. **Update Interface or Backend**:
   - If backend is correct → Update TypeScript interface
   - If frontend is correct → Update Pydantic model

### Smoke Test Failures

```bash
# Run with verbose output
pytest tests/integration/test_frontend_backend_smoke.py -vv

# Run with pdb debugger
pytest tests/integration/test_frontend_backend_smoke.py --pdb

# Run specific failing test
pytest tests/integration/test_frontend_backend_smoke.py::TestClass::test_method -vv
```

## Best Practices

### 1. Test Independence

Each test should:
- Set up its own data
- Clean up after itself
- Not depend on other tests

### 2. Realistic Data

Use data that matches production:
- Valid email formats
- Realistic timestamps
- Proper enum values

### 3. Comprehensive Assertions

Don't just check `response.ok()`:
```typescript
// ❌ Weak assertion
expect(response.ok()).toBeTruthy();

// ✅ Strong assertions
expect(response.status()).toBe(200);
const data = await response.json();
expect(data).toHaveProperty('users');
expect(Array.isArray(data.users)).toBeTruthy();
expect(data.users.length).toBeGreaterThan(0);
```

### 4. Error Scenarios

Test error paths:
- 404 for missing resources
- 422 for validation errors
- 401 for unauthorized
- 500 for server errors

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [MSW Documentation](https://mswjs.io/)
- [API Contract Testing Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html)

## Next Steps

1. ⏳ Complete E2E tests for Admin Users and Admin Settings
2. ✅ Implement MSW proxy tests
3. ⏳ Add visual regression tests (optional)
4. ⏳ Set up automated test runs on PR
5. ⏳ Create performance benchmarks (optional)

---

**Last Updated**: 2025-10-11
**Maintained By**: Platform Engineering Team
