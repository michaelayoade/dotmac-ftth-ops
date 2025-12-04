# MSW (Mock Service Worker) Setup

This directory contains MSW configuration for API mocking and contract validation.

## Overview

MSW intercepts network requests at the service worker level and can either:

1. **Proxy Mode** (default): Forward requests to real backend while validating contracts
2. **Mock Mode**: Return deterministic data for isolated UI testing

## Files

- **`handlers.ts`**: Request handlers with backend proxy and contract validation
- **`browser.ts`**: MSW setup for browser environment (development, Storybook)
- **`server.ts`**: MSW setup for Node.js environment (Jest, Vitest, Playwright)
- **`README.md`**: This file

## Usage

### Development Mode (Optional)

Enable MSW in development to intercept and validate API calls:

```bash
# Enable MSW in development
export NEXT_PUBLIC_MSW_ENABLED=true

# Start dev server
pnpm dev
```

MSW will proxy all API calls to the backend while validating contracts in browser console.

### Playwright E2E Tests

MSW is automatically configured for Playwright tests:

```bash
# Run MSW contract validation tests
cd frontend/e2e
npx playwright test tests/msw-contract-validation.spec.ts

# Run with proxy mode (default)
MSW_MODE=proxy npx playwright test

# Run with mock mode (deterministic data)
MSW_MODE=mock npx playwright test
```

### Component Tests (Future)

```typescript
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('component renders with API data', async () => {
  // MSW will intercept and proxy API calls
  render(<MyComponent />);
  // ... assertions
});
```

## Contract Validation

MSW handlers validate that responses match TypeScript interfaces:

```typescript
// handlers.ts validates this contract
interface Integration {
  name: string;
  type: string;
  provider: string;
  enabled: boolean;
  status: string;
  settings_count: number;
  has_secrets: boolean;
  required_packages: string[];
}
```

If backend response doesn't match:

- **Development**: Error logged in browser console
- **Tests**: Request passes through (falls back to direct API call)

## Adding New Handlers

### Proxy Handler (with contract validation)

```typescript
// handlers.ts
http.get(`${API_BASE}/your-endpoint`, async ({ request }) => {
  try {
    // Forward to real backend
    const response = await fetch(new URL(request.url, BACKEND_URL), {
      headers: request.headers,
    });

    if (!response.ok) {
      return passthrough();
    }

    const data = await response.json();

    // Validate contract
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Response must have items array');
    }

    // Validate each item
    data.items.forEach((item: any) => {
      if (typeof item.id !== 'string') {
        throw new Error('item.id must be string');
      }
      // ... more validations
    });

    return HttpResponse.json(data);
  } catch (error) {
    console.error('MSW Contract Validation Error:', error);
    return passthrough();
  }
}),
```

### Mock Handler (deterministic data)

```typescript
// handlers.ts - mockHandlers array
http.get(`${API_BASE}/your-endpoint`, () => {
  return HttpResponse.json({
    items: [
      {
        id: 'item-1',
        name: 'Test Item',
        status: 'active',
      },
    ],
    total: 1,
  });
}),
```

## Testing Strategy

### Layer 1: Backend Smoke Tests (Fastest)

```bash
pytest tests/integration/test_frontend_backend_smoke.py -v
```

Validates endpoint existence and basic response structure.

### Layer 2: MSW Contract Tests (Fast)

```bash
npx playwright test tests/msw-contract-validation.spec.ts
```

Validates TypeScript interfaces match backend Pydantic models.

### Layer 3: Full E2E Tests (Comprehensive)

```bash
npx playwright test tests/admin-*.spec.ts
```

Validates complete user journeys with real UI interactions.

## Benefits

✅ **Contract Enforcement**: Catch API breaking changes immediately
✅ **Fast Feedback**: Validates contracts without full E2E overhead
✅ **Type Safety**: Ensures TypeScript interfaces match backend models
✅ **Flexible Testing**: Switch between real backend and mocks
✅ **Development Aid**: Log contract violations during development

## Environment Variables

- `NEXT_PUBLIC_MSW_ENABLED`: Enable MSW in browser (default: false)
- `MSW_MODE`: Switch between 'proxy' and 'mock' modes (default: proxy)
- `BACKEND_URL`: Backend API URL (default: http://localhost:8000)

## Resources

- [MSW Documentation](https://mswjs.io/)
- [Playwright Testing](https://playwright.dev/)
- [API Contract Testing](https://martinfowler.com/articles/practical-test-pyramid.html)
