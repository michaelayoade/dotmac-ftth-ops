# Testing Guide for @dotmac/features Package

This guide explains how to write and run integration tests for the shared features package.

## Table of Contents

1. [Overview](#overview)
2. [Running Tests](#running-tests)
3. [Test Infrastructure](#test-infrastructure)
4. [Writing Tests](#writing-tests)
5. [Mock Patterns](#mock-patterns)
6. [Test Data Factories](#test-data-factories)
7. [Common Scenarios](#common-scenarios)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

The features package uses **Vitest** as the test runner and **React Testing Library** for component testing. All components follow a **Dependency Injection (DI) pattern**, which makes them highly testable.

### Test Stack

- **Vitest 3.2.4** - Fast unit test framework
- **@testing-library/react 16.1.0** - React component testing utilities
- **@testing-library/user-event 14.5.2** - User interaction simulation
- **@testing-library/jest-dom 6.6.3** - Custom DOM matchers
- **jsdom** - DOM implementation for Node.js

## Running Tests

### Basic Commands

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with UI interface
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

### Coverage Thresholds

The project enforces minimum coverage thresholds:

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Viewing Coverage

After running `pnpm test:coverage`, open the HTML report:

```bash
open coverage/index.html
```

## Test Infrastructure

### Directory Structure

```
src/
├── test/
│   ├── setup.ts                 # Global test setup
│   ├── mocks/
│   │   └── dependencies.ts      # DI dependency mocks
│   └── factories/
│       ├── billing.ts           # Billing test data
│       ├── crm.ts              # CRM test data
│       ├── network.ts          # Network test data
│       └── index.ts            # Export all factories
├── billing/
│   └── components/
│       ├── __tests__/
│       │   ├── InvoiceList.integration.test.tsx
│       │   └── RecordPaymentModal.integration.test.tsx
│       └── InvoiceList.tsx
└── crm/
    └── components/
        ├── __tests__/
        │   └── CreateLeadModal.integration.test.tsx
        └── CreateLeadModal.tsx
```

### Configuration

The test configuration is in `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // ... coverage settings
    },
  },
});
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBillingDependencies } from "../../../test/mocks/dependencies";
import { createMockInvoice } from "../../../test/factories/billing";
import InvoiceList from "../InvoiceList";

describe("InvoiceList Integration Tests", () => {
  let deps: ReturnType<typeof createBillingDependencies>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    deps = createBillingDependencies();
    user = userEvent.setup();
  });

  it("should fetch and display invoices", async () => {
    // Arrange
    const invoices = [createMockInvoice()];
    deps.apiClient.get.mockResolvedValue({ data: { invoices } });

    // Act
    render(
      <InvoiceList
        tenantId="test_tenant"
        onInvoiceSelect={undefined}
        {...deps}
      />
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText(invoices[0].invoice_number)).toBeInTheDocument();
    });
  });
});
```

### Testing Components with DI

All components in this package use Dependency Injection. Here's the pattern:

**Component Props:**

```typescript
interface InvoiceListProps {
  // Business props
  tenantId: string;
  onInvoiceSelect?: (invoice: Invoice) => void;

  // Injected dependencies
  apiClient: BillingApiClient;
  logger: Logger;
  router: Router;
  useConfirmDialog: () => BillingConfirmDialogFn;
}
```

**Test Setup:**

```typescript
import { createBillingDependencies } from "../../../test/mocks/dependencies";

const deps = createBillingDependencies();

render(<InvoiceList tenantId="test" {...deps} />);
```

## Mock Patterns

### Available Mock Factories

#### 1. API Client

```typescript
const apiClient = createMockApiClient();

// Mock successful response
apiClient.get.mockResolvedValue({ data: { invoices: [] } });

// Mock error
apiClient.get.mockRejectedValue(new Error("API Error"));

// Verify calls
expect(apiClient.get).toHaveBeenCalledWith("/billing/invoices");
```

#### 2. Logger

```typescript
const logger = createMockLogger();

// Verify error logging
expect(logger.error).toHaveBeenCalledWith("Error message", expect.any(Error), { context: "data" });
```

#### 3. Router

```typescript
const router = createMockRouter();

// Verify navigation
expect(router.push).toHaveBeenCalledWith("/dashboard/billing");
```

#### 4. Toast Notifications

```typescript
const useToast = createMockUseToast();
const toast = useToast();

// Verify toast was called
expect(toast.toast).toHaveBeenCalledWith({
  title: "Success",
  description: "Invoice created",
  variant: "default",
});
```

#### 5. Confirmation Dialog

```typescript
const useConfirmDialog = createMockUseConfirmDialog();
const confirmDialog = useConfirmDialog();

// Mock user confirming
confirmDialog.mockResolvedValue(true);

// Mock user canceling
confirmDialog.mockResolvedValue(false);
```

### Complete Dependency Sets

```typescript
// Billing module dependencies
const deps = createBillingDependencies();

// CRM module dependencies
const deps = createCRMDependencies();

// Network module dependencies
const deps = createNetworkDependencies();

// RADIUS module dependencies
const deps = createRadiusDependencies();
```

## Test Data Factories

### Billing Factories

```typescript
import {
  createMockInvoice,
  createOverdueInvoice,
  createPaidInvoice,
  createPartiallyPaidInvoice,
  createVoidedInvoice,
  createMockInvoices,
} from "../../../test/factories/billing";

// Create single invoice
const invoice = createMockInvoice({
  invoice_number: "INV-12345",
  total_amount: 150.0,
});

// Create multiple invoices
const invoices = createMockInvoices(5);

// Create specific invoice types
const overdueInvoice = createOverdueInvoice();
const paidInvoice = createPaidInvoice();
```

### CRM Factories

```typescript
import {
  createMockLead,
  createQualifiedLead,
  createConvertedLead,
  createMockActivity,
} from "../../../test/factories/crm";

const lead = createMockLead({
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
});

const activity = createMockActivity({
  type: "call",
  subject: "Follow-up call",
});
```

### Network Factories

```typescript
import {
  createMockONU,
  createOfflineONU,
  createPoorSignalONU,
} from "../../../test/factories/network";

const onu = createMockONU({
  serial_number: "ALCL00000001",
  status: "online",
});
```

## Common Scenarios

### 1. Testing Data Fetching

```typescript
it("should fetch and display data", async () => {
  const data = [createMockInvoice()];
  deps.apiClient.get.mockResolvedValue({ data: { invoices: data } });

  render(<InvoiceList {...deps} />);

  await waitFor(() => {
    expect(screen.getByText(data[0].invoice_number)).toBeInTheDocument();
  });
});
```

### 2. Testing Error Handling

```typescript
it("should handle API errors", async () => {
  deps.apiClient.get.mockRejectedValue(new Error("Network error"));

  render(<InvoiceList {...deps} />);

  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
  });

  expect(deps.logger.error).toHaveBeenCalled();
});
```

### 3. Testing User Interactions

```typescript
it("should handle button click", async () => {
  const onSelect = vi.fn();
  render(<InvoiceList onInvoiceSelect={onSelect} {...deps} />);

  const button = screen.getByRole("button", { name: /select/i });
  await user.click(button);

  expect(onSelect).toHaveBeenCalled();
});
```

### 4. Testing Form Submission

```typescript
it("should submit form with valid data", async () => {
  deps.apiClient.post.mockResolvedValue({ data: { success: true } });

  render(<CreateLeadModal {...deps} />);

  await user.type(screen.getByPlaceholderText(/first name/i), "John");
  await user.type(screen.getByPlaceholderText(/last name/i), "Doe");
  await user.click(screen.getByText(/submit/i));

  await waitFor(() => {
    expect(deps.apiClient.post).toHaveBeenCalledWith(
      "/api/leads",
      expect.objectContaining({
        first_name: "John",
        last_name: "Doe",
      })
    );
  });
});
```

### 5. Testing Loading States

```typescript
it("should show loading state", () => {
  let resolvePromise: any;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  deps.apiClient.get.mockReturnValue(promise as any);

  render(<InvoiceList {...deps} />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();

  // Cleanup
  resolvePromise({ data: { invoices: [] } });
});
```

## Best Practices

### 1. Test Observable Behavior

✅ **Good:** Test what users see and interact with

```typescript
expect(screen.getByText("Invoice created")).toBeInTheDocument();
```

❌ **Bad:** Test implementation details

```typescript
expect(component.state.invoices).toHaveLength(5);
```

### 2. Use Semantic Queries

Prefer queries in this order:

1. `getByRole` - Best for accessibility
2. `getByLabelText` - Good for forms
3. `getByPlaceholderText` - Forms without labels
4. `getByText` - Visible text content
5. `getByTestId` - Last resort

```typescript
// Best
screen.getByRole("button", { name: /submit/i });

// Good
screen.getByLabelText("Email");

// OK
screen.getByPlaceholderText("Enter email");

// Last resort
screen.getByTestId("submit-button");
```

### 3. Wait for Async Updates

Always use `waitFor` for asynchronous operations:

```typescript
await waitFor(() => {
  expect(screen.getByText("Success")).toBeInTheDocument();
});
```

### 4. Clean Mocks Between Tests

Mocks are automatically cleared in `beforeEach`, but you can also clear manually:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 5. Keep Tests Focused

Each test should verify ONE specific behavior:

✅ **Good:**

```typescript
it("should display error message when API fails", async () => {
  // Test only error display
});

it("should log error when API fails", async () => {
  // Test only error logging
});
```

❌ **Bad:**

```typescript
it("should handle errors correctly", async () => {
  // Tests multiple behaviors at once
});
```

## Troubleshooting

### Common Issues

#### 1. "act(...)" Warnings

**Problem:** State updates not wrapped in `act()`

**Solution:** Use `waitFor` for async updates:

```typescript
await waitFor(() => {
  expect(screen.getByText("Data loaded")).toBeInTheDocument();
});
```

#### 2. Element Not Found

**Problem:** Element doesn't exist in DOM

**Solution:**

- Use `screen.debug()` to see current DOM
- Check if element is rendered conditionally
- Verify correct query method

```typescript
screen.debug(); // Print current DOM
```

#### 3. Tests Timing Out

**Problem:** `waitFor` never resolves

**Solution:**

- Verify mock is returning expected data
- Check if component is actually calling the API
- Increase timeout if needed

```typescript
await waitFor(
  () => {
    expect(screen.getByText("Data")).toBeInTheDocument();
  },
  { timeout: 5000 },
); // Increase timeout
```

#### 4. Mock Not Working

**Problem:** Mock function not being called

**Solution:**

- Verify component receives the mock
- Check if component actually uses the dependency
- Ensure mock is set up before render

```typescript
// Set up mock BEFORE render
deps.apiClient.get.mockResolvedValue({ data: [] });
render(<Component {...deps} />);
```

### Debugging Tips

1. **Use `screen.debug()`** to see current DOM
2. **Use `screen.logTestingPlaygroundURL()`** for query suggestions
3. **Check mock call history:**
   ```typescript
   console.log(deps.apiClient.get.mock.calls);
   ```
4. **Run single test:**
   ```bash
   pnpm test -- InvoiceList.integration.test.tsx
   ```
5. **Enable verbose logging:**
   ```bash
   pnpm test -- --reporter=verbose
   ```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Docs](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [User Event API](https://testing-library.com/docs/user-event/intro)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new tests:

1. Follow the existing structure
2. Use factory functions for test data
3. Use dependency mocks consistently
4. Write clear test descriptions
5. Keep tests focused and independent
6. Aim for 70%+ coverage

## Questions?

If you have questions about testing, please:

1. Check this documentation
2. Review existing tests for examples
3. Ask in the team chat
