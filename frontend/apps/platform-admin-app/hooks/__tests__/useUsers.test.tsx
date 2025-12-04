/**
 * Tests for useUsers hook
 * Tests user management functionality with TanStack Query
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
  User,
  UserUpdateRequest,
} from "../useUsers";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response, _errorMsg) => response.data),
}));

describe("useUsers", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          refetchOnReconnect: false,
        },
        mutations: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockToast.mockClear();
    // Reset extractDataOrThrow to default implementation
    (extractDataOrThrow as jest.Mock).mockImplementation((response, _errorMsg) => response.data);
  });

  describe("useUsers - list users", () => {
    it("should fetch users successfully", async () => {
      const mockUsers: User[] = [
        {
          id: "user-1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
          is_active: true,
          is_verified: true,
          is_superuser: false,
          is_platform_admin: false,
          roles: ["admin"],
          permissions: ["read:users"],
          mfa_enabled: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          last_login: "2024-01-15T00:00:00Z",
          tenant_id: "tenant-1",
          phone_number: "+1234567890",
          avatar_url: "https://example.com/avatar.jpg",
        },
      ];

      const mockResponse = {
        users: mockUsers,
        total: 1,
        page: 1,
        per_page: 50,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockUsers);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/users");
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockResponse },
        "Failed to load users",
      );
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch users");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle empty users array", async () => {
      const mockResponse = {
        users: [],
        total: 0,
        page: 1,
        per_page: 50,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { users: [], total: 0, page: 1, per_page: 50 },
                }),
              100,
            ),
          ),
      );
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should accept custom query options", async () => {
      const mockResponse = {
        users: [],
        total: 0,
        page: 1,
        per_page: 50,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useUsers({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useUser - single user", () => {
    it("should fetch single user successfully", async () => {
      const mockUser: User = {
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        full_name: "John Doe",
        is_active: true,
        is_verified: true,
        is_superuser: false,
        is_platform_admin: false,
        roles: ["admin"],
        permissions: ["read:users"],
        mfa_enabled: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        last_login: "2024-01-15T00:00:00Z",
        tenant_id: "tenant-1",
        phone_number: "+1234567890",
        avatar_url: "https://example.com/avatar.jpg",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useUser("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockUser);
      expect(apiClient.get).toHaveBeenCalledWith("/users/user-1");
      expect(extractDataOrThrow).toHaveBeenCalledWith({ data: mockUser }, "Failed to load user");
    });

    it("should not fetch when userId is empty", async () => {
      const { result } = renderHook(() => useUser(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("User not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUser("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useCurrentUser", () => {
    it("should fetch current user successfully", async () => {
      const mockUser: User = {
        id: "current-user",
        username: "currentuser",
        email: "current@example.com",
        full_name: "Current User",
        is_active: true,
        is_verified: true,
        is_superuser: false,
        is_platform_admin: false,
        roles: ["user"],
        permissions: [],
        mfa_enabled: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        last_login: "2024-01-15T00:00:00Z",
        tenant_id: "tenant-1",
        phone_number: null,
        avatar_url: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockUser);
      expect(apiClient.get).toHaveBeenCalledWith("/users/me");
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockUser },
        "Failed to load current user",
      );
    });

    it("should handle fetch error", async () => {
      const error = new Error("Unauthorized");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe("useUpdateUser", () => {
    it("should update user successfully", async () => {
      const mockUpdatedUser: User = {
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        full_name: "John Updated",
        is_active: true,
        is_verified: true,
        is_superuser: false,
        is_platform_admin: false,
        roles: ["admin", "moderator"],
        permissions: ["read:users", "write:users"],
        mfa_enabled: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        last_login: "2024-01-15T00:00:00Z",
        tenant_id: "tenant-1",
        phone_number: "+1234567890",
        avatar_url: null,
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedUser);

      const { result } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      const updateData: UserUpdateRequest = {
        full_name: "John Updated",
        roles: ["admin", "moderator"],
      };

      await act(async () => {
        const updated = await result.current.mutateAsync({
          userId: "user-1",
          data: updateData,
        });
        expect(updated).toEqual(mockUpdatedUser);
      });

      expect(apiClient.put).toHaveBeenCalledWith("/users/user-1", updateData);
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockUpdatedUser },
        "Failed to update user",
      );
    });

    it("should invalidate queries after successful update", async () => {
      const mockUpdatedUser: User = {
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        full_name: "John Updated",
        is_active: true,
        is_verified: true,
        is_superuser: false,
        is_platform_admin: false,
        roles: ["admin"],
        permissions: [],
        mfa_enabled: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        last_login: null,
        tenant_id: "tenant-1",
        phone_number: null,
        avatar_url: null,
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedUser);

      // Set up query to track invalidation
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const wrapper = createWrapper();
      const { result: usersResult } = renderHook(() => useUsers(), { wrapper });
      const { result: updateResult } = renderHook(() => useUpdateUser(), {
        wrapper,
      });

      await waitFor(() => expect(usersResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedUser);

      await act(async () => {
        await updateResult.current.mutateAsync({
          userId: "user-1",
          data: { full_name: "John Updated" },
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle update error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid user data",
          },
        },
      };

      (apiClient.put as jest.Mock).mockRejectedValue(error);

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
      ).rejects.toEqual(error);
    });

    it("should show toast notification on success", async () => {
      const mockUpdatedUser: User = {
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        full_name: "John Updated",
        is_active: true,
        is_verified: true,
        is_superuser: false,
        is_platform_admin: false,
        roles: [],
        permissions: [],
        mfa_enabled: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        last_login: null,
        tenant_id: "tenant-1",
        phone_number: null,
        avatar_url: null,
      };

      // Set up mocks for mutation
      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedUser);

      const { result } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        await result.current.mutateAsync({
          userId: "user-1",
          data: { full_name: "John Updated" },
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "User updated",
          description: "John Updated was updated successfully.",
        });
      });
    });

    it("should show toast notification on error", async () => {
      const error = {
        response: {
          data: {
            detail: "Update failed",
          },
        },
      };

      (apiClient.put as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        try {
          await result.current.mutateAsync({
            userId: "user-1",
            data: { full_name: "Updated" },
          });
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Update failed",
          description: "Update failed",
          variant: "destructive",
        });
      });
    });
  });

  describe("useDeleteUser", () => {
    it("should delete user successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 204 });

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/users/user-1");
    });

    it("should handle delete with 200 status", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should throw error for non-2xx status codes", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 404 });

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toThrow("Failed to delete user");
    });

    it("should invalidate queries after successful deletion", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 204 });

      // Set up query to track invalidation
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const wrapper = createWrapper();
      const { result: usersResult } = renderHook(() => useUsers(), { wrapper });
      const { result: deleteResult } = renderHook(() => useDeleteUser(), {
        wrapper,
      });

      await waitFor(() => expect(usersResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await deleteResult.current.mutateAsync("user-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should show toast notification on success", async () => {
      // Set up mocks for mutation and refetch after invalidation
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 204 });
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "User deleted",
          description: "User was removed successfully.",
        });
      });
    });

    it("should show toast notification on error", async () => {
      const error = {
        response: {
          data: {
            detail: "Cannot delete user",
          },
        },
      };

      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        try {
          await result.current.mutateAsync("user-1");
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Delete failed",
          description: "Cannot delete user",
          variant: "destructive",
        });
      });
    });
  });

  describe("useDisableUser", () => {
    it("should disable user successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/users/user-1/disable");
    });

    it("should throw error for non-2xx status codes", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 500 });

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toThrow("Failed to disable user");
    });

    it("should invalidate queries after successful disable", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      // Set up query to track invalidation
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const wrapper = createWrapper();
      const { result: usersResult } = renderHook(() => useUsers(), { wrapper });
      const { result: disableResult } = renderHook(() => useDisableUser(), {
        wrapper,
      });

      await waitFor(() => expect(usersResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await disableResult.current.mutateAsync("user-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should show toast notification on success", async () => {
      // Set up mocks for mutation and refetch after invalidation
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "User disabled",
          description: "User account has been disabled.",
        });
      });
    });

    it("should show toast notification on error", async () => {
      const error = {
        response: {
          data: {
            detail: "Cannot disable user",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDisableUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        try {
          await result.current.mutateAsync("user-1");
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Disable failed",
          description: "Cannot disable user",
          variant: "destructive",
        });
      });
    });
  });

  describe("useEnableUser", () => {
    it("should enable user successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/users/user-1/enable");
    });

    it("should throw error for non-2xx status codes", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 400 });

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("user-1");
        }),
      ).rejects.toThrow("Failed to enable user");
    });

    it("should invalidate queries after successful enable", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      // Set up query to track invalidation
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const wrapper = createWrapper();
      const { result: usersResult } = renderHook(() => useUsers(), { wrapper });
      const { result: enableResult } = renderHook(() => useEnableUser(), {
        wrapper,
      });

      await waitFor(() => expect(usersResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await enableResult.current.mutateAsync("user-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should show toast notification on success", async () => {
      // Set up mocks for mutation and refetch after invalidation
      (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { users: [], total: 0, page: 1, per_page: 50 },
      });
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        await result.current.mutateAsync("user-1");
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "User enabled",
          description: "User account has been enabled.",
        });
      });
    });

    it("should show toast notification on error", async () => {
      const error = {
        response: {
          data: {
            detail: "Cannot enable user",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useEnableUser(), {
        wrapper: createWrapper(),
      });

      // Clear the mock before mutation to track toast calls
      mockToast.mockClear();

      await act(async () => {
        try {
          await result.current.mutateAsync("user-1");
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Enable failed",
          description: "Cannot enable user",
          variant: "destructive",
        });
      });
    });
  });

  describe("Utility Functions", () => {
    describe("getUserDisplayName", () => {
      it("should return full_name when available", () => {
        const user: User = {
          id: "1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
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
        };

        expect(getUserDisplayName(user)).toBe("John Doe");
      });

      it("should return username when full_name is null", () => {
        const user: User = {
          id: "1",
          username: "johndoe",
          email: "john@example.com",
          full_name: null,
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
        };

        expect(getUserDisplayName(user)).toBe("johndoe");
      });

      it("should return email when both full_name and username are falsy", () => {
        const user: User = {
          id: "1",
          username: "",
          email: "john@example.com",
          full_name: null,
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
        };

        expect(getUserDisplayName(user)).toBe("john@example.com");
      });
    });

    describe("getUserStatus", () => {
      it("should return 'Suspended' when user is not active", () => {
        const user: User = {
          id: "1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
          is_active: false,
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
        };

        expect(getUserStatus(user)).toBe("Suspended");
      });

      it("should return 'Invited' when user is active but not verified", () => {
        const user: User = {
          id: "1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
          is_active: true,
          is_verified: false,
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
        };

        expect(getUserStatus(user)).toBe("Invited");
      });

      it("should return 'Active' when user is active and verified", () => {
        const user: User = {
          id: "1",
          username: "johndoe",
          email: "john@example.com",
          full_name: "John Doe",
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
        };

        expect(getUserStatus(user)).toBe("Active");
      });
    });

    describe("getUserPrimaryRole", () => {
      it("should return 'Platform Admin' for platform admins", () => {
        const user: User = {
          id: "1",
          username: "admin",
          email: "admin@example.com",
          full_name: "Platform Admin",
          is_active: true,
          is_verified: true,
          is_superuser: false,
          is_platform_admin: true,
          roles: ["admin"],
          permissions: [],
          mfa_enabled: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          last_login: null,
          tenant_id: "tenant-1",
          phone_number: null,
          avatar_url: null,
        };

        expect(getUserPrimaryRole(user)).toBe("Platform Admin");
      });

      it("should return 'Superuser' for superusers", () => {
        const user: User = {
          id: "1",
          username: "superuser",
          email: "super@example.com",
          full_name: "Super User",
          is_active: true,
          is_verified: true,
          is_superuser: true,
          is_platform_admin: false,
          roles: ["admin"],
          permissions: [],
          mfa_enabled: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          last_login: null,
          tenant_id: "tenant-1",
          phone_number: null,
          avatar_url: null,
        };

        expect(getUserPrimaryRole(user)).toBe("Superuser");
      });

      it("should return capitalized first role when available", () => {
        const user: User = {
          id: "1",
          username: "user",
          email: "user@example.com",
          full_name: "Regular User",
          is_active: true,
          is_verified: true,
          is_superuser: false,
          is_platform_admin: false,
          roles: ["moderator", "editor"],
          permissions: [],
          mfa_enabled: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          last_login: null,
          tenant_id: "tenant-1",
          phone_number: null,
          avatar_url: null,
        };

        expect(getUserPrimaryRole(user)).toBe("Moderator");
      });

      it("should return 'User' when no special roles", () => {
        const user: User = {
          id: "1",
          username: "user",
          email: "user@example.com",
          full_name: "Regular User",
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
        };

        expect(getUserPrimaryRole(user)).toBe("User");
      });

      it("should handle empty string in roles array", () => {
        const user: User = {
          id: "1",
          username: "user",
          email: "user@example.com",
          full_name: "Regular User",
          is_active: true,
          is_verified: true,
          is_superuser: false,
          is_platform_admin: false,
          roles: [""],
          permissions: [],
          mfa_enabled: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          last_login: null,
          tenant_id: "tenant-1",
          phone_number: null,
          avatar_url: null,
        };

        expect(getUserPrimaryRole(user)).toBe("User");
      });
    });

    describe("formatLastSeen", () => {
      beforeEach(() => {
        // Mock current time to 2024-01-15T12:00:00Z
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
        const lastLogin = "2024-01-15T11:45:00Z"; // 15 minutes ago
        expect(formatLastSeen(lastLogin)).toBe("15 minutes ago");
      });

      it("should return singular 'minute' for 1 minute ago", () => {
        const lastLogin = "2024-01-15T11:59:00Z"; // 1 minute ago
        expect(formatLastSeen(lastLogin)).toBe("1 minute ago");
      });

      it("should return hours for less than 24 hours ago", () => {
        const lastLogin = "2024-01-15T09:00:00Z"; // 3 hours ago
        expect(formatLastSeen(lastLogin)).toBe("3 hours ago");
      });

      it("should return singular 'hour' for 1 hour ago", () => {
        const lastLogin = "2024-01-15T11:00:00Z"; // 1 hour ago
        expect(formatLastSeen(lastLogin)).toBe("1 hour ago");
      });

      it("should return days for less than 30 days ago", () => {
        const lastLogin = "2024-01-10T12:00:00Z"; // 5 days ago
        expect(formatLastSeen(lastLogin)).toBe("5 days ago");
      });

      it("should return singular 'day' for 1 day ago", () => {
        const lastLogin = "2024-01-14T12:00:00Z"; // 1 day ago
        expect(formatLastSeen(lastLogin)).toBe("1 day ago");
      });

      it("should return formatted date for more than 30 days ago", () => {
        const lastLogin = "2023-12-01T12:00:00Z"; // More than 30 days ago
        const result = formatLastSeen(lastLogin);
        expect(result).toContain("12/1/2023");
      });
    });
  });

  describe("Query options and enabled state", () => {
    it("should respect enabled option in useUser", async () => {
      const mockUser: User = {
        id: "user-1",
        username: "johndoe",
        email: "john@example.com",
        full_name: "John Doe",
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
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useUser("user-1", { enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should respect enabled option in useCurrentUser", async () => {
      const mockUser: User = {
        id: "current-user",
        username: "currentuser",
        email: "current@example.com",
        full_name: "Current User",
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
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useCurrentUser({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });
});
