/**
 * MSW Handlers for API Keys Endpoints
 *
 * These handlers intercept API key-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  APIKey,
  APIKeyCreateResponse,
  APIKeyCreateRequest,
  APIKeyUpdateRequest,
  APIKeyListResponse,
  AvailableScopes,
} from "../../../hooks/useApiKeys";

// In-memory storage for test data
let apiKeys: APIKey[] = [];
let nextApiKeyId = 1;

// Reset storage between tests
export function resetApiKeysStorage() {
  apiKeys = [];
  nextApiKeyId = 1;
}

// Helper to create an API key
export function createMockApiKey(overrides?: Partial<APIKey>): APIKey {
  return {
    id: `key-${nextApiKeyId++}`,
    name: "Test API Key",
    scopes: ["read:subscribers"],
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Test API key for testing",
    last_used_at: null,
    is_active: true,
    key_preview: "sk_test_**********************1234",
    ...overrides,
  };
}

// Helper to create available scopes
export function createMockAvailableScopes(): AvailableScopes {
  return {
    "read:subscribers": {
      name: "Read Subscribers",
      description: "Read subscriber information",
    },
    "write:subscribers": {
      name: "Write Subscribers",
      description: "Create and update subscribers",
    },
    "delete:subscribers": {
      name: "Delete Subscribers",
      description: "Delete subscribers",
    },
    "read:billing": {
      name: "Read Billing",
      description: "Read billing information",
    },
    "write:billing": {
      name: "Write Billing",
      description: "Create and update billing records",
    },
  };
}

// Helper to seed initial data
export function seedApiKeysData(keys: APIKey[]) {
  apiKeys = [...keys];
}

export const apiKeysHandlers = [
  // GET /api/v1/auth/api-keys - List API keys with pagination
  http.get("*/api/v1/auth/api-keys", ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    console.log("[MSW] GET /api/v1/auth/api-keys", { page, limit, totalKeys: apiKeys.length });

    // Calculate pagination
    const offset = (page - 1) * limit;
    const paginated = apiKeys.slice(offset, offset + limit);

    console.log("[MSW] Returning", paginated.length, "API keys");

    const response: APIKeyListResponse = {
      api_keys: paginated,
      total: apiKeys.length,
      page,
      limit,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/auth/api-keys/scopes/available - Get available scopes
  http.get("*/api/v1/auth/api-keys/scopes/available", ({ request, params }) => {
    console.log("[MSW] GET /api/v1/auth/api-keys/scopes/available");
    const scopes = createMockAvailableScopes();
    return HttpResponse.json(scopes);
  }),

  // POST /api/v1/auth/api-keys - Create API key
  http.post("*/api/v1/auth/api-keys", async ({ request, params }) => {
    const data = (await request.json()) as APIKeyCreateRequest;

    console.log("[MSW] POST /api/v1/auth/api-keys", data);

    const newKey: APIKeyCreateResponse = {
      ...createMockApiKey({
        name: data.name,
        scopes: data.scopes,
        expires_at: data.expires_at,
        description: data.description,
      }),
      api_key: `sk_test_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    };

    apiKeys.push(newKey);

    console.log("[MSW] Created API key", newKey.id);

    return HttpResponse.json(newKey, { status: 201 });
  }),

  // PATCH /api/v1/auth/api-keys/:id - Update API key
  http.patch("*/api/v1/auth/api-keys/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as APIKeyUpdateRequest;

    console.log("[MSW] PATCH /api/v1/auth/api-keys/:id", { id, updates });

    const index = apiKeys.findIndex((key) => key.id === id);

    if (index === -1) {
      console.log("[MSW] API key not found", id);
      return HttpResponse.json({ error: "API key not found", code: "NOT_FOUND" }, { status: 404 });
    }

    apiKeys[index] = {
      ...apiKeys[index],
      ...updates,
    };

    console.log("[MSW] Updated API key", apiKeys[index].id);

    return HttpResponse.json(apiKeys[index]);
  }),

  // DELETE /api/v1/auth/api-keys/:id - Revoke API key
  http.delete("*/api/v1/auth/api-keys/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] DELETE /api/v1/auth/api-keys/:id", { id });

    const index = apiKeys.findIndex((key) => key.id === id);

    if (index === -1) {
      console.log("[MSW] API key not found", id);
      return HttpResponse.json({ error: "API key not found", code: "NOT_FOUND" }, { status: 404 });
    }

    apiKeys.splice(index, 1);

    console.log("[MSW] Deleted API key", id);

    return new HttpResponse(null, { status: 204 });
  }),
];
