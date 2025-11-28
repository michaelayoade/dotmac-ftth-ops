import {
  useMutation,
  type MutationOptions,
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { isAuthBypassEnabled, useSession } from "@shared/lib/auth";

// Skip auth/session calls in bypass mode to avoid hangs during E2E tests
const authBypassEnabled = isAuthBypassEnabled();

export interface TenantBrandingConfigDto {
  product_name?: string | null;
  product_tagline?: string | null;
  company_name?: string | null;
  support_email?: string | null;
  success_email?: string | null;
  operations_email?: string | null;
  partner_support_email?: string | null;
  primary_color?: string | null;
  primary_hover_color?: string | null;
  primary_foreground_color?: string | null;
  secondary_color?: string | null;
  secondary_hover_color?: string | null;
  secondary_foreground_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  foreground_color?: string | null;
  primary_color_dark?: string | null;
  primary_hover_color_dark?: string | null;
  primary_foreground_color_dark?: string | null;
  secondary_color_dark?: string | null;
  secondary_hover_color_dark?: string | null;
  secondary_foreground_color_dark?: string | null;
  accent_color_dark?: string | null;
  background_color_dark?: string | null;
  foreground_color_dark?: string | null;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  docs_url?: string | null;
  support_portal_url?: string | null;
  status_page_url?: string | null;
  terms_url?: string | null;
  privacy_url?: string | null;
}

export interface TenantBrandingResponseDto {
  tenant_id: string;
  branding: TenantBrandingConfigDto;
  updated_at?: string | null;
}

type BrandingQueryKey = ["tenant-branding", string | null];
type BrandingQueryOptions = Omit<
  UseQueryOptions<TenantBrandingResponseDto, Error, TenantBrandingResponseDto, BrandingQueryKey>,
  "queryKey" | "queryFn"
>;

export function useTenantBrandingQuery(options?: BrandingQueryOptions) {
  const { user } = useSession();
  const tenantId = user?.tenant_id || user?.activeOrganization?.id;
  const hasTenant = Boolean(tenantId);

  // Skip query in bypass mode - no auth/session available
  return useQuery<TenantBrandingResponseDto, Error, TenantBrandingResponseDto, BrandingQueryKey>({
    queryKey: ["tenant-branding", tenantId ?? null],
    queryFn: async () => {
      const response = await apiClient.get<TenantBrandingResponseDto>("/branding");
      return extractDataOrThrow(response, "Failed to load branding configuration");
    },
    enabled: !authBypassEnabled && hasTenant && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useUpdateTenantBranding(
  options?: MutationOptions<TenantBrandingResponseDto, Error, TenantBrandingConfigDto, unknown>,
) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const tenantId = user?.tenant_id || user?.activeOrganization?.id || null;

  return useMutation({
    mutationFn: async (branding: TenantBrandingConfigDto) => {
      const response = await apiClient.put<TenantBrandingResponseDto>("/branding", {
        branding,
      });
      return extractDataOrThrow(response, "Failed to update branding configuration");
    },
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-branding", tenantId] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
