# Frontend Testing Quick Start Guide

**Current Status**: 93.9% pass rate (260/277 tests)

## Quick Commands

### Unit Tests (Jest + React Testing Library)

```bash
# Run all unit tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test PluginCard

# Watch mode
pnpm test:watch
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
pnpm exec playwright test

# Run specific test file
pnpm exec playwright test e2e/plugins.spec.ts

# Run with browser visible
pnpm exec playwright test --headed

# Run in debug mode
pnpm exec playwright test --debug

# View test report
pnpm exec playwright show-report
```

## Writing Tests with MSW

### 1. Basic Component Test

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /submit/i }));
    });

    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### 2. Testing Components with API Calls

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('DataComponent', () => {
  it('loads and displays data', async () => {
    // Use default MSW handlers
    render(<DataComponent />);

    await waitFor(() => {
      expect(screen.getByText('Data loaded')).toBeInTheDocument();
    });
  });

  it('handles API errors', async () => {
    // Override handler for this test
    server.use(
      http.get('*/api/v1/data', () => {
        return HttpResponse.json(
          { error: 'Failed to load' },
          { status: 500 }
        );
      })
    );

    render(<DataComponent />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });
});
```

### 3. Adding New MSW Handlers

Edit `__tests__/mocks/handlers.ts`:

```typescript
export const handlers = [
  // Add your handler
  http.get("*/api/v1/my-endpoint", () => {
    return HttpResponse.json({ data: "mock data" });
  }),

  // POST example
  http.post("*/api/v1/create", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "123", ...body });
  }),
];
```

## Common Patterns

### Testing User Events

```typescript
// Always wrap state updates in act()
const user = userEvent.setup();

await act(async () => {
  await user.click(button);
});

await act(async () => {
  await user.type(input, "text");
});
```

### Testing Forms

```typescript
it('submits form data', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn();

  render(<MyForm onSubmit={onSubmit} />);

  await act(async () => {
    await user.type(screen.getByLabelText('Name'), 'John');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));
  });

  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John',
    email: 'john@example.com',
  });
});
```

### Testing Async Data Loading

```typescript
it('shows loading then data', async () => {
  render(<DataComponent />);

  // Check loading state
  expect(screen.getByText('Loading...')).toBeInTheDocument();

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });

  // Loading should be gone
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});
```

### Testing Accessibility

```typescript
import { axe } from 'jest-axe';

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('has accessible labels', () => {
  render(<MyComponent />);

  // Buttons must have accessible names
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();

  // Form fields must have labels
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});
```

## Best Practices

### ✅ DO

- Use `screen.getByRole()` for better accessibility
- Wrap user interactions in `act()`
- Use MSW for API mocking
- Test user-facing behavior, not implementation
- Use `waitFor()` for async operations
- Write descriptive test names

```typescript
// Good
it("displays error message when API call fails", async () => {
  // ...
});

// Bad
it("test 1", () => {
  // ...
});
```

### ❌ DON'T

- Don't test implementation details
- Don't use `setTimeout` - use `waitFor` instead
- Don't mock entire components unless necessary
- Don't forget to clean up after tests
- Don't skip accessibility tests

## Debugging Tests

### Enable Verbose Output

```bash
pnpm test -- --verbose
```

### Debug Single Test

```typescript
import { debug } from '@testing-library/react';

it('my test', () => {
  const { container } = render(<MyComponent />);
  debug(container); // Prints DOM to console
});
```

### See What Queries Are Available

```typescript
import { screen } from "@testing-library/react";

screen.debug(); // Shows entire document
screen.debug(screen.getByRole("button")); // Shows specific element
```

### Common Errors

**Error**: "Unable to find element"

```typescript
// Check if element exists but is hidden
expect(screen.queryByText("text")).toBeInTheDocument();

// Wait for async elements
await waitFor(() => {
  expect(screen.getByText("text")).toBeInTheDocument();
});
```

**Error**: "Not wrapped in act()"

```typescript
// Wrap user events
await act(async () => {
  await user.click(button);
});
```

**Error**: "MSW handler not found"

```typescript
// Check handler URL pattern matches
http.get('*/api/v1/endpoint', ...) // Matches any base URL
http.get('http://localhost:3000/api/v1/endpoint', ...) // Exact match
```

## Coverage Goals

| Metric     | Target | Current |
| ---------- | ------ | ------- |
| Branches   | 60%    | TBD     |
| Functions  | 60%    | TBD     |
| Lines      | 60%    | TBD     |
| Statements | 60%    | TBD     |

## Quick Commands Reference

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run single file
pnpm test MyComponent

# Watch mode
pnpm test:watch

# Update snapshots
pnpm test -- -u

# Run only failed tests
pnpm test -- --onlyFailures

# Run E2E tests
pnpm test:e2e

# Run E2E in UI mode
pnpm test:e2e:ui
```

## Need Help?

- Check `TESTING_IMPROVEMENTS_SUMMARY.md` for detailed information
- Review example tests in `__tests__/pages/PluginsPage.msw.test.tsx`
- See MSW handlers in `__tests__/mocks/handlers.ts`
- Read [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro)
