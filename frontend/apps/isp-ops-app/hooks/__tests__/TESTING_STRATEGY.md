# Frontend Testing Strategy for useLicensing

## Overview

We use a **two-tier testing approach** for the `useLicensing` hook:

1. **Unit Tests** (Jest mocks) - Fast, isolated tests
2. **Integration Tests** (MSW) - Realistic API interaction tests

---

## File Structure

```
hooks/
├── __tests__/
│   ├── useLicensing.test.tsx          ← Unit tests (Jest mocks)
│   └── useLicensing.msw.test.tsx      ← Integration tests (MSW)
└── useLicensing.ts                     ← Hook implementation
```

---

## Unit Tests (`useLicensing.test.tsx`)

### Purpose

- **Fast execution** (~4.5s for 45 tests)
- **Isolated testing** - Mocks API client directly
- **Test hook logic** - Focus on business logic, not API integration
- **Run frequently** - In watch mode during development

### What It Tests

✅ Query key factory correctness
✅ Data fetching and transformation
✅ Loading states
✅ Error handling
✅ Cache invalidation logic
✅ Mutation behavior
✅ Hook return values

### Key Features

```typescript
// Mock the API client directly
jest.mock("../../lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Helper to mock all GET requests
const mockAllQueries = (overrides?: {...}) => {...};
```

### When to Run

```bash
# Watch mode during development
pnpm test --watch hooks/__tests__/useLicensing.test.tsx

# Single run for CI/CD
pnpm test hooks/__tests__/useLicensing.test.tsx
```

### Test Coverage

- **45 tests** covering all hook functionality
- **100% passing** rate
- **~4.5 seconds** execution time

---

## Integration Tests (`useLicensing.msw.test.tsx`)

### Purpose

- **Realistic API mocking** - Uses MSW to mock HTTP requests
- **End-to-end behavior** - Tests full request/response cycle
- **API contract validation** - Ensures hook works with real API responses
- **Run before deployment** - Catch integration issues

### What It Tests

✅ Real API request/response flow
✅ HTTP error handling (404, 500, etc.)
✅ Data serialization/deserialization
✅ Query deduplication
✅ Concurrent requests
✅ Cache behavior with real data
✅ Edge cases with actual API responses

### Key Features

```typescript
// MSW handlers for realistic API mocking
import { setupServer } from 'msw/node';

// Seed functions for test data
seedModules([...]);
seedQuotas([...]);
```

### When to Run

```bash
# Full integration test suite
pnpm test hooks/__tests__/useLicensing.msw.test.tsx

# Before deployment
pnpm test:integration
```

### Test Coverage

- **70 tests** covering all integration scenarios
- **Real-world workflows** tested
- **~17 seconds** execution time

---

## Testing Pyramid

```
        E2E Tests (Playwright)
        Critical user flows
              /\
             /  \
            /    \
           /------\
          / Integration \      ← useLicensing.msw.test.tsx
         /  Tests (MSW)  \        ~70 tests, ~17s
        /                 \
       /-------------------\
      /    Unit Tests       \   ← useLicensing.test.tsx
     /    (Jest Mocks)       \     45 tests, ~4.5s
    /_______________________  \
```

---

## Best Practices

### ✅ DO

1. **Use unit tests for fast feedback**

   ```bash
   pnpm test --watch useLicensing.test.tsx
   ```

2. **Use integration tests before commits**

   ```bash
   pnpm test useLicensing.msw.test.tsx
   ```

3. **Mock at the right level**
   - Unit tests: Mock `apiClient`
   - Integration tests: Mock HTTP with MSW

4. **Test behavior, not implementation**

   ```typescript
   // Good
   expect(result.current.modules).toHaveLength(1);

   // Avoid
   expect(result.current.modulesQuery.data).toBeDefined();
   ```

5. **Use descriptive test names**
   ```typescript
   it("should invalidate cache after creating module", ...);
   // Not: it("test module creation", ...);
   ```

### ❌ DON'T

1. **Don't mix testing levels**

   ```typescript
   // Bad - Using MSW in unit tests
   // Use Jest mocks instead
   ```

2. **Don't test TanStack Query internals**

   ```typescript
   // Bad
   expect(queryClient.getQueryState(...).fetchStatus).toBe('idle');

   // Good
   expect(result.current.modulesLoading).toBe(false);
   ```

3. **Don't write brittle tests**

   ```typescript
   // Bad - Order dependent
   expect(mockApiClient.get).toHaveBeenNthCalledWith(1, ...);

   // Good - Order independent
   expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/modules");
   ```

---

## Running Tests

### Development Workflow

```bash
# 1. Start with unit tests (fast feedback)
pnpm test --watch useLicensing.test.tsx

# 2. Run integration tests before commit
pnpm test useLicensing.msw.test.tsx

# 3. Run all tests
pnpm test hooks/__tests__/useLicensing
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
- name: Unit Tests
  run: pnpm test hooks/__tests__/useLicensing.test.tsx

- name: Integration Tests
  run: pnpm test hooks/__tests__/useLicensing.msw.test.tsx
```

---

## Test Metrics

| Metric             | Unit Tests | Integration Tests |
| ------------------ | ---------- | ----------------- |
| **Test Count**     | 45         | 70                |
| **Execution Time** | ~4.5s      | ~17s              |
| **Pass Rate**      | 100%       | 100%              |
| **Coverage**       | Hook logic | API integration   |
| **When to Run**    | Always     | Before commit     |

---

## Debugging Failed Tests

### Unit Test Failures

1. **Check mock setup**

   ```typescript
   // Ensure all queries are mocked
   mockAllQueries({ modules: [...], quotas: [...] });
   ```

2. **Verify assertions**
   ```typescript
   // Check loading state cleared
   await waitFor(() => expect(result.current.modulesLoading).toBe(false));
   ```

### Integration Test Failures

1. **Check MSW handlers**

   ```typescript
   // Verify data is seeded
   seedModules([...]);
   ```

2. **Clear data between tests**
   ```typescript
   beforeEach(() => {
     clearLicensingData();
   });
   ```

---

## Summary

**Use Unit Tests (`useLicensing.test.tsx`) for:**

- ✅ Fast development feedback
- ✅ Testing hook logic
- ✅ Quick iterations
- ✅ TDD workflow

**Use Integration Tests (`useLicensing.msw.test.tsx`) for:**

- ✅ API contract validation
- ✅ Real-world scenarios
- ✅ Pre-deployment verification
- ✅ Regression testing

**Both test files are essential** and serve different purposes in ensuring the `useLicensing` hook works correctly! 🚀
