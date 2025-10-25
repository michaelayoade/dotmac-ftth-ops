# DotMac Platform E2E Tests

Comprehensive end-to-end tests for the DotMac Platform using Playwright.

## Overview

This test suite provides comprehensive coverage of:

- **Authentication flows** (login, MFA, logout)
- **API integrations** (REST and GraphQL)
- **User journeys** (admin and regular user workflows)
- **Real-time features** (WebSocket, notifications)
- **Performance testing**
- **Visual regression testing**

## Setup

### Prerequisites

- Node.js 18+
- pnpm 9+
- Python 3.12+ with Poetry
- Redis server
- DotMac backend running

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm install:browsers

# Install system dependencies (Linux only)
pnpm install:deps
```

### Environment Setup

Create `.env` file in the e2e directory:

```env
# Application URLs
E2E_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000

# Test credentials (DO NOT use production credentials!)
E2E_ADMIN_USERNAME=admin
E2E_ADMIN_PASSWORD=admin123

# Infrastructure
REDIS_URL=redis://localhost:6379/1
DATABASE_URL=sqlite:///tmp/e2e_test.db
DOTMAC_JWT_SECRET_KEY=test-secret-key-for-e2e
```

**Important**: Never commit real credentials. Use environment-specific secrets in CI/CD.

## Running Tests

### Local Development

```bash
# Run all tests
pnpm test

# Run tests in headed mode (visible browser)
pnpm test:headed

# Run specific test file
pnpm test tests/auth/login.spec.ts

# Run tests in debug mode
pnpm test:debug

# Run tests with UI mode
pnpm test:ui
```

### Browser-Specific Tests

```bash
# Run on specific browser
pnpm test --project=chromium
pnpm test --project=firefox
pnpm test --project=webkit

# Run on mobile browsers
pnpm test --project="Mobile Chrome"
pnpm test --project="Mobile Safari"
```

### Test Categories

```bash
# Authentication tests
pnpm test tests/auth/

# API integration tests
pnpm test tests/api/

# User journey tests
pnpm test tests/journeys/

# Performance tests
pnpm test tests/performance/

# Visual regression tests
pnpm test tests/visual/
```

## Test Structure

```
tests/
├── auth/                     # Authentication flows
│   ├── login.spec.ts        # Login/logout functionality
│   ├── mfa.spec.ts          # Multi-factor authentication
│   └── oauth.spec.ts        # OAuth provider testing
├── api/                     # API integration tests
│   ├── rest-integration.spec.ts     # REST API tests
│   ├── graphql-integration.spec.ts  # GraphQL API tests
│   └── websocket.spec.ts    # WebSocket tests
├── journeys/                # End-to-end user workflows
│   ├── admin-workflow.spec.ts       # Admin user journey
│   ├── user-workflow.spec.ts        # Regular user journey
│   └── guest-workflow.spec.ts       # Anonymous user journey
├── performance/             # Performance and load tests
│   ├── page-load.spec.ts    # Page load performance
│   └── api-performance.spec.ts      # API response times
└── visual/                  # Visual regression tests
    ├── login-page.spec.ts   # Login page screenshots
    └── dashboard.spec.ts    # Dashboard visual tests
```

## Page Objects

Page objects are located in `pages/` directory:

```typescript
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";

test("user login flow", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  await loginPage.goto();
  await loginPage.login("user@test.com", "password");
  await dashboardPage.waitForDashboardLoad();
});
```

## Test Utilities

### API Testing

```typescript
import { APITestHelper } from "../utils/api-helper";

test("API integration", async ({ page }) => {
  const apiHelper = new APITestHelper(page);
  await apiHelper.authenticate("admin@test.com", "password");

  const user = await apiHelper.createTestUser();
  // Test continues...
});
```

### GraphQL Testing

```typescript
import { GraphQLTestHelper } from "../utils/graphql-helper";

test("GraphQL queries", async ({ page }) => {
  const gqlHelper = new GraphQLTestHelper(page);
  await gqlHelper.authenticate("admin@test.com", "password");

  const response = await gqlHelper.getUsersQuery({ limit: 10 });
  // Test continues...
});
```

### TOTP/MFA Testing

```typescript
import { generateTOTP, TOTPTestHelper } from "../utils/totp-helper";

test("MFA authentication", async ({ page }) => {
  const totpHelper = new TOTPTestHelper();
  const code = totpHelper.getCurrentCode();

  // Use code in MFA form...
});
```

## Configuration

### Playwright Configuration

Key settings in `playwright.config.ts`:

- **Browsers**: Chromium, Firefox, WebKit, Mobile browsers
- **Retries**: 2 retries on CI, 0 locally
- **Parallel execution**: Full parallelization enabled
- **Timeouts**: 30s test timeout, 10s expect timeout
- **Reporters**: HTML, JSON, JUnit reports
- **Traces**: Captured on first retry
- **Screenshots**: Captured on failure
- **Videos**: Recorded on failure

### Global Setup/Teardown

- **Global Setup**: Starts backend services, creates test data
- **Global Teardown**: Cleans up test data and services
- **Per-test Setup**: Fresh browser context, authentication
- **Per-test Teardown**: Cleanup test-specific data

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- **Push** to main/develop branches
- **Pull requests** to main/develop
- **Nightly schedule** for comprehensive testing

### Test Sharding

Tests are sharded across multiple runners for faster execution:

- 4 shards per browser
- Matrix strategy for browser/shard combinations
- Parallel execution reduces total test time

### Reporting

- **HTML reports** for detailed test results
- **JUnit XML** for CI integration
- **Test artifacts** (traces, screenshots, videos)
- **Performance metrics** and trends
- **Visual regression** comparison images

## Best Practices

### Writing Tests

1. **Use Page Objects** for reusable UI interactions
2. **Independent Tests** - each test should be self-contained
3. **Proper Waits** - use `expect()` and `waitFor()` instead of `setTimeout()`
4. **Test Data** - create and cleanup test data per test
5. **Error Handling** - test both success and failure scenarios

### Performance

1. **Parallel Execution** - tests run in parallel by default
2. **Browser Reuse** - browser contexts are reused when possible
3. **Selective Testing** - use test filters for faster feedback
4. **Resource Cleanup** - cleanup resources to prevent memory leaks

### Debugging

1. **Debug Mode** - `pnpm test:debug` for step-by-step debugging
2. **UI Mode** - `pnpm test:ui` for interactive test runner
3. **Trace Viewer** - examine traces of failed tests
4. **Screenshots** - automatic screenshots on failure
5. **Console Logs** - captured browser console output

## Troubleshooting

### Common Issues

1. **Services Not Running**

   ```bash
   # Check backend is running
   curl http://localhost:8000/health

   # Check frontend is running
   curl http://localhost:3000
   ```

2. **Authentication Failures**
   - Verify test users exist in database
   - Check JWT secret configuration
   - Ensure Redis is running for sessions

3. **Timeouts**
   - Increase timeout in test configuration
   - Check for slow network conditions
   - Verify test environment performance

4. **Flaky Tests**
   - Add proper waits for dynamic content
   - Use `expect()` assertions instead of `toBe()`
   - Check for race conditions

### Environment Issues

1. **Database State**

   ```bash
   # Reset test database
   poetry run alembic downgrade base
   poetry run alembic upgrade head
   ```

2. **Redis Cache**

   ```bash
   # Clear Redis cache
   redis-cli FLUSHDB
   ```

3. **Browser Issues**
   ```bash
   # Reinstall browsers
   pnpm install:browsers --force
   ```

## Contributing

1. **Test Naming** - Use descriptive test names
2. **Test Structure** - Follow AAA pattern (Arrange, Act, Assert)
3. **Documentation** - Document complex test scenarios
4. **Code Review** - All tests must pass code review
5. **Coverage** - Aim for comprehensive user journey coverage

## Monitoring

- **Test Results** tracked in CI/CD pipeline
- **Performance Metrics** monitored over time
- **Flaky Test Detection** automated alerts
- **Coverage Reports** generated per test run
- **Visual Regression** changes flagged for review
