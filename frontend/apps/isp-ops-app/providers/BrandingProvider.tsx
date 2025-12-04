"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { useAppConfig } from "./AppConfigContext";
import { applyBrandingConfig } from "@/lib/theme";
import { useTenantBrandingQuery, type TenantBrandingConfigDto } from "@/hooks/useTenantBranding";
import { isAuthBypassEnabled } from "@shared/lib/auth";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useToast } from "@dotmac/ui";

// Skip auth/session calls in bypass mode to avoid hangs during E2E tests
const authBypassEnabled = isAuthBypassEnabled();

interface BrandingProviderProps {
  children: ReactNode;
}

export interface BrandingContextValue {
  branding: ReturnType<typeof useAppConfig>["branding"];
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function mergeBranding(
  defaultBranding: BrandingContextValue["branding"],
  overrides?: TenantBrandingConfigDto,
) {
  if (!overrides) {
    return defaultBranding;
  }

  const baseColors = defaultBranding.colors || {};
  const mergedLight = {
    ...(baseColors.light || {}),
    primary: overrides.primary_color ?? baseColors.light?.primary ?? baseColors.primary,
    primaryHover:
      overrides.primary_hover_color ??
      baseColors.light?.primaryHover ??
      baseColors.primaryHover ??
      overrides.primary_color,
    primaryForeground:
      overrides.primary_foreground_color ??
      baseColors.light?.primaryForeground ??
      baseColors.primaryForeground,
    secondary: overrides.secondary_color ?? baseColors.light?.secondary ?? baseColors.secondary,
    secondaryHover:
      overrides.secondary_hover_color ??
      baseColors.light?.secondaryHover ??
      baseColors.secondaryHover ??
      overrides.secondary_color,
    secondaryForeground:
      overrides.secondary_foreground_color ??
      baseColors.light?.secondaryForeground ??
      baseColors.secondaryForeground,
    accent: overrides.accent_color ?? baseColors.light?.accent ?? baseColors.accent,
    background: overrides.background_color ?? baseColors.light?.background ?? baseColors.background,
    foreground: overrides.foreground_color ?? baseColors.light?.foreground ?? baseColors.foreground,
  };

  const mergedDark = {
    ...(baseColors.dark || {}),
    primary: overrides.primary_color_dark ?? baseColors.dark?.primary ?? mergedLight.primary,
    primaryHover:
      overrides.primary_hover_color_dark ??
      baseColors.dark?.primaryHover ??
      baseColors.primaryHover ??
      mergedLight.primaryHover,
    primaryForeground:
      overrides.primary_foreground_color_dark ??
      baseColors.dark?.primaryForeground ??
      baseColors.primaryForeground,
    secondary:
      overrides.secondary_color_dark ?? baseColors.dark?.secondary ?? mergedLight.secondary,
    secondaryHover:
      overrides.secondary_hover_color_dark ??
      baseColors.dark?.secondaryHover ??
      baseColors.secondaryHover ??
      mergedLight.secondaryHover,
    secondaryForeground:
      overrides.secondary_foreground_color_dark ??
      baseColors.dark?.secondaryForeground ??
      baseColors.secondaryForeground,
    accent: overrides.accent_color_dark ?? baseColors.dark?.accent ?? mergedLight.accent,
    background:
      overrides.background_color_dark ??
      baseColors.dark?.background ??
      baseColors.background ??
      "#0b1220",
    foreground:
      overrides.foreground_color_dark ??
      baseColors.dark?.foreground ??
      baseColors.foreground ??
      "#e2e8f0",
  };

  const mergedLogos = {
    ...defaultBranding.logo,
    light: overrides.logo_light_url ?? defaultBranding.logo?.light,
    dark: overrides.logo_dark_url ?? defaultBranding.logo?.dark,
  };

  return {
    ...defaultBranding,
    productName: overrides.product_name ?? defaultBranding.productName,
    productTagline: overrides.product_tagline ?? defaultBranding.productTagline,
    companyName: overrides.company_name ?? defaultBranding.companyName,
    supportEmail: overrides.support_email ?? defaultBranding.supportEmail,
    successEmail: overrides.success_email ?? defaultBranding.successEmail,
    partnerSupportEmail: overrides.partner_support_email ?? defaultBranding.partnerSupportEmail,
    colors: {
      ...baseColors,
      ...mergedLight,
      light: mergedLight,
      dark: mergedDark,
    },
    logo: mergedLogos,
    faviconUrl: overrides.favicon_url ?? defaultBranding.faviconUrl ?? "/favicon.ico",
    docsUrl: overrides.docs_url ?? defaultBranding.docsUrl,
    supportPortalUrl: overrides.support_portal_url ?? defaultBranding.supportPortalUrl,
    statusPageUrl: overrides.status_page_url ?? defaultBranding.statusPageUrl,
    termsUrl: overrides.terms_url ?? defaultBranding.termsUrl,
    privacyUrl: overrides.privacy_url ?? defaultBranding.privacyUrl,
  };
}

function updateFavicon(faviconUrl?: string) {
  if (typeof document === "undefined") return;
  const href = faviconUrl || "/favicon.ico";

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const { branding: defaultBranding } = useAppConfig();
  // Skip session/branding queries in bypass mode to avoid hangs
  const brandingQuery = useTenantBrandingQuery({ enabled: !authBypassEnabled });
  const { resolvedTheme } = useTheme();
  const themeMode = resolvedTheme === "dark" ? "dark" : "light";
  const { tenant } = useTenant();
  const { toast } = useToast();

  const mergedBranding = useMemo(
    () => mergeBranding(defaultBranding, brandingQuery.data?.branding),
    [defaultBranding, brandingQuery.data?.branding],
  );

  useEffect(() => {
    applyBrandingConfig(mergedBranding, { theme: themeMode });
    updateFavicon(mergedBranding.faviconUrl);
  }, [mergedBranding, themeMode]);

  useEffect(() => {
    if (brandingQuery.error && !brandingQuery.isLoading) {
      toast({
        title: "Branding unavailable",
        description: "Using default branding because tenant branding could not be loaded.",
        variant: "destructive",
      });
    }
  }, [brandingQuery.error, brandingQuery.isLoading, toast]);

  return (
    <BrandingContext.Provider
      value={{ branding: mergedBranding, isLoading: brandingQuery.isLoading }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBrandingContext(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBrandingContext must be used within BrandingProvider");
  }
  return ctx;
}
