/**
 * Shared React Query hooks for admin settings management
 *
 * Enhanced with:
 * - Runtime Zod validation
 * - Pagination support for audit logs
 * - Better error handling
 * - Type safety improvements
 *
 * Connects to backend admin settings API:
 * - GET /api/platform/v1/admin/settings/categories - List all categories
 * - GET /api/platform/v1/admin/settings/category/{category} - Get category settings
 * - PUT /api/platform/v1/admin/settings/category/{category} - Update category settings
 * - POST /api/platform/v1/admin/settings/validate - Validate settings
 * - GET /api/platform/v1/admin/settings/audit-logs - Get audit logs
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { parseListResponse, handleApiError } from "../utils/api-utils";
import {
  SettingsCategory,
  SettingsCategoryInfo,
  SettingsCategoryInfoSchema,
  SettingsResponse,
  SettingsResponseSchema,
  AuditLog,
  AuditLogSchema,
  SettingsUpdateRequest,
  SettingsValidationResult,
  SettingsValidationResultSchema,
} from "../utils/settings-schemas";

// Re-export types and utilities for convenience
export type {
  SettingsCategory,
  SettingField,
  SettingsCategoryInfo,
  SettingsResponse,
  SettingsUpdateRequest,
  SettingsValidationResult,
  AuditLog,
} from "../utils/settings-schemas";

export { SETTINGS_CATEGORIES } from "../utils/settings-schemas";

export {
  getCategoryDisplayName,
  formatLastUpdated,
  maskSensitiveValue,
  isValidCategory,
  getAllCategories,
  formatSettingValue,
} from "../utils/settings-utils";

// ============================================
// Query Hooks
// ============================================

type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all settings categories
 */
export function useSettingsCategories(
  options?: QueryOptions<SettingsCategoryInfo[], ["settings", "categories"]>,
) {
  return useQuery<
    SettingsCategoryInfo[],
    Error,
    SettingsCategoryInfo[],
    ["settings", "categories"]
  >({
    queryKey: ["settings", "categories"],
    queryFn: async () => {
      const response = await apiClient.get<SettingsCategoryInfo[]>("/admin/settings/categories");
      const data = extractDataOrThrow(response, "Failed to load settings categories");

      // Validate response with Zod
      if (Array.isArray(data)) {
        return data.map((item) => SettingsCategoryInfoSchema.parse(item));
      }
      return [];
    },
    ...options,
  });
}

/**
 * Fetch settings for a specific category
 */
export function useCategorySettings(
  category: SettingsCategory,
  includeSensitive: boolean = false,
  options?: QueryOptions<SettingsResponse, ["settings", "category", SettingsCategory, boolean]>,
) {
  return useQuery<
    SettingsResponse,
    Error,
    SettingsResponse,
    ["settings", "category", SettingsCategory, boolean]
  >({
    queryKey: ["settings", "category", category, includeSensitive],
    queryFn: async () => {
      const response = await apiClient.get<SettingsResponse>(
        `/admin/settings/category/${category}`,
        {
          params: { include_sensitive: includeSensitive },
        },
      );
      const data = extractDataOrThrow(response, "Failed to load category settings");

      // Validate response with Zod
      return SettingsResponseSchema.parse(data);
    },
    enabled: !!category,
    ...options,
  });
}

/**
 * Fetch audit logs for settings changes with pagination support
 */
export function useAuditLogs(
  offset: number = 0,
  limit: number = 100,
  category?: SettingsCategory | null,
  userId?: string | null,
  options?: QueryOptions<
    { data: AuditLog[]; total: number },
    [
      "settings",
      "audit-logs",
      number,
      number,
      SettingsCategory | null | undefined,
      string | null | undefined,
    ]
  >,
) {
  return useQuery<
    { data: AuditLog[]; total: number },
    Error,
    { data: AuditLog[]; total: number },
    [
      "settings",
      "audit-logs",
      number,
      number,
      SettingsCategory | null | undefined,
      string | null | undefined,
    ]
  >({
    queryKey: ["settings", "audit-logs", offset, limit, category, userId],
    queryFn: async () => {
      const response = await apiClient.get<AuditLog[]>("/admin/settings/audit-logs", {
        params: {
          offset,
          limit,
          category: category || undefined,
          user_id: userId || undefined,
        },
      });

      // Use enhanced response parser with validation
      const data = extractDataOrThrow(response, "Failed to load audit logs");

      // Handle both array and paginated response formats
      if (Array.isArray(data)) {
        const validatedData = data.map((item) => AuditLogSchema.parse(item));
        return { data: validatedData, total: validatedData.length };
      }

      // Handle paginated response
      const result = data as any;
      if (result.data || result.items) {
        const items = result.data || result.items;
        const validatedData = Array.isArray(items)
          ? items.map((item: any) => AuditLogSchema.parse(item))
          : [];
        const total = result.total ?? result.count ?? result.total_count ?? validatedData.length;
        return { data: validatedData, total };
      }

      return { data: [], total: 0 };
    },
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Update category settings
 */
export function useUpdateCategorySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      category,
      data,
    }: {
      category: SettingsCategory;
      data: SettingsUpdateRequest;
    }) => {
      const response = await apiClient.put<SettingsResponse>(
        `/admin/settings/category/${category}`,
        data,
      );
      const result = extractDataOrThrow(response, "Failed to update settings");

      // Validate response with Zod
      return SettingsResponseSchema.parse(result);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["settings", "categories"] });
      queryClient.invalidateQueries({
        queryKey: ["settings", "category", variables.category],
      });
      queryClient.invalidateQueries({ queryKey: ["settings", "audit-logs"] });

      toast({
        title: "Settings updated",
        description: `${data.display_name} settings were updated successfully.`,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update settings";

      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

/**
 * Validate settings before applying
 */
export function useValidateSettings() {
  return useMutation({
    mutationFn: async ({
      category,
      updates,
    }: {
      category: SettingsCategory;
      updates: Record<string, any>;
    }) => {
      const response = await apiClient.post<SettingsValidationResult>(
        "/admin/settings/validate",
        updates,
        {
          params: { category },
        },
      );
      const data = extractDataOrThrow(response, "Failed to validate settings");

      // Validate response with Zod
      return SettingsValidationResultSchema.parse(data);
    },
  });
}
