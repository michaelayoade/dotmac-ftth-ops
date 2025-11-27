/**
 * Jest tests for useUsers hooks
 * Tests user management with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useUsers,
  useUser,
  useCurrentUser,
  useUpdateUser,
  useDeleteUser,
  useDisableUser,
  useEnableUser,
  getUserDisplayName,
  getUserStatus,
  getUserPrimaryRole,
  formatLastSeen,
} from "../useUsers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "@/lib/api/client";
import type { User } from "../useUsers";

// Mock apiClient
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  username: "testuser",
  email: "test@example.com",
  full_name: "Test User",
  is_active: true,
  is_verified: true,
  is_superuser: false,
  is_platform_admin: false,
  roles: [],
  permissions: [],
  mfa_enabled: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  last_login: null,
  tenant_id: "tenant-1",
  phone_number: null,
  avatar_url: null,
  ...overrides,
});

describe("useUsers (Jest)", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useUsers - fetch users", () => {
    it("should fetch users successfully", async () => {
      const mockUsers = [
        createMockUser({
          id: "user-1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
        }),
        createMockUser({
          id: "user-2",
          username: "janedoe",
          email: "jane@example.com",
          full_name: "Jane Doe",
        }),
      ];

      mockApiClient.get.mockResolvedValue({
        data: { users: mockUsers, total: 2, page: 1, per_page: 10 },
        status: 200,
      });

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("user-1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty user list", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 10 },
        status: 200,
      });

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useUser - fetch single user", () => {
    it("should fetch single user successfully", async () => {
      const user = createMockUser({
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
      });

      mockApiClient.get.mockResolvedValue({ data: user, status: 200 });

      const { result } = renderHook(() => useUser("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("user-1");
      expect(result.current.data?.username).toBe("johndoe");
    });

    it("should not fetch when userId is empty", () => {
      const { result } = renderHook(() => useUser(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle not found error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useUser("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCurrentUser", () => {
    it("should fetch current user successfully", async () => {
      const currentUser = createMockUser({
        id: "current-user",
        username: "currentuser",
        email: "current@example.com",
      });

      mockApiClient.get.mockResolvedValue({ data: currentUser, status: 200 });

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.username).toBe("currentuser");
    });
  });

  describe("useUpdateUser", () => {
    it("should update user successfully", async () => {
      const user = createMockUser({ id: "user-1", full_name: "John Updated" });

      mockApiClient.put.mockResolvedValue({ data: user, status: 200 });

      const { result } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      let updatedUser;
      await act(async () => {
        updatedUser = await result.current.mutateAsync({
          userId: "user-1",
          data: { full_name: "John Updated" },
        });
      });

      expect(updatedUser).toBeDefined();
      expect((updatedUser as any).full_name).toBe("John Updated");
    });

    it("should handle update error", async () => {
      mockApiClient.put.mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            userId: "user-1",
            data: { full_name: "Updated" },
          });
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe("useDeleteUser", () => {
    it("should delete user successfully", async () => {
      mockApiClient.delete.mockResolvedValue({ status: 204 });

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle delete error", async () => {
      mockApiClient.delete.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe("useDisableUser", () => {
    it("should disable user successfully", async () => {
      mockApiClient.post.mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle disable error", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Disable failed"));

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe("useEnableUser", () => {
    it("should enable user successfully", async () => {
      mockApiClient.post.mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle enable error", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Enable failed"));

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe("Utility Functions", () => {
    describe("getUserDisplayName", () => {
      it("should return full_name when available", () => {
        const user = createMockUser({ full_name: "John Doe", username: "johndoe" });
        expect(getUserDisplayName(user)).toBe("John Doe");
      });

      it("should return username when full_name is null", () => {
        const user = createMockUser({ full_name: null, username: "johndoe" });
        expect(getUserDisplayName(user)).toBe("johndoe");
      });

      it("should return email when both full_name and username are falsy", () => {
        const user = createMockUser({
          full_name: null,
          username: "",
          email: "john@example.com",
        });
        expect(getUserDisplayName(user)).toBe("john@example.com");
      });
    });

    describe("getUserStatus", () => {
      it("should return 'Suspended' when user is not active", () => {
        const user = createMockUser({ is_active: false, is_verified: true });
        expect(getUserStatus(user)).toBe("Suspended");
      });

      it("should return 'Invited' when user is active but not verified", () => {
        const user = createMockUser({ is_active: true, is_verified: false });
        expect(getUserStatus(user)).toBe("Invited");
      });

      it("should return 'Active' when user is active and verified", () => {
        const user = createMockUser({ is_active: true, is_verified: true });
        expect(getUserStatus(user)).toBe("Active");
      });
    });

    describe("getUserPrimaryRole", () => {
      it("should return 'Platform Admin' for platform admins", () => {
        const user = createMockUser({ is_platform_admin: true });
        expect(getUserPrimaryRole(user)).toBe("Platform Admin");
      });

      it("should return 'Superuser' for superusers", () => {
        const user = createMockUser({ is_superuser: true, is_platform_admin: false });
        expect(getUserPrimaryRole(user)).toBe("Superuser");
      });

      it("should return capitalized first role when available", () => {
        const user = createMockUser({
          is_superuser: false,
          is_platform_admin: false,
          roles: ["moderator", "editor"],
        });
        expect(getUserPrimaryRole(user)).toBe("Moderator");
      });

      it("should return 'User' when no special roles", () => {
        const user = createMockUser({
          is_superuser: false,
          is_platform_admin: false,
          roles: [],
        });
        expect(getUserPrimaryRole(user)).toBe("User");
      });
    });

    describe("formatLastSeen", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("should return 'Never' for null lastLogin", () => {
        expect(formatLastSeen(null)).toBe("Never");
      });

      it("should return 'Just now' for less than 1 minute ago", () => {
        const lastLogin = "2024-01-15T11:59:30Z";
        expect(formatLastSeen(lastLogin)).toBe("Just now");
      });

      it("should return minutes for less than 60 minutes ago", () => {
        const lastLogin = "2024-01-15T11:45:00Z";
        expect(formatLastSeen(lastLogin)).toBe("15 minutes ago");
      });

      it("should return hours for less than 24 hours ago", () => {
        const lastLogin = "2024-01-15T09:00:00Z";
        expect(formatLastSeen(lastLogin)).toBe("3 hours ago");
      });

      it("should return days for less than 30 days ago", () => {
        const lastLogin = "2024-01-10T12:00:00Z";
        expect(formatLastSeen(lastLogin)).toBe("5 days ago");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle concurrent user fetches", async () => {
      const users = [createMockUser({ id: "user-1" }), createMockUser({ id: "user-2" })];

      const user1 = createMockUser({ id: "user-1" });

      mockApiClient.get
        .mockResolvedValueOnce({ data: { users, total: 2, page: 1, per_page: 10 }, status: 200 })
        .mockResolvedValueOnce({ data: user1, status: 200 });

      const { result: usersResult } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      const { result: userResult } = renderHook(() => useUser("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(usersResult.current.isLoading).toBe(false);
        expect(userResult.current.isLoading).toBe(false);
      });

      expect(usersResult.current.data).toHaveLength(2);
      expect(userResult.current.data?.id).toBe("user-1");
    });

    it("should update user and invalidate queries", async () => {
      const user = createMockUser({ id: "user-1", full_name: "Updated Name" });

      mockApiClient.get.mockResolvedValue({
        data: { users: [user], total: 1, page: 1, per_page: 10 },
        status: 200,
      });
      mockApiClient.put.mockResolvedValue({ data: user, status: 200 });

      const { result: usersResult } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      const { result: updateResult } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(usersResult.current.isLoading).toBe(false));

      await act(async () => {
        await updateResult.current.mutateAsync({
          userId: "user-1",
          data: { full_name: "Updated Name" },
        });
      });

      await waitFor(() => {
        expect(updateResult.current.isSuccess).toBe(true);
      });
    });
  });
});
