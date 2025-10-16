# Integration Testing Infrastructure

Comprehensive integration tests for the DotMac platform frontend, covering authentication, WireGuard VPN management, communications, and real-time features.

## 📁 Test Structure

```
tests/
├── integration/              # Integration test suites
│   ├── wireguard/           # WireGuard VPN tests
│   │   ├── server-crud.spec.ts      (25 tests)
│   │   ├── peer-crud.spec.ts        (25 tests)
│   │   ├── dashboard.spec.ts        (20 tests)
│   │   └── provisioning.spec.ts     (15 tests)
│   ├── cross-feature/       # Cross-feature tests
│   │   └── auth-flow.spec.ts        (12 tests)
│   ├── communications/      # Communications tests (TBD)
│   └── realtime/           # Real-time tests (TBD)
├── fixtures/               # Test data factories
│   └── test-data.ts        # Generate test data
├── helpers/               # Test utilities
│   ├── page-objects.ts    # Page Object Models
│   └── api-helpers.ts     # API interaction helpers
└── README.md             # This file
```

## 🎯 Test Coverage

### Completed ✅

**Phase 1 (97 tests)**:
- **Authentication Tests**: 12 tests
  - Login/logout flows
  - JWT token handling
  - Protected routes
  - Session persistence
  - Multi-tab sessions
  - Error handling

- **WireGuard Server CRUD**: 25 tests
  - Server list, search, filters
  - Server creation with validation
  - Server details and statistics
  - Server updates and key regeneration
  - Server deletion with confirmations

- **WireGuard Peer CRUD**: 25 tests
  - Peer list, search, filters
  - Peer creation with auto-generated keys
  - Peer IP assignment
  - Peer details and QR codes
  - Peer updates and status management
  - Peer deletion

- **WireGuard Dashboard**: 20 tests
  - Statistics cards
  - Server/peer overviews
  - Charts and graphs
  - Recent activity
  - Auto-refresh functionality
  - Empty states
  - Alerts and notifications

- **WireGuard Provisioning**: 15 tests
  - One-click VPN provisioning wizard
  - Multi-step form validation
  - Bulk peer creation
  - Configuration downloads
  - Error handling and retries

**Phase 2 (125 tests)**:
- **Email Sending**: 30 tests
  - Email composition and validation
  - Queueing and scheduling
  - Template usage with variables
  - Attachments and rich text
  - Preview and error handling

- **Template Management**: 25 tests
  - Template CRUD operations
  - Variable detection and substitution
  - HTML and plain text support
  - Template testing
  - Bulk operations

- **Communications Dashboard**: 10 tests
  - Real-time statistics
  - System health monitoring
  - Charts and export functionality

- **SSE Connections**: 30 tests
  - Connection establishment
  - Event reception and filtering
  - Event history
  - Performance and multi-tab support

- **WebSocket Connections**: 20 tests
  - Bi-directional communication
  - Job/campaign control commands
  - Real-time progress updates
  - Connection health and cleanup

- **Reconnection & Resilience**: 10 tests
  - Auto-reconnection with backoff
  - State preservation
  - Network interruption handling
  - Connection quality indicators

**Phase 3 (47 tests)**:
- **Global Search UI**: 13 tests
  - Search page functionality
  - Entity type filtering
  - Result navigation
  - Pagination and URL sync
  - Error handling

- **Audit Dashboard**: 21 tests
  - Summary dashboard with metrics
  - Activity log with filters
  - Export functionality
  - Time range selection
  - Error handling

- **Command Palette (⌘K)**: 31 tests
  - Keyboard shortcuts (⌘K/Ctrl+K)
  - Quick actions (9 actions)
  - Global search integration
  - Recent searches
  - Keyboard navigation
  - Error handling

### Total Tests: **269 tests** ✅

## 🚀 Running Tests

### Prerequisites

Ensure you have the required services running:

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Run database migrations
poetry run alembic upgrade head

# Start backend server
poetry run uvicorn dotmac.platform.routers:app --reload

# In another terminal, start frontend
cd frontend/apps/base-app
pnpm dev
```

### Run All Integration Tests

```bash
pnpm test:integration
```

### Run Specific Test Suites

```bash
# Authentication tests only
pnpm test:integration:auth

# WireGuard tests only
pnpm test:integration:wireguard

# Communications tests only
pnpm test:integration tests/integration/communications

# UI Dashboard tests only (Phase 3)
pnpm test:integration tests/integration/ui-dashboards

# Specific UI tests
pnpm test:integration tests/integration/ui-dashboards/search.spec.ts
pnpm test:integration tests/integration/ui-dashboards/audit.spec.ts
pnpm test:integration tests/integration/ui-dashboards/command-palette.spec.ts

# Run with UI mode (interactive)
pnpm test:integration:ui

# Run in headed mode (see browser)
pnpm test:integration:headed

# Debug mode (step through tests)
pnpm test:integration:debug
```

### Run Tests in CI

Tests run automatically on GitHub Actions when you push code:

```bash
git push origin feature/my-feature
```

See `.github/workflows/integration-tests.yml` for CI configuration.

## 📝 Writing New Tests

### 1. Using Test Fixtures

Generate test data using factory functions:

```typescript
import { generateTestServer, generateTestPeer } from '../../fixtures/test-data';

test('should create server', async () => {
  const serverData = generateTestServer({
    name: 'my-vpn',
    location: 'US-East-1',
  });
  // Use serverData in test
});
```

### 2. Using Page Objects

Interact with pages using Page Object Model:

```typescript
import { ServerCreatePage } from '../../helpers/page-objects';

test('should create server via UI', async ({ page }) => {
  const createPage = new ServerCreatePage(page);
  await createPage.navigate();
  await createPage.fillForm({ name: 'test', location: 'US' });
  await createPage.submit();
});
```

### 3. Using API Helpers

Setup/teardown test data using API helpers:

```typescript
import { createServer, deleteServer } from '../../helpers/api-helpers';

test('should display server', async ({ page }) => {
  // Setup
  const server = await createServer(generateTestServer(), authToken);

  // Test
  await page.goto(`/wireguard/servers/${server.id}`);

  // Teardown
  await deleteServer(server.id, authToken);
});
```

### 4. Test Structure

Follow this pattern for consistent tests:

```typescript
test.describe('Feature Name', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Setup: Create user and login
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.afterEach(async () => {
    // Teardown: Cleanup test data
    await cleanupServers(authToken);
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const testData = generateTestData();

    // Act
    await performAction(testData);

    // Assert
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

## 🛠️ Test Helpers

### Page Objects (page-objects.ts)

Encapsulate page interactions for maintainable tests:

- `LoginPage` - Login page interactions
- `WireGuardDashboard` - Dashboard interactions
- `ServerListPage` - Server list with search/filters
- `ServerCreatePage` - Server creation form
- `ServerDetailsPage` - Server details view
- `PeerListPage` - Peer list
- `PeerCreatePage` - Peer creation form
- `CommunicationsDashboard` - Communications dashboard
- `EmailComposerPage` - Email composition
- `TemplateListPage` - Template management

### API Helpers (api-helpers.ts)

Programmatic API access for test setup/teardown:

**Authentication:**
- `loginUser(page, email, password)` - Login and get token
- `createTestUser(userData)` - Create test user
- `getAuthToken(page)` - Get current auth token

**WireGuard:**
- `createServer(serverData, token)` - Create server
- `updateServer(id, updates, token)` - Update server
- `deleteServer(id, token)` - Delete server
- `createPeer(peerData, token)` - Create peer
- `provisionVPN(data, token)` - Provision VPN service

**Seeding:**
- `seedServers(servers, token)` - Bulk create servers
- `seedPeers(serverId, peers, token)` - Bulk create peers

**Cleanup:**
- `cleanupServers(token)` - Delete all test servers
- `cleanupPeers(token)` - Delete all test peers
- `cleanupAll(token)` - Clean everything

**Mocking:**
- `mockAPIResponse(page, endpoint, response)` - Mock API success
- `mockAPIError(page, endpoint, status, error)` - Mock API error
- `mockAPIDelay(page, endpoint, delayMs)` - Add API delay

### Test Fixtures (test-data.ts)

Generate valid test data:

**WireGuard:**
- `generateTestServer(overrides?)` - Generate server data
- `generateMultipleServers(count)` - Generate multiple servers
- `generateTestPeer(serverId, overrides?)` - Generate peer data
- `generateMultiplePeers(serverId, count)` - Generate multiple peers

**Communications:**
- `generateTestTemplate(overrides?)` - Generate template data
- `generateTestEmail(overrides?)` - Generate email data

**Users:**
- `generateTestUser(overrides?)` - Generate user data
- `generateMultipleUsers(count, tenantId?)` - Generate multiple users

**Utilities:**
- `randomString(length?)` - Random string
- `randomEmail()` - Random email
- `randomIPv4()` - Random IPv4 address
- `randomSubnet()` - Random subnet

## 📊 Test Reports

### View HTML Report

After running tests, view the detailed report:

```bash
pnpm exec playwright show-report
```

### View in CI

GitHub Actions automatically generates and uploads test reports as artifacts.

## 🐛 Debugging Tests

### Interactive UI Mode

```bash
pnpm test:integration:ui
```

Opens Playwright's interactive UI where you can:
- See all tests
- Run individual tests
- Watch tests execute
- Time travel through test steps
- Inspect DOM at any point

### Debug Mode

```bash
pnpm test:integration:debug
```

Opens Playwright Inspector to step through tests line by line.

### Headed Mode

```bash
pnpm test:integration:headed
```

Runs tests in a visible browser window.

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots (`test-results/`)
- Videos (if enabled in `playwright.config.ts`)
- Traces (for detailed debugging)

## ✅ Best Practices

### Do's ✅

1. **Use Page Objects** - Encapsulate page interactions
2. **Use Factories** - Generate test data with factories
3. **Clean Up** - Always cleanup test data in `afterEach`
4. **Isolate Tests** - Each test should be independent
5. **Mock External Services** - Use `mockAPI*` helpers
6. **Use Meaningful Names** - Test names should describe behavior
7. **Arrange-Act-Assert** - Follow AAA pattern
8. **Test User Behavior** - Not implementation details

### Don'ts ❌

1. **Don't Share State** - Between tests
2. **Don't Use Real Services** - Mock external APIs
3. **Don't Hardcode Data** - Use factories
4. **Don't Skip Cleanup** - Always teardown
5. **Don't Test Implementation** - Test user-visible behavior
6. **Don't Use Fixed Timeouts** - Use `waitFor*` helpers
7. **Don't Commit Secrets** - Use environment variables

## 🔧 Configuration

### Playwright Config

Edit `playwright.config.ts` for:
- Browser settings
- Timeouts
- Screenshots/videos
- Reporters
- Parallel execution

### Environment Variables

Set in `.env.test` or CI:

```bash
# Backend API URL
API_BASE_URL=http://localhost:8000

# Frontend URL
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/test_db

# Redis
REDIS_URL=redis://localhost:6379/0
```

## 📈 Test Metrics

### Current Coverage
- **Total Tests**: 97
- **Test Files**: 5
- **Page Objects**: 10
- **API Helpers**: 30+
- **Fixtures**: 15+

### Target Coverage (Phase 1)
- ✅ **50+ tests** - Achieved (97 tests)
- ✅ **Authentication** - Complete
- ✅ **WireGuard CRUD** - Complete
- ⏳ **Communications** - Pending (Phase 2)
- ⏳ **Real-Time** - Pending (Phase 2)

## 🚀 CI/CD Integration

Tests run automatically in GitHub Actions on:
- Push to `main`, `develop`, `feature/*` branches
- Pull requests to `main`, `develop`

See: `.github/workflows/integration-tests.yml`

**What CI Does:**
1. Starts PostgreSQL and Redis
2. Runs database migrations
3. Starts backend server
4. Builds and starts frontend
5. Runs all integration tests
6. Uploads test reports as artifacts
7. Generates test summary

## 📚 Resources

### Documentation
- [Playwright Docs](https://playwright.dev)
- [Testing Library](https://testing-library.com)
- [Page Object Model](https://playwright.dev/docs/pom)

### Internal Docs
- `/docs/INTEGRATION_TESTING_PLAN.md` - Detailed test specifications
- `/docs/TESTING_SUMMARY.md` - Quick reference
- `/docs/SESSION_COMPLETE_SUMMARY.md` - Feature overview

## 💡 Tips

### Speed Up Tests

1. **Run in Parallel**
   ```bash
   pnpm exec playwright test --workers=4
   ```

2. **Run Only Changed**
   ```bash
   pnpm exec playwright test --only-changed
   ```

3. **Use Headed Mode Selectively**
   ```bash
   # Faster (headless)
   pnpm test:integration

   # Slower but visible (headed)
   pnpm test:integration:headed
   ```

### Debugging Flaky Tests

1. **Increase Timeout**
   ```typescript
   test('flaky test', async ({ page }) => {
     test.setTimeout(60000); // 60 seconds
   });
   ```

2. **Add Explicit Waits**
   ```typescript
   await page.waitForLoadState('networkidle');
   await page.waitForSelector('[data-testid="loaded"]');
   ```

3. **Check Race Conditions**
   - Ensure cleanup runs after all async operations
   - Use proper database transactions
   - Verify state before assertions

## 🎉 Success!

You now have:
- ✅ 97 integration tests covering core features
- ✅ Reusable test infrastructure (fixtures, helpers, page objects)
- ✅ CI/CD pipeline for automated testing
- ✅ Clear documentation and examples

**Ready to write more tests? Follow the patterns above!**
