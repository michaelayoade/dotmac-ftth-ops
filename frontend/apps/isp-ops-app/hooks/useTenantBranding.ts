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

// Skip auth/session calls in bypass mode to avoid hangs during E2E tests
const authBypassEnabled =
  typeof window !== "undefined" &&
  (process.env["NEXT_PUBLIC_SKIP_BETTER_AUTH"] === "true" ||
   process.env["NEXT_PUBLIC_MSW_ENABLED"] === "true");

export interface TenantBrandingConfigDto {
  product_name?: string | null;
  product_tagline?: string | null;
  company_name?: string | null;
  support_email?: string | null;
  success_email?: string | null;
  operations_email?: string | null;
  partner_support_email?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
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

type BrandingQueryKey = ["tenant-branding"];
type BrandingQueryOptions = Omit<
  UseQueryOptions<TenantBrandingResponseDto, Error, TenantBrandingResponseDto, BrandingQueryKey>,
  "queryKey" | "queryFn"
>;

export function useTenantBrandingQuery(options?: BrandingQueryOptions) {
  // Skip query in bypass mode - no auth/session available
  return useQuery<TenantBrandingResponseDto, Error, TenantBrandingResponseDto, BrandingQueryKey>({
    queryKey: ["tenant-branding"],
    queryFn: async () => {
      const response = await apiClient.get<TenantBrandingResponseDto>("/branding");
      return extractDataOrThrow(response, "Failed to load branding configuration");
    },
    enabled: !authBypassEnabled && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useUpdateTenantBranding(
  options?: MutationOptions<
    TenantBrandingResponseDto,
    Error,
    TenantBrandingConfigDto,
    unknown
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branding: TenantBrandingConfigDto) => {
      const response = await apiClient.put<TenantBrandingResponseDto>("/branding", {
        branding,
      });
      return extractDataOrThrow(response, "Failed to update branding configuration");
    },
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
