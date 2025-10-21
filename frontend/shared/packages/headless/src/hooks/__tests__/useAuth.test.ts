/**
 * useAuth hook tests
 * Testing authentication, authorization, and token management
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";

import { useAuth } from "../useAuth";

// Mock dependencies
jest.mock("../api/client", () => ({
  getApiClient: jest.fn(() => ({
    auth: {
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      me: jest.fn(),
    },
  })),
}));

jest.mock("../middleware/rateLimiting", () => ({
  useAuthRateLimit: jest.fn(() => ({
    isRateLimited: false,
    remainingAttempts: 5,
  })),
}));

jest.mock("../stores/authStore", () => ({
  useAuthStore: jest.fn(() => ({
    user: null,
    setUser: jest.fn(),
    clearUser: jest.fn(),
    permissions: [],
    setPermissions: jest.fn(),
  })),
}));

jest.mock("../utils/csrfProtection", () => ({
  csrfProtection: {
    getToken: jest.fn(() => "csrf-token"),
    validateToken: jest.fn(() => true),
  },
}));

jest.mock("../utils/tokenManager", () => ({
  tokenManager: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    removeToken: jest.fn(),
    isTokenExpired: jest.fn(),
    getTokenExpiration: jest.fn(),
  },
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  role: "user",
  permissions: ["read:profile", "write:profile"],
  tenantId: "tenant-123",
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useAuth", () => {
  const mockApiClient = require("../api/client").getApiClient();
  const mockAuthStore = require("../stores/authStore").useAuthStore();
  const mockTokenManager = require("../utils/tokenManager").tokenManager;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial state", () => {
    it("returns initial unauthenticated state", () => {
      mockAuthStore.user = null;

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.permissions).toEqual([]);
      expect(result.current.role).toBeNull();
      expect(result.current.tenantId).toBeNull();
    });

    it("returns authenticated state when user exists", () => {
      mockAuthStore.user = mockUser;
      mockAuthStore.permissions = mockUser.permissions;

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.permissions).toEqual(mockUser.permissions);
      expect(result.current.role).toBe(mockUser.role);
      expect(result.current.tenantId).toBe(mockUser.tenantId);
    });
  });

  describe("Login", () => {
    it("successfully logs in user", async () => {
      const loginResponse = {
        user: mockUser,
        access_token: "jwt-token",
        refresh_token: "refresh-token",
      };

      mockApiClient.auth.login.mockResolvedValue(loginResponse);
      mockTokenManager.getToken.mockReturnValue("jwt-token");

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login({
          email: "test@example.com",
          password: "password",
        });
      });

      expect(mockApiClient.auth.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
        _csrf: "csrf-token",
      });
      expect(mockTokenManager.setToken).toHaveBeenCalledWith("jwt-token");
      expect(mockAuthStore.setUser).toHaveBeenCalledWith(mockUser);
    });

    it("handles login with remember me option", async () => {
      const loginResponse = {
        user: mockUser,
        access_token: "jwt-token",
        refresh_token: "refresh-token",
      };

      mockApiClient.auth.login.mockResolvedValue(loginResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login({
          email: "test@example.com",
          password: "password",
          rememberMe: true,
        });
      });

      expect(mockApiClient.auth.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
        rememberMe: true,
        _csrf: "csrf-token",
      });
    });

    it("handles login failure", async () => {
      const loginError = new Error("Invalid credentials");
      mockApiClient.auth.login.mockRejectedValue(loginError);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.login({
            email: "test@example.com",
            password: "wrong-password",
          });
        }),
      ).rejects.toThrow("Invalid credentials");

      expect(mockTokenManager.setToken).not.toHaveBeenCalled();
      expect(mockAuthStore.setUser).not.toHaveBeenCalled();
    });
  });

  describe("Logout", () => {
    it("successfully logs out user", async () => {
      mockApiClient.auth.logout.mockResolvedValue(_props);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockApiClient.auth.logout).toHaveBeenCalled();
      expect(mockTokenManager.removeToken).toHaveBeenCalled();
      expect(mockAuthStore.clearUser).toHaveBeenCalled();
    });

    it("handles logout failure gracefully", async () => {
      mockApiClient.auth.logout.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API call fails
      expect(mockTokenManager.removeToken).toHaveBeenCalled();
      expect(mockAuthStore.clearUser).toHaveBeenCalled();
    });
  });

  describe("Token refresh", () => {
    it("refreshes token when needed", async () => {
      const refreshResponse = {
        access_token: "new-jwt-token",
        user: mockUser,
      };

      mockApiClient.auth.refresh.mockResolvedValue(refreshResponse);
      mockTokenManager.isTokenExpired.mockReturnValue(true);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(mockApiClient.auth.refresh).toHaveBeenCalled();
      expect(mockTokenManager.setToken).toHaveBeenCalledWith("new-jwt-token");
    });

    it("handles refresh failure", async () => {
      mockApiClient.auth.refresh.mockRejectedValue(new Error("Refresh failed"));
      mockTokenManager.isTokenExpired.mockReturnValue(true);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.refreshToken();
        }),
      ).rejects.toThrow("Refresh failed");
    });
  });

  describe("Permissions", () => {
    it("checks permissions correctly", () => {
      mockAuthStore.user = mockUser;
      mockAuthStore.permissions = mockUser.permissions;

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasPermission("read:profile")).toBe(true);
      expect(result.current.hasPermission("write:profile")).toBe(true);
      expect(result.current.hasPermission("admin:users")).toBe(false);
    });

    it("returns false for permissions when not authenticated", () => {
      mockAuthStore.user = null;
      mockAuthStore.permissions = [];

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasPermission("read:profile")).toBe(false);
    });

    it("checks role-based permissions", () => {
      const adminUser = { ...mockUser, role: "admin", permissions: ["*"] };
      mockAuthStore.user = adminUser;
      mockAuthStore.permissions = adminUser.permissions;

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasRole("admin")).toBe(true);
      expect(result.current.hasRole("user")).toBe(false);
    });
  });

  describe("Auto refresh", () => {
    it("automatically refreshes token when close to expiry", async () => {
      const refreshResponse = {
        access_token: "refreshed-token",
        user: mockUser,
      };

      mockApiClient.auth.refresh.mockResolvedValue(refreshResponse);
      mockTokenManager.getTokenExpiration.mockReturnValue(Date.now() + 2 * 60 * 1000); // 2 minutes from now

      const { result } = renderHook(() => useAuth({ autoRefresh: true, refreshThreshold: 5 }), {
        wrapper: createWrapper(),
      });

      // Wait for auto refresh logic to trigger
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockTokenManager.getTokenExpiration).toHaveBeenCalled();
    });

    it("does not refresh when auto refresh is disabled", async () => {
      mockTokenManager.getTokenExpiration.mockReturnValue(Date.now() + 2 * 60 * 1000);

      renderHook(() => useAuth({ autoRefresh: false }), {
        wrapper: createWrapper(),
      });

      // Wait to ensure no refresh happens
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockApiClient.auth.refresh).not.toHaveBeenCalled();
    });
  });

  describe("Rate limiting", () => {
    it("prevents login when rate limited", async () => {
      require("../middleware/rateLimiting").useAuthRateLimit.mockReturnValue({
        isRateLimited: true,
        remainingAttempts: 0,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.login({
            email: "test@example.com",
            password: "password",
          });
        }),
      ).rejects.toThrow(/rate limit/i);

      expect(mockApiClient.auth.login).not.toHaveBeenCalled();
    });
  });

  describe("CSRF protection", () => {
    it("includes CSRF token in login request", async () => {
      const loginResponse = {
        user: mockUser,
        access_token: "jwt-token",
        refresh_token: "refresh-token",
      };

      mockApiClient.auth.login.mockResolvedValue(loginResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.login({
          email: "test@example.com",
          password: "password",
        });
      });

      expect(mockApiClient.auth.login).toHaveBeenCalledWith(
        expect.objectContaining({
          _csrf: "csrf-token",
        }),
      );
    });
  });
});
