# Comprehensive Testing Guide

This guide covers testing all pages and functionality across both the ISP Ops and Platform Admin applications.

## Quick Start

```bash
# 1. Start backend (in one terminal)
make dev

# 2. Start frontend apps (in another terminal)
cd frontend
pnpm dev:isp     # ISP Ops on port 3001
pnpm dev:admin   # Platform Admin on port 3002

# 3. Run E2E tests (in another terminal)
cd frontend
pnpm e2e              # Headless mode
pnpm e2e:headed       # With browser visible
pnpm e2e:ui           # Interactive UI mode
```

## Testing Approaches

### 1. Automated E2E Testing (Playwright)

**Run all tests:**
```bash
cd frontend
pnpm e2e
```

**Run specific test suites:**
```bash
# Authentication tests
pnpm e2e tests/auth

# User journey tests
pnpm e2e tests/journeys

# API integration tests
pnpm e2e tests/api

# Visual regression tests
pnpm e2e tests/visual-regression

# Accessibility tests
pnpm e2e tests/accessibility
```

**Run specific test file:**
```bash
pnpm e2e tests/auth/login.spec.ts
```

**Debug mode (with browser and inspector):**
```bash
pnpm e2e:headed --debug
```

**Generate test report:**
```bash
pnpm e2e --reporter=html
npx playwright show-report
```

### 2. Manual Testing with Browser Inspector

**Start browser inspector:**
```bash
# ISP Ops App
node scripts/browser-inspector.mjs http://localhost:3001

# Platform Admin App
node scripts/browser-inspector.mjs http://localhost:3002

# With screenshot capture
node scripts/browser-inspector.mjs http://localhost:3001 --screenshot
```

The browser inspector will:
- Open Chrome with DevTools
- Capture all console logs
- Show network errors
- Display page metrics
- Keep browser open for manual testing

### 3. Component Testing (Jest)

**Run unit tests:**
```bash
# All unit tests
cd frontend
pnpm test

# Specific app
cd apps/isp-ops-app
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### 4. API Testing

**Backend API tests:**
```bash
# Python backend tests
cd /path/to/backend
poetry run pytest tests/

# Specific test file
poetry run pytest tests/radius/test_radius_service.py

# With coverage
poetry run pytest --cov=src tests/
```

## Page-by-Page Testing Checklist

### ISP Ops App (Port 3001)

#### Authentication & Access
- [ ] `/login` - Login page renders, form validation works
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials shows error
- [ ] Logout clears session

#### Customer Portal (Public-Facing)
- [ ] `/customer-portal` - Dashboard loads
- [ ] `/customer-portal/billing` - Billing info displays
- [ ] `/customer-portal/usage` - Usage stats show correctly
- [ ] `/customer-portal/service` - Service status visible
- [ ] `/customer-portal/support` - Support tickets load
- [ ] `/customer-portal/settings` - Settings can be updated

#### Dashboard Home
- [ ] `/dashboard` - Main dashboard renders
- [ ] Widgets display correct data
- [ ] Real-time updates work
- [ ] Navigation menu accessible

#### Subscribers Management
- [ ] `/dashboard/subscribers` - List loads with pagination
- [ ] Search/filter functionality works
- [ ] Click subscriber navigates to detail view
- [ ] Bulk actions work (if applicable)

#### RADIUS Management
- [ ] `/dashboard/radius` - RADIUS dashboard loads
- [ ] `/dashboard/radius/sessions` - Active sessions display
- [ ] `/dashboard/radius/subscribers` - Subscriber list loads
- [ ] `/dashboard/radius/subscribers/new` - Create new subscriber
- [ ] `/dashboard/radius/subscribers/[id]/edit` - Edit subscriber
- [ ] `/dashboard/radius/nas` - NAS devices list
- [ ] `/dashboard/radius/bandwidth-profiles` - Bandwidth profiles

#### Network Management
- [ ] `/dashboard/network` - Network dashboard
- [ ] `/dashboard/network/faults` - Fault list loads
- [ ] `/dashboard/network/sessions/live` - Live sessions display
- [ ] `/dashboard/network/fiber` - Fiber management
- [ ] `/dashboard/network/wireguard` - WireGuard VPN management

#### Devices (TR-069/GenieACS)
- [ ] `/dashboard/devices` - Device list loads
- [ ] `/dashboard/devices/[id]` - Device details display
- [ ] `/dashboard/devices/[id]/diagnostics` - Diagnostics work
- [ ] `/dashboard/devices/[id]/firmware` - Firmware management
- [ ] `/dashboard/devices/provision` - Device provisioning

#### PON/GPON Management
- [ ] `/dashboard/pon/olts` - OLT list loads
- [ ] `/dashboard/pon/onus` - ONU list loads
- [ ] `/dashboard/pon/onus/discover` - ONU discovery works

#### Billing & Revenue
- [ ] `/dashboard/billing-revenue` - Billing dashboard
- [ ] `/dashboard/billing-revenue/invoices` - Invoice list
- [ ] `/dashboard/billing-revenue/payments` - Payment history
- [ ] `/dashboard/billing-revenue/receipts` - Receipt list
- [ ] `/dashboard/billing-revenue/subscriptions` - Subscriptions
- [ ] `/dashboard/billing-revenue/plans` - Plan management
- [ ] `/dashboard/billing-revenue/credit-notes` - Credit notes

#### Communications
- [ ] `/dashboard/communications` - Communications dashboard
- [ ] `/dashboard/communications/send` - Send messages/notifications
- [ ] `/dashboard/communications/templates` - Template management

#### CRM
- [ ] `/dashboard/crm` - CRM dashboard
- [ ] `/dashboard/crm/contacts` - Contact list
- [ ] `/dashboard/crm/contacts/new` - Create contact
- [ ] `/dashboard/crm/leads` - Lead management
- [ ] `/dashboard/crm/quotes` - Quote management

#### Automation (Ansible)
- [ ] `/dashboard/automation` - Automation dashboard
- [ ] `/dashboard/automation/playbooks` - Playbook list
- [ ] `/dashboard/automation/jobs` - Job history
- [ ] `/dashboard/automation/inventory` - Inventory management

#### Analytics & Reports
- [ ] `/dashboard/analytics` - Analytics dashboard
- [ ] `/dashboard/analytics/advanced` - Advanced analytics
- [ ] Charts and graphs render correctly
- [ ] Export functionality works

#### Settings
- [ ] `/dashboard/settings` - Settings dashboard
- [ ] `/dashboard/settings/profile` - User profile update
- [ ] `/dashboard/settings/organization` - Org settings
- [ ] `/dashboard/settings/integrations` - Integration config
- [ ] `/dashboard/settings/security` - Security settings
- [ ] `/dashboard/settings/notifications` - Notification prefs

#### Infrastructure
- [ ] `/dashboard/infrastructure/health` - System health
- [ ] `/dashboard/infrastructure/logs` - Log viewer
- [ ] `/dashboard/infrastructure/status` - Status page
- [ ] `/dashboard/infrastructure/feature-flags` - Feature flags

### Platform Admin App (Port 3002)

#### Platform Administration
- [ ] `/dashboard/platform-admin` - Admin dashboard
- [ ] `/dashboard/platform-admin/tenants` - Tenant management
- [ ] `/dashboard/platform-admin/audit` - Audit logs
- [ ] `/dashboard/platform-admin/system` - System settings
- [ ] `/dashboard/platform-admin/licensing` - License management

#### Tenant Portal
- [ ] `/tenant-portal` - Tenant dashboard
- [ ] `/tenant-portal/billing` - Tenant billing
- [ ] `/tenant-portal/subscription` - Subscription management
- [ ] `/tenant-portal/customers` - Customer management
- [ ] `/tenant-portal/users` - User management

#### Security & Access
- [ ] `/dashboard/security-access` - Security dashboard
- [ ] `/dashboard/security-access/users` - User management
- [ ] `/dashboard/security-access/roles` - Role management
- [ ] `/dashboard/security-access/permissions` - Permission config
- [ ] `/dashboard/security-access/api-keys` - API key management

#### Licensing
- [ ] `/dashboard/licensing` - License dashboard
- [ ] License activation works
- [ ] License usage tracking accurate

#### Partner Management
- [ ] `/dashboard/partners` - Partner list
- [ ] `/dashboard/partners/[id]` - Partner details
- [ ] `/dashboard/partners/onboarding` - Partner onboarding
- [ ] `/dashboard/partners/revenue` - Revenue sharing

## Functional Testing Checklist

### Core Workflows

#### 1. Subscriber Provisioning Flow
- [ ] Create new subscriber
- [ ] Assign bandwidth profile
- [ ] Provision network access
- [ ] Verify RADIUS session
- [ ] Test connectivity

#### 2. Billing Cycle
- [ ] Generate invoice
- [ ] Record payment
- [ ] Apply credit
- [ ] Issue credit note
- [ ] Reconcile payments

#### 3. Support Ticket Flow
- [ ] Create ticket
- [ ] Assign to agent
- [ ] Add comments
- [ ] Change status
- [ ] Close ticket

#### 4. Device Management
- [ ] Discover device
- [ ] Provision device
- [ ] Update firmware
- [ ] Run diagnostics
- [ ] Decommission device

### Integration Testing

#### External Integrations
- [ ] RADIUS server communication
- [ ] GenieACS device management
- [ ] Billing system sync
- [ ] Email notifications sent
- [ ] SMS notifications sent
- [ ] Webhook deliveries work

#### API Testing
- [ ] REST API endpoints respond
- [ ] GraphQL queries work
- [ ] Authentication required
- [ ] Rate limiting enforced
- [ ] Error responses correct

### Performance Testing

- [ ] Page load times < 3 seconds
- [ ] Large lists paginate properly
- [ ] Search results return quickly
- [ ] Real-time updates don't lag
- [ ] No memory leaks in long sessions

### Security Testing

- [ ] Authentication required for protected pages
- [ ] Authorization enforced (RBAC)
- [ ] XSS protection works
- [ ] CSRF tokens validated
- [ ] SQL injection prevented
- [ ] API rate limiting works
- [ ] Secrets not exposed in frontend

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Sufficient color contrast
- [ ] Focus indicators visible
- [ ] ARIA labels present

### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Responsiveness

- [ ] Mobile layout renders correctly
- [ ] Touch interactions work
- [ ] Tables scroll horizontally
- [ ] Modals fit screen

## Test Data Setup

### Create Test Users

```bash
# Create test users via script
cd backend
poetry run python scripts/create-test-users.py

# Or via API
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "tenant_name": "Test ISP"
  }'
```

### Seed Test Data

```bash
# Run database migrations
cd backend
poetry run alembic upgrade head

# Seed test data
poetry run python scripts/seed-test-data.py
```

## Debugging Failed Tests

### Check Playwright Traces

```bash
# Tests automatically save traces on failure
npx playwright show-trace test-results/trace.zip
```

### View Screenshots

```bash
# Screenshots saved to test-results/ on failure
open test-results/*/test-failed-*.png
```

### Check Console Logs

Use the browser inspector tool to capture real-time logs:
```bash
node scripts/browser-inspector.mjs http://localhost:3001 > logs.txt
```

### Debug Backend Issues

```bash
# Check backend logs
cd backend
tail -f logs/app.log

# Run backend in debug mode
poetry run python -m debugpy --listen 5678 -m uvicorn src.dotmac.platform.main:app --reload
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Every push to main
- Every pull request
- Nightly schedule

View results at: `https://github.com/your-org/your-repo/actions`

### Local CI Simulation

```bash
# Run all checks locally
make ci

# Or individually
pnpm lint
pnpm type-check
pnpm test
pnpm e2e
```

## Test Coverage Reports

### Frontend Coverage

```bash
cd frontend
pnpm test:coverage

# View HTML report
open apps/isp-ops-app/coverage/lcov-report/index.html
```

### Backend Coverage

```bash
cd backend
poetry run pytest --cov=src --cov-report=html tests/

# View HTML report
open htmlcov/index.html
```

## Testing Best Practices

1. **Write tests for bugs** - Before fixing a bug, write a failing test
2. **Test user flows** - Focus on complete user journeys, not just pages
3. **Use realistic data** - Test with data similar to production
4. **Test error cases** - Don't just test the happy path
5. **Keep tests independent** - Tests should not depend on each other
6. **Use page objects** - Reduce duplication with page object pattern
7. **Run tests in CI** - Automate testing on every commit
8. **Monitor flaky tests** - Fix or skip tests that fail intermittently

## Common Issues & Solutions

### Backend Not Running

```bash
# Check if backend is running
curl http://localhost:8000/api/v1/health

# Start backend
make dev
```

### Frontend Build Errors

```bash
# Clean and rebuild
cd frontend
pnpm clean
pnpm install
pnpm --filter @dotmac/headless build
pnpm --filter @dotmac/primitives build
pnpm build
```

### Database Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Reset database
make db-reset
```

### Port Already in Use

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3003 pnpm dev
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
