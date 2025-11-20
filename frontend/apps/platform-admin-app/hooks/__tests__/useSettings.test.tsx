/**
 * Tests for useSettings hook
 * Tests admin settings management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useSettingsCategories,
  useCategorySettings,
  useAuditLogs,
  useUpdateCategorySettings,
  useValidateSettings,
  getCategoryDisplayName,
  formatLastUpdated,
  maskSensitiveValue,
  SettingsCategory,
  SettingsCategoryInfo,
  SettingsResponse,
  AuditLog,
  SettingsValidationResult,
} from "../useSettings";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response, _errorMsg) => response.data),
}));

describe("useSettings", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
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
    (extractDataOrThrow as jest.Mock).mockImplementation(
      (response: any, _errorMsg: string) => response.data,
    );
  });

  describe("useSettingsCategories - list categories", () => {
    it("should fetch all settings categories successfully", async () => {
      const mockCategories: SettingsCategoryInfo[] = [
        {
          category: "database",
          display_name: "Database Configuration",
          description: "PostgreSQL database settings",
          fields_count: 5,
          has_sensitive_fields: true,
          restart_required: true,
          last_updated: "2024-01-01T00:00:00Z",
        },
        {
          category: "jwt",
          display_name: "JWT & Authentication",
          description: "JWT token settings",
          fields_count: 3,
          has_sensitive_fields: true,
          restart_required: true,
          last_updated: null,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCategories });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockCategories);

      const { result } = renderHook(() => useSettingsCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCategories);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/categories");
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockCategories },
        "Failed to load settings categories"
      );
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch categories");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSettingsCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle empty categories array", async () => {
      const mockCategories: SettingsCategoryInfo[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCategories });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockCategories);

      const { result } = renderHook(() => useSettingsCategories(), {
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
                  data: [],
                }),
              100
            )
          )
      );
      (extractDataOrThrow as jest.Mock).mockImplementation(
        (response) => response.data
      );

      const { result } = renderHook(() => useSettingsCategories(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should accept custom query options", async () => {
      const mockCategories: SettingsCategoryInfo[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCategories });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockCategories);

      const { result } = renderHook(
        () => useSettingsCategories({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useCategorySettings - single category", () => {
    it("should fetch category settings successfully", async () => {
      const mockSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "DATABASE_HOST",
            value: "localhost",
            type: "string",
            description: "Database host",
            default: "localhost",
            required: true,
            sensitive: false,
            validation_rules: null,
          },
          {
            name: "DATABASE_PASSWORD",
            value: "secret123",
            type: "string",
            description: "Database password",
            default: null,
            required: true,
            sensitive: true,
            validation_rules: { min_length: 8 },
          },
        ],
        last_updated: "2024-01-01T00:00:00Z",
        updated_by: "admin@example.com",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(() => useCategorySettings("database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSettings);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/category/database", {
        params: { include_sensitive: false },
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockSettings },
        "Failed to load category settings"
      );
    });

    it("should fetch category settings with sensitive fields", async () => {
      const mockSettings: SettingsResponse = {
        category: "jwt",
        display_name: "JWT & Authentication",
        fields: [
          {
            name: "JWT_SECRET",
            value: "supersecret123",
            type: "string",
            description: "JWT secret key",
            default: null,
            required: true,
            sensitive: true,
            validation_rules: null,
          },
        ],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(() => useCategorySettings("jwt", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSettings);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/category/jwt", {
        params: { include_sensitive: true },
      });
    });

    it("should not fetch when category is empty", async () => {
      const { result } = renderHook(() => useCategorySettings("" as SettingsCategory), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Category not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCategorySettings("database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should respect enabled option from category parameter", async () => {
      const mockSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(() => useCategorySettings("database", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSettings);
    });

    it("should accept custom query options", async () => {
      const mockSettings: SettingsResponse = {
        category: "redis",
        display_name: "Redis Cache",
        fields: [],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(
        () => useCategorySettings("redis", false, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useAuditLogs - audit logs", () => {
    it("should fetch all audit logs successfully", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "log-1",
          timestamp: "2024-01-01T00:00:00Z",
          user_id: "user-1",
          user_email: "admin@example.com",
          category: "database",
          action: "update",
          changes: {
            DATABASE_HOST: { old: "localhost", new: "postgres.local" },
          },
          reason: "Update database host",
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
        },
        {
          id: "log-2",
          timestamp: "2024-01-02T00:00:00Z",
          user_id: "user-2",
          user_email: "user@example.com",
          category: "jwt",
          action: "update",
          changes: {
            JWT_EXPIRY: { old: 3600, new: 7200 },
          },
          reason: null,
          ip_address: null,
          user_agent: null,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(() => useAuditLogs(0, 100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toEqual(mockLogs);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/audit-logs", {
        params: {
          offset: 0,
          limit: 100,
          category: undefined,
          user_id: undefined,
        },
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockLogs },
        "Failed to load audit logs"
      );
    });

    it("should fetch audit logs filtered by category", async () => {
      const mockLogs: AuditLog[] = [
        {
          id: "log-1",
          timestamp: "2024-01-01T00:00:00Z",
          user_id: "user-1",
          user_email: "admin@example.com",
          category: "database",
          action: "update",
          changes: {},
          reason: null,
          ip_address: null,
          user_agent: null,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(() => useAuditLogs(0, 100, "database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toEqual(mockLogs);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/audit-logs", {
        params: {
          offset: 0,
          limit: 100,
          category: "database",
          user_id: undefined,
        },
      });
    });

    it("should fetch audit logs filtered by user", async () => {
      const mockLogs: AuditLog[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(() => useAuditLogs(0, 100, null, "user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toEqual(mockLogs);
      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/audit-logs", {
        params: {
          offset: 0,
          limit: 100,
          category: undefined,
          user_id: "user-1",
        },
      });
    });

    it("should fetch audit logs with custom limit", async () => {
      const mockLogs: AuditLog[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(() => useAuditLogs(0, 50), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/admin/settings/audit-logs", {
        params: {
          offset: 0,
          limit: 50,
          category: undefined,
          user_id: undefined,
        },
      });
    });

    it("should handle empty audit logs", async () => {
      const mockLogs: AuditLog[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(() => useAuditLogs(0, 100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch audit logs");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAuditLogs(0, 100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should accept custom query options", async () => {
      const mockLogs: AuditLog[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(
        () => useAuditLogs(0, 100, undefined, undefined, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateCategorySettings - mutation", () => {
    it("should update category settings successfully", async () => {
      const mockUpdatedSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "DATABASE_HOST",
            value: "postgres.local",
            type: "string",
            description: null,
            default: "localhost",
            required: true,
            sensitive: false,
            validation_rules: null,
          },
        ],
        last_updated: "2024-01-02T00:00:00Z",
        updated_by: "admin@example.com",
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedSettings);

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          category: "database",
          data: {
            updates: { DATABASE_HOST: "postgres.local" },
            reason: "Update host",
          },
        });
        expect(updated).toEqual(mockUpdatedSettings);
      });

      expect(apiClient.put).toHaveBeenCalledWith("/admin/settings/category/database", {
        updates: { DATABASE_HOST: "postgres.local" },
        reason: "Update host",
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockUpdatedSettings },
        "Failed to update settings"
      );
    });

    it("should invalidate queries after successful update", async () => {
      const mockUpdatedSettings: SettingsResponse = {
        category: "jwt",
        display_name: "JWT & Authentication",
        fields: [],
        last_updated: "2024-01-02T00:00:00Z",
        updated_by: "admin@example.com",
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedSettings);

      // Set up query to track invalidation
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [],
      });
      (extractDataOrThrow as jest.Mock).mockImplementation(
        (response) => response.data
      );

      const wrapper = createWrapper();
      const { result: categoriesResult } = renderHook(
        () => useSettingsCategories(),
        { wrapper }
      );
      const { result: updateResult } = renderHook(
        () => useUpdateCategorySettings(),
        { wrapper }
      );

      await waitFor(() => expect(categoriesResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedSettings);

      await act(async () => {
        await updateResult.current.mutateAsync({
          category: "jwt",
          data: { updates: { JWT_EXPIRY: 7200 } },
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle update error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid settings data",
          },
        },
      };

      (apiClient.put as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            category: "database",
            data: { updates: {} },
          });
        })
      ).rejects.toEqual(error);
    });

    it("should show toast notification on success", async () => {
      const mockUpdatedSettings: SettingsResponse = {
        category: "redis",
        display_name: "Redis Cache",
        fields: [],
        last_updated: "2024-01-02T00:00:00Z",
        updated_by: "admin@example.com",
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedSettings);

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          category: "redis",
          data: { updates: { REDIS_HOST: "localhost" } },
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Settings updated",
          description: "Redis Cache settings were updated successfully.",
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

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            category: "database",
            data: { updates: {} },
          });
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Update failed",
          description: "Failed to update settings",
          variant: "destructive",
        });
      });
    });

    it("should handle update with validate_only flag", async () => {
      const mockValidationResult: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockValidationResult });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockValidationResult);

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          category: "database",
          data: {
            updates: { DATABASE_HOST: "test" },
            validate_only: true,
          },
        });
      });

      expect(apiClient.put).toHaveBeenCalledWith("/admin/settings/category/database", {
        updates: { DATABASE_HOST: "test" },
        validate_only: true,
      });
    });

    it("should handle update with restart_required flag", async () => {
      const mockUpdatedSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [],
        last_updated: "2024-01-02T00:00:00Z",
        updated_by: "admin@example.com",
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockUpdatedSettings);

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          category: "database",
          data: {
            updates: { DATABASE_PORT: 5432 },
            restart_required: true,
          },
        });
      });

      expect(apiClient.put).toHaveBeenCalledWith("/admin/settings/category/database", {
        updates: { DATABASE_PORT: 5432 },
        restart_required: true,
      });
    });
  });

  describe("useValidateSettings - mutation", () => {
    it("should validate settings successfully", async () => {
      const mockValidation: SettingsValidationResult = {
        valid: true,
        errors: {},
        warnings: {},
        restart_required: false,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockValidation });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockValidation);

      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const validation = await result.current.mutateAsync({
          category: "database",
          updates: { DATABASE_HOST: "localhost" },
        });
        expect(validation).toEqual(mockValidation);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/admin/settings/validate",
        { DATABASE_HOST: "localhost" },
        { params: { category: "database" } }
      );
      expect(extractDataOrThrow).toHaveBeenCalledWith(
        { data: mockValidation },
        "Failed to validate settings"
      );
    });

    it("should handle validation with errors", async () => {
      const mockValidation: SettingsValidationResult = {
        valid: false,
        errors: {
          DATABASE_PORT: "Must be a number between 1 and 65535",
        },
        warnings: {},
        restart_required: false,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockValidation });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockValidation);

      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const validation = await result.current.mutateAsync({
          category: "database",
          updates: { DATABASE_PORT: "invalid" },
        });
        expect(validation.valid).toBe(false);
        expect(validation.errors).toHaveProperty("DATABASE_PORT");
      });
    });

    it("should handle validation with warnings", async () => {
      const mockValidation: SettingsValidationResult = {
        valid: true,
        errors: {},
        warnings: {
          JWT_EXPIRY: "Value is lower than recommended",
        },
        restart_required: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockValidation });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockValidation);

      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const validation = await result.current.mutateAsync({
          category: "jwt",
          updates: { JWT_EXPIRY: 300 },
        });
        expect(validation.valid).toBe(true);
        expect(validation.warnings).toHaveProperty("JWT_EXPIRY");
        expect(validation.restart_required).toBe(true);
      });
    });

    it("should handle validation error", async () => {
      const error = new Error("Validation service unavailable");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            category: "database",
            updates: {},
          });
        })
      ).rejects.toThrow("Validation service unavailable");
    });
  });

  describe("Utility Functions", () => {
    describe("getCategoryDisplayName", () => {
      it("should return correct display name for all categories", () => {
        expect(getCategoryDisplayName("database")).toBe("Database Configuration");
        expect(getCategoryDisplayName("jwt")).toBe("JWT & Authentication");
        expect(getCategoryDisplayName("redis")).toBe("Redis Cache");
        expect(getCategoryDisplayName("vault")).toBe("Vault/Secrets Management");
        expect(getCategoryDisplayName("storage")).toBe("Object Storage (MinIO/S3)");
        expect(getCategoryDisplayName("email")).toBe("Email & SMTP");
        expect(getCategoryDisplayName("tenant")).toBe("Multi-tenancy");
        expect(getCategoryDisplayName("cors")).toBe("CORS Configuration");
        expect(getCategoryDisplayName("rate_limit")).toBe("Rate Limiting");
        expect(getCategoryDisplayName("observability")).toBe("Logging & Monitoring");
        expect(getCategoryDisplayName("celery")).toBe("Background Tasks");
        expect(getCategoryDisplayName("features")).toBe("Feature Flags");
        expect(getCategoryDisplayName("billing")).toBe("Billing & Subscriptions");
      });

      it("should return category name for unknown category", () => {
        expect(getCategoryDisplayName("unknown" as SettingsCategory)).toBe("unknown");
      });
    });

    describe("formatLastUpdated", () => {
      beforeEach(() => {
        // Mock current time to 2024-01-15T12:00:00Z
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("should return 'Never' for null timestamp", () => {
        expect(formatLastUpdated(null)).toBe("Never");
      });

      it("should return 'Never' for undefined timestamp", () => {
        expect(formatLastUpdated(undefined)).toBe("Never");
      });

      it("should return 'Just now' for less than 1 minute ago", () => {
        const timestamp = "2024-01-15T11:59:30Z";
        expect(formatLastUpdated(timestamp)).toBe("Just now");
      });

      it("should return minutes for less than 60 minutes ago", () => {
        const timestamp = "2024-01-15T11:45:00Z"; // 15 minutes ago
        expect(formatLastUpdated(timestamp)).toBe("15 minutes ago");
      });

      it("should return singular 'minute' for 1 minute ago", () => {
        const timestamp = "2024-01-15T11:59:00Z"; // 1 minute ago
        expect(formatLastUpdated(timestamp)).toBe("1 minute ago");
      });

      it("should return hours for less than 24 hours ago", () => {
        const timestamp = "2024-01-15T09:00:00Z"; // 3 hours ago
        expect(formatLastUpdated(timestamp)).toBe("3 hours ago");
      });

      it("should return singular 'hour' for 1 hour ago", () => {
        const timestamp = "2024-01-15T11:00:00Z"; // 1 hour ago
        expect(formatLastUpdated(timestamp)).toBe("1 hour ago");
      });

      it("should return days for less than 30 days ago", () => {
        const timestamp = "2024-01-10T12:00:00Z"; // 5 days ago
        expect(formatLastUpdated(timestamp)).toBe("5 days ago");
      });

      it("should return singular 'day' for 1 day ago", () => {
        const timestamp = "2024-01-14T12:00:00Z"; // 1 day ago
        expect(formatLastUpdated(timestamp)).toBe("1 day ago");
      });

      it("should return formatted date for more than 30 days ago", () => {
        const timestamp = "2023-12-01T12:00:00Z"; // More than 30 days ago
        const date = new Date(timestamp);
        expect(formatLastUpdated(timestamp)).toBe(date.toLocaleDateString());
      });
    });

    describe("maskSensitiveValue", () => {
      it("should return value as-is when not sensitive", () => {
        expect(maskSensitiveValue("localhost", false)).toBe("localhost");
        expect(maskSensitiveValue(5432, false)).toBe("5432");
        expect(maskSensitiveValue(true, false)).toBe("true");
      });

      it("should return empty string for empty sensitive value", () => {
        expect(maskSensitiveValue("", true)).toBe("");
        expect(maskSensitiveValue(null, true)).toBe("");
        expect(maskSensitiveValue(undefined, true)).toBe("");
      });

      it("should mask short sensitive values", () => {
        expect(maskSensitiveValue("abc", true)).toBe("***");
        expect(maskSensitiveValue("1234", true)).toBe("***");
        expect(maskSensitiveValue("a", true)).toBe("***");
      });

      it("should mask long sensitive values showing first 4 chars", () => {
        expect(maskSensitiveValue("secretpassword123", true)).toBe("secr***");
        expect(maskSensitiveValue("api_key_12345678", true)).toBe("api_***");
        expect(maskSensitiveValue("supersecret", true)).toBe("supe***");
      });

      it("should handle numeric sensitive values", () => {
        expect(maskSensitiveValue(12345678, true)).toBe("1234***");
        expect(maskSensitiveValue(123, true)).toBe("***");
      });

      it("should handle boolean sensitive values", () => {
        expect(maskSensitiveValue(true, true)).toBe("***"); // "true" is 4 chars, so returns ***
        expect(maskSensitiveValue(false, true)).toBe(""); // false is falsy, so returns ""
      });
    });
  });

  describe("All settings categories", () => {
    it("should handle all category types", async () => {
      const categories: SettingsCategory[] = [
        "database",
        "jwt",
        "redis",
        "vault",
        "storage",
        "email",
        "tenant",
        "cors",
        "rate_limit",
        "observability",
        "celery",
        "features",
        "billing",
      ];

      for (const category of categories) {
        const mockSettings: SettingsResponse = {
          category,
          display_name: getCategoryDisplayName(category),
          fields: [],
          last_updated: null,
          updated_by: null,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
        (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

        const { result } = renderHook(() => useCategorySettings(category), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.category).toBe(category);
        jest.clearAllMocks();
      }
    });
  });

  describe("Query options and enabled state", () => {
    it("should respect enabled option in useSettingsCategories", async () => {
      const mockCategories: SettingsCategoryInfo[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCategories });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockCategories);

      const { result } = renderHook(
        () => useSettingsCategories({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should respect enabled option in useCategorySettings", async () => {
      const mockSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(
        () => useCategorySettings("database", false, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should respect enabled option in useAuditLogs", async () => {
      const mockLogs: AuditLog[] = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLogs });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLogs);

      const { result } = renderHook(
        () => useAuditLogs(0, 100, undefined, undefined, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("Settings field types and validation", () => {
    it("should handle all field types", async () => {
      const mockSettings: SettingsResponse = {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "STRING_FIELD",
            value: "test",
            type: "string",
            description: "A string field",
            default: "",
            required: true,
            sensitive: false,
            validation_rules: { max_length: 100 },
          },
          {
            name: "NUMBER_FIELD",
            value: 123,
            type: "number",
            description: "A number field",
            default: 0,
            required: false,
            sensitive: false,
            validation_rules: { min: 0, max: 1000 },
          },
          {
            name: "BOOLEAN_FIELD",
            value: true,
            type: "boolean",
            description: "A boolean field",
            default: false,
            required: false,
            sensitive: false,
            validation_rules: null,
          },
          {
            name: "ARRAY_FIELD",
            value: ["item1", "item2"],
            type: "array",
            description: "An array field",
            default: [],
            required: false,
            sensitive: false,
            validation_rules: null,
          },
          {
            name: "OBJECT_FIELD",
            value: { key: "value" },
            type: "object",
            description: "An object field",
            default: {},
            required: false,
            sensitive: false,
            validation_rules: null,
          },
        ],
        last_updated: null,
        updated_by: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSettings });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockSettings);

      const { result } = renderHook(() => useCategorySettings("database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.fields).toHaveLength(5);
      expect(result.current.data?.fields[0].type).toBe("string");
      expect(result.current.data?.fields[1].type).toBe("number");
      expect(result.current.data?.fields[2].type).toBe("boolean");
      expect(result.current.data?.fields[3].type).toBe("array");
      expect(result.current.data?.fields[4].type).toBe("object");
    });
  });
});
