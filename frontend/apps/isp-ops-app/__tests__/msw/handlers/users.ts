/**
 * MSW Handlers for User API Endpoints
 *
 * These handlers intercept user-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { rest } from 'msw';
import type { User, UserUpdateRequest, UserListResponse } from '../../../hooks/useUsers';

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
    roles: ['user'],
    permissions: [],
    mfa_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    tenant_id: 'tenant-1',
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
  rest.get('*/users', (req, res, ctx) => {
    console.log('[MSW] GET /users', { totalUsers: users.length });

    const response: UserListResponse = {
      users,
      total: users.length,
      page: 1,
      per_page: 50,
    };

    return res(ctx.json(response));
  }),

  // GET /users/me - Get current user
  rest.get('*/users/me', (req, res, ctx) => {
    console.log('[MSW] GET /users/me');

    // Return the first user or create a default current user
    const currentUser = users.length > 0 ? users[0] : createMockUser({
      id: 'current-user',
      username: 'currentuser',
      email: 'current@example.com',
      full_name: 'Current User',
    });

    return res(ctx.json(currentUser));
  }),

  // GET /users/:id - Get single user
  rest.get('*/users/:id', (req, res, ctx) => {
    const { id } = req.params;

    console.log('[MSW] GET /users/:id', { id });

    const user = users.find((u) => u.id === id);

    if (!user) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found', code: 'NOT_FOUND' })
      );
    }

    return res(ctx.json(user));
  }),

  // PUT /users/:id - Update user
  rest.put('*/users/:id', (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body as UserUpdateRequest;

    console.log('[MSW] PUT /users/:id', { id, updates });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found', code: 'NOT_FOUND' })
      );
    }

    users[index] = {
      ...users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return res(ctx.json(users[index]));
  }),

  // DELETE /users/:id - Delete user
  rest.delete('*/users/:id', (req, res, ctx) => {
    const { id } = req.params;

    console.log('[MSW] DELETE /users/:id', { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found', code: 'NOT_FOUND' })
      );
    }

    users.splice(index, 1);

    return res(ctx.status(204));
  }),

  // POST /users/:id/disable - Disable user
  rest.post('*/users/:id/disable', (req, res, ctx) => {
    const { id } = req.params;

    console.log('[MSW] POST /users/:id/disable', { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found', code: 'NOT_FOUND' })
      );
    }

    users[index].is_active = false;
    users[index].updated_at = new Date().toISOString();

    return res(ctx.status(200), ctx.json(users[index]));
  }),

  // POST /users/:id/enable - Enable user
  rest.post('*/users/:id/enable', (req, res, ctx) => {
    const { id } = req.params;

    console.log('[MSW] POST /users/:id/enable', { id });

    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found', code: 'NOT_FOUND' })
      );
    }

    users[index].is_active = true;
    users[index].updated_at = new Date().toISOString();

    return res(ctx.status(200), ctx.json(users[index]));
  }),
];
