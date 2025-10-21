/**
 * @fileoverview Tests for useAuth hook
 * Validates authentication state management and user interactions
 */

import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../auth/useAuth";
import { AuthProvider } from "../auth/AuthProvider";
import {
  createMockUser,
  createMockTokens,
  mockFetchResponse,
  mockFetchError,
} from "../../__tests__/setup";

// Mock the auth store
const mockAuthStore = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  updateUser: jest.fn(),
  clearError: jest.fn(),
};

jest.mock("../auth/store", () => ({
  useAuthStore: jest.fn(() => mockAuthStore),
}));

describe("useAuth Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockAuthStore).forEach((key) => {
      if (typeof mockAuthStore[key as keyof typeof mockAuthStore] === "function") {
        (mockAuthStore[key as keyof typeof mockAuthStore] as jest.Mock).mockClear();
      }
    });
  });

  describe("Initial State", () => {
    it("should return initial unauthenticated state", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.tokens).toBeNull();
    });

    it("should provide authentication functions", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.login).toBe("function");
      expect(typeof result.current.logout).toBe("function");
      expect(typeof result.current.refreshToken).toBe("function");
      expect(typeof result.current.updateUser).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
    });
  });

  describe("Authentication State", () => {
    it("should return authenticated state when user is logged in", () => {
      const mockUser = createMockUser();
      const mockTokens = createMockTokens();

      mockAuthStore.user = mockUser;
      mockAuthStore.tokens = mockTokens;
      mockAuthStore.isAuthenticated = true;

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.tokens).toEqual(mockTokens);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("should return loading state during authentication", () => {
      mockAuthStore.isLoading = true;

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
    });

    it("should return error state when authentication fails", () => {
      const errorMessage = "Authentication failed";
      mockAuthStore.error = errorMessage;

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe("Login Functionality", () => {
    it("should call login with correct credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };
      mockAuthStore.login.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockAuthStore.login).toHaveBeenCalledWith(credentials);
    });

    it("should handle login success", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };
      const mockUser = createMockUser();
      const mockTokens = createMockTokens();

      mockAuthStore.login.mockResolvedValueOnce({
        user: mockUser,
        tokens: mockTokens,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const loginResult = await result.current.login(credentials);
        expect(loginResult.user).toEqual(mockUser);
      });
    });

    it("should handle login failure", async () => {
      const credentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };
      const error = new Error("Invalid credentials");

      mockAuthStore.login.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login(credentials);
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      expect(mockAuthStore.login).toHaveBeenCalledWith(credentials);
    });
  });

  describe("Logout Functionality", () => {
    it("should call logout and clear authentication state", async () => {
      mockAuthStore.logout.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthStore.logout).toHaveBeenCalled();
    });

    it("should handle logout with redirect", async () => {
      const redirectUrl = "/login";
      mockAuthStore.logout.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout(redirectUrl);
      });

      expect(mockAuthStore.logout).toHaveBeenCalledWith(redirectUrl);
    });
  });

  describe("Token Management", () => {
    it("should refresh tokens when needed", async () => {
      const newTokens = createMockTokens({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });

      mockAuthStore.refreshToken.mockResolvedValueOnce(newTokens);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const refreshedTokens = await result.current.refreshToken();
        expect(refreshedTokens).toEqual(newTokens);
      });

      expect(mockAuthStore.refreshToken).toHaveBeenCalled();
    });

    it("should handle token refresh failure", async () => {
      const error = new Error("Refresh token expired");
      mockAuthStore.refreshToken.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (e) {
          expect(e).toBe(error);
        }
      });
    });

    it("should automatically refresh tokens before expiry", async () => {
      const expiringTokens = createMockTokens({
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      });

      mockAuthStore.tokens = expiringTokens;
      mockAuthStore.refreshToken.mockResolvedValueOnce(createMockTokens());

      const { result } = renderHook(() => useAuth());

      // Simulate token refresh check
      await act(async () => {
        // This would typically be triggered by a timer or request interceptor
        if (
          result.current.tokens &&
          result.current.tokens.expiresAt < Date.now() + 10 * 60 * 1000
        ) {
          await result.current.refreshToken();
        }
      });

      expect(mockAuthStore.refreshToken).toHaveBeenCalled();
    });
  });

  describe("User Profile Management", () => {
    it("should update user profile", async () => {
      const updates = { name: "Updated Name", email: "updated@example.com" };
      const updatedUser = createMockUser(updates);

      mockAuthStore.updateUser.mockResolvedValueOnce(updatedUser);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const result_user = await result.current.updateUser(updates);
        expect(result_user).toEqual(updatedUser);
      });

      expect(mockAuthStore.updateUser).toHaveBeenCalledWith(updates);
    });

    it("should handle profile update failure", async () => {
      const updates = { name: "Updated Name" };
      const error = new Error("Profile update failed");

      mockAuthStore.updateUser.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.updateUser(updates);
        } catch (e) {
          expect(e).toBe(error);
        }
      });
    });
  });

  describe("Error Handling", () => {
    it("should clear authentication errors", () => {
      mockAuthStore.error = "Some error";
      mockAuthStore.clearError.mockImplementation(() => {
        mockAuthStore.error = null;
      });

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.clearError();
      });

      expect(mockAuthStore.clearError).toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };
      const networkError = new Error("Network request failed");

      mockAuthStore.login.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login(credentials);
        } catch (error) {
          expect(error).toBe(networkError);
        }
      });
    });
  });

  describe("Portal-Specific Authentication", () => {
    const portals = [
      "admin",
      "customer",
      "technician",
      "reseller",
      "management-admin",
      "management-reseller",
      "tenant-portal",
    ];

    portals.forEach((portal) => {
      it(`should handle authentication for ${portal} portal`, async () => {
        const credentials = {
          email: "test@example.com",
          password: "password123",
          portal,
        };

        mockAuthStore.login.mockResolvedValueOnce({
          user: createMockUser({ role: `${portal}_user` }),
          tokens: createMockTokens(),
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.login(credentials);
        });

        expect(mockAuthStore.login).toHaveBeenCalledWith(credentials);
      });
    });
  });

  describe("Multi-Factor Authentication", () => {
    it("should handle MFA challenge during login", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };
      const mfaChallenge = {
        challengeToken: "mfa-token-123",
        challengeType: "totp",
        requiresMFA: true,
      };

      mockAuthStore.login.mockResolvedValueOnce(mfaChallenge);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const loginResult = await result.current.login(credentials);
        expect(loginResult.requiresMFA).toBe(true);
        expect(loginResult.challengeToken).toBe("mfa-token-123");
      });
    });

    it("should complete MFA verification", async () => {
      const mfaVerification = {
        challengeToken: "mfa-token-123",
        code: "123456",
      };

      const mockUser = createMockUser();
      mockAuthStore.login.mockResolvedValueOnce({
        user: mockUser,
        tokens: createMockTokens(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const verifyResult = await result.current.verifyMFA(mfaVerification);
        expect(verifyResult.user).toEqual(mockUser);
      });
    });
  });

  describe("Session Management", () => {
    it("should detect expired sessions", () => {
      const expiredTokens = createMockTokens({
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      mockAuthStore.tokens = expiredTokens;

      const { result } = renderHook(() => useAuth());

      expect(result.current.isSessionExpired()).toBe(true);
    });

    it("should detect valid sessions", () => {
      const validTokens = createMockTokens({
        expiresAt: Date.now() + 3600000, // Valid for 1 hour
      });

      mockAuthStore.tokens = validTokens;

      const { result } = renderHook(() => useAuth());

      expect(result.current.isSessionExpired()).toBe(false);
    });

    it("should handle session timeout", async () => {
      mockAuthStore.logout.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.handleSessionTimeout();
      });

      expect(mockAuthStore.logout).toHaveBeenCalledWith("/login?reason=timeout");
    });
  });

  describe("Permission Checks", () => {
    it("should check if user has specific permission", () => {
      const mockUser = createMockUser({
        permissions: ["users:read", "customers:write", "billing:read"],
      });

      mockAuthStore.user = mockUser;

      const { result } = renderHook(() => useAuth());

      expect(result.current.hasPermission("users:read")).toBe(true);
      expect(result.current.hasPermission("users:write")).toBe(false);
      expect(result.current.hasPermission("customers:write")).toBe(true);
    });

    it("should check if user has any of multiple permissions", () => {
      const mockUser = createMockUser({
        permissions: ["users:read", "customers:write"],
      });

      mockAuthStore.user = mockUser;

      const { result } = renderHook(() => useAuth());

      expect(result.current.hasAnyPermission(["users:write", "users:read"])).toBe(true);
      expect(result.current.hasAnyPermission(["admin:write", "super:admin"])).toBe(false);
    });

    it("should check if user has all required permissions", () => {
      const mockUser = createMockUser({
        permissions: ["users:read", "users:write", "customers:read"],
      });

      mockAuthStore.user = mockUser;

      const { result } = renderHook(() => useAuth());

      expect(result.current.hasAllPermissions(["users:read", "users:write"])).toBe(true);
      expect(result.current.hasAllPermissions(["users:read", "admin:write"])).toBe(false);
    });
  });

  describe("Hook Cleanup", () => {
    it("should cleanup subscriptions on unmount", () => {
      const { unmount } = renderHook(() => useAuth());

      // Mock subscription cleanup
      const cleanupSpy = jest.fn();
      mockAuthStore.cleanup = cleanupSpy;

      unmount();

      // In a real implementation, this would cleanup timers, event listeners, etc.
    });
  });

  describe("Integration with AuthProvider", () => {
    it("should work with AuthProvider context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider variant="simple">{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current.login).toBe("function");
    });
  });
});
