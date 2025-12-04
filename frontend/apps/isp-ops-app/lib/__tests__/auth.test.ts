/**
 * Tests for auth utilities
 * Tests authentication helpers including login, register, permissions, and roles
 */

import {
  login,
  register,
  logout,
  getCurrentUser,
  hasPermission,
  hasRole,
  hasAnyRole,
  refreshToken,
  type User,
  type LoginCredentials,
  type RegisterData,
} from "../auth";
import { apiClient } from "../api/client";

// Mock the API client
jest.mock("../api/client", () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe("auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should call API with credentials", async () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "password123",
      };

      const mockResponse = {
        data: {
          user: {
            id: "1",
            email: "test@example.com",
            name: "Test User",
          },
          access_token: "token123",
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await login(credentials);

      expect(apiClient.post).toHaveBeenCalledWith("/auth/login", credentials);
      expect(result).toEqual(mockResponse.data);
      expect(result.user.email).toBe("test@example.com");
      expect(result.access_token).toBe("token123");
    });

    it("should handle login errors", async () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "wrong",
      };

      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Invalid credentials"));

      await expect(login(credentials)).rejects.toThrow("Invalid credentials");
    });
  });

  describe("register", () => {
    it("should call API with registration data", async () => {
      const data: RegisterData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        full_name: "Test User",
        tenant_name: "Test Tenant",
      };

      const mockResponse = {
        data: {
          user: {
            id: "1",
            email: "test@example.com",
            name: "Test User",
          },
          access_token: "token123",
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await register(data);

      expect(apiClient.post).toHaveBeenCalledWith("/auth/register", data);
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle registration with minimal data", async () => {
      const data: RegisterData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      };

      const mockResponse = {
        data: {
          user: {
            id: "1",
            email: "test@example.com",
            name: "testuser",
          },
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await register(data);

      expect(result.user.email).toBe("test@example.com");
    });
  });

  describe("logout", () => {
    it("should call logout API endpoint", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      await logout();

      expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
    });

    it("should handle logout errors gracefully", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(logout()).rejects.toThrow("Network error");
    });
  });

  describe("getCurrentUser", () => {
    it("should return user data when authenticated", async () => {
      const mockUser: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
        permissions: ["read"],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });

      const result = await getCurrentUser();

      expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
      expect(result).toEqual(mockUser);
    });

    it("should return null when not authenticated", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has permission", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        permissions: ["read", "write"],
      };

      expect(hasPermission(user, "read")).toBe(true);
      expect(hasPermission(user, "write")).toBe(true);
    });

    it("should return false when user lacks permission", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        permissions: ["read"],
      };

      expect(hasPermission(user, "delete")).toBe(false);
    });

    it("should return true for wildcard permission", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        permissions: ["*"],
      };

      expect(hasPermission(user, "read")).toBe(true);
      expect(hasPermission(user, "write")).toBe(true);
      expect(hasPermission(user, "delete")).toBe(true);
    });

    it("should return false when user is null", () => {
      expect(hasPermission(null, "read")).toBe(false);
    });

    it("should return false when user has no permissions array", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
      };

      expect(hasPermission(user, "read")).toBe(false);
    });

    it("should return false when permissions array is empty", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        permissions: [],
      };

      expect(hasPermission(user, "read")).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("should return true when user has role", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user", "moderator"],
      };

      expect(hasRole(user, "user")).toBe(true);
      expect(hasRole(user, "moderator")).toBe(true);
    });

    it("should return false when user lacks role", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      };

      expect(hasRole(user, "admin")).toBe(false);
    });

    it("should return true when user is admin (has all roles)", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["admin"],
      };

      expect(hasRole(user, "moderator")).toBe(true);
      expect(hasRole(user, "user")).toBe(true);
    });

    it("should return false when user is null", () => {
      expect(hasRole(null, "user")).toBe(false);
    });

    it("should return false when user has no roles array", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
      };

      expect(hasRole(user, "user")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true when user has any of the specified roles", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user", "moderator"],
      };

      expect(hasAnyRole(user, ["user", "admin"])).toBe(true);
      expect(hasAnyRole(user, ["moderator", "admin"])).toBe(true);
    });

    it("should return false when user has none of the specified roles", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      };

      expect(hasAnyRole(user, ["admin", "moderator"])).toBe(false);
    });

    it("should return true when user is admin", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["admin"],
      };

      expect(hasAnyRole(user, ["moderator", "user"])).toBe(true);
    });

    it("should return false when user is null", () => {
      expect(hasAnyRole(null, ["user", "admin"])).toBe(false);
    });

    it("should return false when roles array is empty", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      };

      expect(hasAnyRole(user, [])).toBe(false);
    });

    it("should handle single role check", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      };

      expect(hasAnyRole(user, ["user"])).toBe(true);
      expect(hasAnyRole(user, ["admin"])).toBe(false);
    });
  });

  describe("refreshToken", () => {
    it("should return new access token on success", async () => {
      const mockResponse = {
        data: {
          access_token: "new_token_123",
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await refreshToken();

      expect(apiClient.post).toHaveBeenCalledWith("/auth/refresh");
      expect(result).toBe("new_token_123");
    });

    it("should return null on refresh error", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Refresh token expired"));

      const result = await refreshToken();

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await refreshToken();

      expect(result).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle user with MFA fields", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        mfa_enabled: true,
        mfa_backup_codes_remaining: 5,
        permissions: ["read"],
      };

      expect(hasPermission(user, "read")).toBe(true);
      expect(user.mfa_enabled).toBe(true);
      expect(user.mfa_backup_codes_remaining).toBe(5);
    });

    it("should handle user with tenant_id", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        tenant_id: "tenant_123",
        roles: ["user"],
      };

      expect(user.tenant_id).toBe("tenant_123");
      expect(hasRole(user, "user")).toBe(true);
    });

    it("should handle empty roles array", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        roles: [],
      };

      expect(hasRole(user, "user")).toBe(false);
      expect(hasAnyRole(user, ["user", "admin"])).toBe(false);
    });

    it("should handle empty permissions array", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        permissions: [],
      };

      expect(hasPermission(user, "read")).toBe(false);
    });

    it("should handle API errors in auth functions", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("500 Internal Server Error"));

      await expect(login({ email: "test", password: "test" })).rejects.toThrow();
      await expect(
        register({ username: "test", email: "test", password: "test" }),
      ).rejects.toThrow();
    });
  });

  describe("Type safety", () => {
    it("should accept valid User type", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        name: "Test User",
        tenant_id: "tenant1",
        roles: ["user"],
        permissions: ["read", "write"],
        mfa_enabled: true,
        mfa_backup_codes_remaining: 10,
      };

      expect(user.id).toBe("1");
      expect(hasRole(user, "user")).toBe(true);
      expect(hasPermission(user, "read")).toBe(true);
    });

    it("should accept valid LoginCredentials type", () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "password123",
      };

      expect(credentials.email).toBeDefined();
      expect(credentials.password).toBeDefined();
    });

    it("should accept valid RegisterData type with optional fields", () => {
      const data: RegisterData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        full_name: "Test User",
        tenant_name: "Test Tenant",
      };

      expect(data.username).toBeDefined();
      expect(data.email).toBeDefined();
      expect(data.password).toBeDefined();
      expect(data.full_name).toBeDefined();
      expect(data.tenant_name).toBeDefined();
    });
  });
});
