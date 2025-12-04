/**
 * MSW Handlers for User API Endpoints
 *
 * These handlers intercept user-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { User, UserUpdateRequest, UserListResponse } from "../../../hooks/useUsers";

// In-memory storage for test data
let users: User[] = [];
let nextUserId = 1;

// Reset storage between tests
export function resetUserStorage() {
  users = [];
  nextUserId = 1;
}

// Helper to create a user
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: `user-${nextUserId++}`,
    username: `user${nextUserId}`,
    email: `user${nextUserId}@example.com`,
    full_name: `User ${nextUserId}`,
    is_active: true,
    is_verified: true,
    is_superuser: false,
    is_platform_admin: false,
    roles: ["user"],
    permissions: [],
    mfa_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    tenant_id: "tenant-1",
    phone_number: null,
    avatar_url: null,
    ...overrides,
  };
}

// Helper to seed initial data
export function seedUserData(usersData: User[]) {
  users = [...usersData];
}

export const userHandlers = [
  // GET /users - List all users
  http.get("*/users", ({ request, params }) => {
    console.log("[MSW] GET /users", { totalUsers: users.length });

    const response: UserListResponse = {
      users,
      total: users.length,
      page: 1,
      per_page: 50,
    };

    return HttpResponse.json(response);
  }),

  // GET /users/me - Get current user
  http.get("*/users/me", ({ request, params }) => {
    console.log("[MSW] GET /users/me");

    // Return the first user or create a default current user
    const currentUser =
      users.length > 0
        ? users[0]
        : createMockUser({
            id: "current-user",
            username: "currentuser",
            email: "current@example.com",
            full_name: "Current User",
          });

    return HttpResponse.json(currentUser);
  }),

  // GET /users/:id - Get single user
  http.get("*/users/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] GET /users/:id", { id });

    const user = users.find((u) => u.id === id);

    if (!user) {
      return HttpResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return HttpResponse.json(user);
  }),

  // PUT /users/:id - Update user
  http.put("*/users/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as UserUpdateRequest;

    console.log("[MSW] PUT /users/:id", { id, updates });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    users[index] = {
      ...users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(users[index]);
  }),

  // DELETE /users/:id - Delete user
  http.delete("*/users/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] DELETE /users/:id", { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    users.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /users/:id/disable - Disable user
  http.post("*/users/:id/disable", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /users/:id/disable", { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    users[index].is_active = false;
    users[index].updated_at = new Date().toISOString();

    return HttpResponse.json(users[index], { status: 200 });
  }),

  // POST /users/:id/enable - Enable user
  http.post("*/users/:id/enable", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /users/:id/enable", { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    users[index].is_active = true;
    users[index].updated_at = new Date().toISOString();

    return HttpResponse.json(users[index], { status: 200 });
  }),
];
