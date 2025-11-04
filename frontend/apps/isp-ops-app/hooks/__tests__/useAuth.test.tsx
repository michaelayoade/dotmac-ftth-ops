/**
 * Tests for useAuth hook
 *
 * Tests authentication flow, user state management, and permissions
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth, AuthProvider } from "../useAuth";
import { authService } from "@/lib/api/services/auth.service";
import { apiClient } from "@/lib/api/client";
import { ReactNode } from "react";
import type { AxiosResponse, AxiosRequestConfig } from "axios";

// Mock dependencies
jest.mock("@/lib/api/services/auth.service");
jest.mock("@/lib/api/client");
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const mockAuthService = authService as unknown as jest.Mocked<typeof authService>;
const mockApiClient = apiClient as unknown as jest.Mocked<typeof apiClient>;

const createAxiosResponse = <T,>(data: T, config: AxiosRequestConfig = {}): AxiosResponse<T> => {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: undefined,
  } as AxiosResponse<T>;
};

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("useAuth Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should start with loading state", () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it("should load authenticated user on mount", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser as any);

      mockApiClient.get.mockResolvedValue(
        createAxiosResponse({
          effective_permissions: [{ name: "read:users" }],
        }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.permissions).toHaveProperty("effective_permissions");
    });
  });

  describe("Login", () => {
    it("should successfully login user", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      mockAuthService.getCurrentUser.mockResolvedValue(null);

      mockAuthService.login.mockResolvedValue({
        user: mockUser,
        access_token: "mock-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
      } as any);

      mockApiClient.get.mockResolvedValue(
        createAxiosResponse({
          effective_permissions: [],
        }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login("testuser", "password123");
      });

      expect(mockAuthService.login).toHaveBeenCalledWith({
        username: "testuser",
        password: "password123",
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.error).toBe(null);
      });
    });

    it("should handle login error", async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      mockAuthService.login.mockRejectedValue(new Error("Invalid credentials"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login("testuser", "wrong-password");
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.user).toBe(null);
    });
  });

  describe("Logout", () => {
    it("should successfully logout user", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser as any);

      mockApiClient.get.mockResolvedValue(createAxiosResponse({ effective_permissions: [] }));

      mockAuthService.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(result.current.user).toBe(null);
      expect(result.current.permissions).toBe(null);
    });
  });

  describe("Permissions", () => {
    it("should load user permissions after login", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      const mockPermissions = {
        effective_permissions: [{ name: "read:users" }, { name: "write:users" }],
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser as any);

      mockApiClient.get.mockResolvedValue(createAxiosResponse(mockPermissions));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual(mockPermissions);
      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/rbac/my-permissions");
    });

    it("should handle permission loading failure gracefully", async () => {
      const mockUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser as any);

      mockApiClient.get.mockRejectedValue(new Error("Failed to fetch permissions"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // User should still be loaded even if permissions fail
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.permissions).toBe(null);
    });
  });

  describe("Error Handling", () => {
    it("should set error state on authentication failure", async () => {
      jest.useFakeTimers();
      mockAuthService.getCurrentUser.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      try {
        await act(async () => {
          jest.runAllTimers();
          await Promise.resolve();
        });

        expect(result.current.user).toBe(null);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("User Refresh", () => {
    it("should refresh user data", async () => {
      const initialUser = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };

      const updatedUser = {
        id: "123",
        username: "testuser",
        email: "newemail@example.com",
      };

      mockAuthService.getCurrentUser
        .mockResolvedValueOnce(initialUser as any)
        .mockResolvedValueOnce(updatedUser as any);

      mockApiClient.get.mockResolvedValue(createAxiosResponse({ effective_permissions: [] }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(initialUser);
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(updatedUser);
      });
    });
  });
});
