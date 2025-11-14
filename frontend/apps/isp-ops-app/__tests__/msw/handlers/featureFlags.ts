/**
 * MSW Handlers for Feature Flags Endpoints
 *
 * These handlers intercept feature flags API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { rest } from 'msw';
import type { FeatureFlag, FlagStatus } from '../../../hooks/useFeatureFlags';

// In-memory storage for test data
let featureFlags: FeatureFlag[] = [];
let flagStatus: FlagStatus = {
  total_flags: 0,
  enabled_flags: 0,
  disabled_flags: 0,
  cache_hits: 0,
  cache_misses: 0,
};

// Reset storage between tests
export function resetFeatureFlagsStorage() {
  featureFlags = [];
  flagStatus = {
    total_flags: 0,
    enabled_flags: 0,
    disabled_flags: 0,
    cache_hits: 0,
    cache_misses: 0,
  };
}

// Helper to create a feature flag
export function createMockFeatureFlag(overrides?: Partial<FeatureFlag>): FeatureFlag {
  return {
    name: 'test-feature',
    enabled: false,
    context: {},
    description: 'Test feature flag',
    updated_at: Date.now(),
    created_at: Date.now(),
    ...overrides,
  };
}

// Helper to create flag status
export function createMockFlagStatus(overrides?: Partial<FlagStatus>): FlagStatus {
  return {
    total_flags: featureFlags.length,
    enabled_flags: featureFlags.filter((f) => f.enabled).length,
    disabled_flags: featureFlags.filter((f) => !f.enabled).length,
    cache_hits: 100,
    cache_misses: 10,
    last_sync: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedFeatureFlagsData(flags: FeatureFlag[], status?: FlagStatus) {
  featureFlags = [...flags];
  if (status) {
    flagStatus = status;
  } else {
    // Auto-calculate status from flags
    flagStatus = createMockFlagStatus();
  }
}

export const featureFlagsHandlers = [
  // GET /api/v1/feature-flags/flags - List feature flags
  rest.get('*/api/v1/feature-flags/flags', (req, res, ctx) => {
    const url = new URL(req.url);
    const enabledOnly = url.searchParams.get('enabled_only') === 'true';

    console.log('[MSW] GET /api/v1/feature-flags/flags', { enabledOnly, totalFlags: featureFlags.length });

    let filtered = featureFlags;
    if (enabledOnly) {
      filtered = featureFlags.filter((flag) => flag.enabled);
    }

    console.log('[MSW] Returning', filtered.length, 'flags');

    // Hook expects response.data to be array directly, OR response.data.data
    // Since axios wraps in response.data, just return the array
    return res(ctx.json(filtered));
  }),

  // GET /api/v1/feature-flags/status - Get flag status
  rest.get('*/api/v1/feature-flags/status', (req, res, ctx) => {
    console.log('[MSW] GET /api/v1/feature-flags/status');

    // Update status counts based on current flags
    const status = createMockFlagStatus();

    // Hook expects response.data to be the status object
    return res(ctx.json(status));
  }),

  // PUT /api/v1/feature-flags/flags/:name - Toggle flag
  rest.put('*/api/v1/feature-flags/flags/:name', async (req, res, ctx) => {
    const { name } = req.params;
    const body = await req.json() as { enabled: boolean };

    console.log('[MSW] PUT /api/v1/feature-flags/flags/:name', { name, enabled: body.enabled });

    const flag = featureFlags.find((f) => f.name === name);

    if (!flag) {
      console.log('[MSW] Flag not found', name);
      return res(
        ctx.status(404),
        ctx.json({ error: 'Feature flag not found', code: 'NOT_FOUND' })
      );
    }

    // Update flag
    flag.enabled = body.enabled;
    flag.updated_at = Date.now();

    console.log('[MSW] Toggled flag', name, 'to', body.enabled);

    return res(ctx.json(flag));
  }),

  // POST /api/v1/feature-flags/flags/:name - Create flag
  rest.post('*/api/v1/feature-flags/flags/:name', async (req, res, ctx) => {
    const { name } = req.params;
    const body = await req.json() as Partial<FeatureFlag>;

    console.log('[MSW] POST /api/v1/feature-flags/flags/:name', { name, body });

    // Check if flag already exists
    const existingFlag = featureFlags.find((f) => f.name === name);
    if (existingFlag) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Feature flag already exists', code: 'ALREADY_EXISTS' })
      );
    }

    const newFlag = createMockFeatureFlag({
      name: name as string,
      enabled: body.enabled ?? false,
      context: body.context ?? {},
      description: body.description,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    featureFlags.push(newFlag);

    console.log('[MSW] Created flag', name);

    return res(ctx.status(201), ctx.json(newFlag));
  }),

  // DELETE /api/v1/feature-flags/flags/:name - Delete flag
  rest.delete('*/api/v1/feature-flags/flags/:name', (req, res, ctx) => {
    const { name } = req.params;

    console.log('[MSW] DELETE /api/v1/feature-flags/flags/:name', { name });

    const index = featureFlags.findIndex((f) => f.name === name);

    if (index === -1) {
      console.log('[MSW] Flag not found', name);
      return res(
        ctx.status(404),
        ctx.json({ error: 'Feature flag not found', code: 'NOT_FOUND' })
      );
    }

    featureFlags.splice(index, 1);

    console.log('[MSW] Deleted flag', name);

    return res(ctx.status(204));
  }),
];
