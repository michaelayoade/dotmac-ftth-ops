/**
 * MSW-based tests for useSettings hooks
 * Tests admin settings management with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSettingsCategories,
  useCategorySettings,
  useAuditLogs,
  useUpdateCategorySettings,
  useValidateSettings,
  getCategoryDisplayName,
  formatLastUpdated,
  maskSensitiveValue,
} from "../useSettings";
import {
  clearSettingsData,
  seedSettingsCategories,
  seedCategorySettings,
  seedAuditLogs,
} from "@/__tests__/msw/handlers/settings";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

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

describe("useSettings", () => {
  beforeEach(() => {
    clearSettingsData();
  });

  describe("useSettingsCategories", () => {
    it("should fetch all settings categories successfully", async () => {
      seedSettingsCategories([
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
      ]);

      const { result } = renderHook(() => useSettingsCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].category).toBe("database");
      expect(result.current.data?.[1].category).toBe("jwt");
    });

    it("should return default categories when none seeded", async () => {
      const { result } = renderHook(() => useSettingsCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBeGreaterThan(0);
    });
  });

  describe("useCategorySettings", () => {
    it("should fetch category settings successfully", async () => {
      seedCategorySettings("database", {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "host",
            value: "localhost",
            type: "string",
            description: "Database host",
            required: true,
            sensitive: false,
          },
          {
            name: "port",
            value: 5432,
            type: "integer",
            description: "Database port",
            required: true,
            sensitive: false,
          },
        ],
        last_updated: "2024-01-01T00:00:00Z",
        updated_by: "admin@example.com",
      });

      const { result } = renderHook(() => useCategorySettings("database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.category).toBe("database");
      expect(result.current.data?.fields).toHaveLength(2);
      expect(result.current.data?.fields[0].name).toBe("host");
    });

    it("should mask sensitive fields by default", async () => {
      seedCategorySettings("database", {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "password",
            value: "secret123",
            type: "string",
            description: "Database password",
            required: true,
            sensitive: true,
          },
        ],
        last_updated: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useCategorySettings("database", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.fields[0].value).toBe("***");
    });

    it("should include sensitive fields when requested", async () => {
      seedCategorySettings("database", {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "password",
            value: "secret123",
            type: "string",
            description: "Database password",
            required: true,
            sensitive: true,
          },
        ],
        last_updated: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useCategorySettings("database", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.fields[0].value).toBe("secret123");
    });
  });

  describe("useAuditLogs", () => {
    it("should fetch audit logs successfully", async () => {
      seedAuditLogs([
        {
          id: "audit-1",
          timestamp: "2024-01-01T00:00:00Z",
          user_id: "user-123",
          user_email: "admin@example.com",
          category: "database",
          action: "update",
          changes: { host: { old: "localhost", new: "prod-db" } },
          reason: "Production migration",
          ip_address: "127.0.0.1",
          user_agent: "Mozilla/5.0",
        },
      ]);

      const { result } = renderHook(() => useAuditLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].category).toBe("database");
      expect(result.current.data?.[0].action).toBe("update");
    });

    it("should filter by category", async () => {
      seedAuditLogs([
        {
          id: "audit-1",
          timestamp: "2024-01-01T00:00:00Z",
          user_id: "user-123",
          user_email: "admin@example.com",
          category: "database",
          action: "update",
          changes: {},
        },
        {
          id: "audit-2",
          timestamp: "2024-01-02T00:00:00Z",
          user_id: "user-123",
          user_email: "admin@example.com",
          category: "jwt",
          action: "update",
          changes: {},
        },
      ]);

      const { result } = renderHook(() => useAuditLogs("database"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].category).toBe("database");
    });

    it("should filter by user ID", async () => {
      seedAuditLogs([
        {
          id: "audit-1",
          timestamp: "2024-01-01T00:00:00Z",
          user_id: "user-123",
          user_email: "admin@example.com",
          category: "database",
          action: "update",
          changes: {},
        },
        {
          id: "audit-2",
          timestamp: "2024-01-02T00:00:00Z",
          user_id: "user-456",
          user_email: "other@example.com",
          category: "database",
          action: "update",
          changes: {},
        },
      ]);

      const { result } = renderHook(() => useAuditLogs(null, "user-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].user_id).toBe("user-123");
    });
  });

  describe("useUpdateCategorySettings", () => {
    it("should update category settings successfully", async () => {
      seedCategorySettings("database", {
        category: "database",
        display_name: "Database Configuration",
        fields: [
          {
            name: "host",
            value: "localhost",
            type: "string",
            required: true,
            sensitive: false,
          },
        ],
        last_updated: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useUpdateCategorySettings(), {
        wrapper: createWrapper(),
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.mutateAsync({
          category: "database",
          data: {
            updates: { host: "prod-db.example.com" },
            reason: "Production migration",
          },
        });
      });

      expect(updateResult).toBeDefined();
      expect(updateResult.category).toBe("database");
      expect(updateResult.last_updated).toBeDefined();
    });
  });

  describe("useValidateSettings", () => {
    it("should validate settings successfully", async () => {
      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      let validationResult;
      await act(async () => {
        validationResult = await result.current.mutateAsync({
          category: "database",
          updates: {
            host: "prod-db.example.com",
            port: 5432,
          },
        });
      });

      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBe(true);
      expect(validationResult.restart_required).toBe(true);
    });

    it("should return validation errors for invalid values", async () => {
      const { result } = renderHook(() => useValidateSettings(), {
        wrapper: createWrapper(),
      });

      let validationResult;
      await act(async () => {
        validationResult = await result.current.mutateAsync({
          category: "database",
          updates: {
            port: 99999, // Invalid port
          },
        });
      });

      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.port).toBeDefined();
    });
  });

  describe("Utility Functions", () => {
    describe("getCategoryDisplayName", () => {
      it("should return display name for known categories", () => {
        expect(getCategoryDisplayName("database")).toBe("Database Configuration");
        expect(getCategoryDisplayName("jwt")).toBe("JWT & Authentication");
        expect(getCategoryDisplayName("redis")).toBe("Redis Cache");
      });

      it("should return category as-is for unknown categories", () => {
        expect(getCategoryDisplayName("unknown" as any)).toBe("unknown");
      });
    });

    describe("formatLastUpdated", () => {
      it("should return 'Never' for null/undefined", () => {
        expect(formatLastUpdated(null)).toBe("Never");
        expect(formatLastUpdated(undefined)).toBe("Never");
      });

      it("should format recent timestamps", () => {
        const now = new Date();
        const justNow = new Date(now.getTime() - 30 * 1000).toISOString(); // 30 seconds ago
        expect(formatLastUpdated(justNow)).toBe("Just now");
      });

      it("should format minutes ago", () => {
        const now = new Date();
        const minsAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
        expect(formatLastUpdated(minsAgo)).toBe("5 minutes ago");
      });
    });

    describe("maskSensitiveValue", () => {
      it("should return value as-is if not sensitive", () => {
        expect(maskSensitiveValue("localhost", false)).toBe("localhost");
      });

      it("should mask sensitive values", () => {
        expect(maskSensitiveValue("secret123", true)).toBe("secr***");
        expect(maskSensitiveValue("ab", true)).toBe("***");
      });

      it("should handle empty sensitive values", () => {
        expect(maskSensitiveValue("", true)).toBe("");
        expect(maskSensitiveValue(null, true)).toBe("");
      });
    });
  });
});
