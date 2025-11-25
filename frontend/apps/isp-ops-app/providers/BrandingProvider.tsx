"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { useAppConfig } from "./AppConfigContext";
import { applyBrandingConfig, applyThemeTokens } from "@/lib/theme";
import { useTenantBrandingQuery, type TenantBrandingConfigDto } from "@/hooks/useTenantBranding";
import { isAuthBypassEnabled } from "@dotmac/better-auth";

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

  const mergedColors = {
    ...defaultBranding.colors,
    primary: overrides.primary_color ?? defaultBranding.colors?.primary,
    primaryHover: overrides.primary_color ?? defaultBranding.colors?.primaryHover,
    primaryForeground: defaultBranding.colors?.primaryForeground,
    secondary: overrides.secondary_color ?? defaultBranding.colors?.secondary,
    secondaryHover: overrides.secondary_color ?? defaultBranding.colors?.secondaryHover,
    secondaryForeground: defaultBranding.colors?.secondaryForeground,
    accent: overrides.accent_color ?? defaultBranding.colors?.accent,
    background: defaultBranding.colors?.background,
    foreground: defaultBranding.colors?.foreground,
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
    partnerSupportEmail:
      overrides.partner_support_email ?? defaultBranding.partnerSupportEmail,
    colors: mergedColors,
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

  const mergedBranding = useMemo(
    () => mergeBranding(defaultBranding, brandingQuery.data?.branding),
    [defaultBranding, brandingQuery.data?.branding],
  );

  useEffect(() => {
    applyThemeTokens({
      "brand-primary": mergedBranding.colors?.primary,
      "brand-primary-hover": mergedBranding.colors?.primaryHover,
      "brand-primary-foreground": mergedBranding.colors?.primaryForeground,
      "brand-secondary": mergedBranding.colors?.secondary,
      "brand-secondary-hover": mergedBranding.colors?.secondaryHover,
      "brand-secondary-foreground": mergedBranding.colors?.secondaryForeground,
      "brand-accent": mergedBranding.colors?.accent,
      "brand-background": mergedBranding.colors?.background,
      "brand-foreground": mergedBranding.colors?.foreground,
    });
    applyBrandingConfig(mergedBranding);
    updateFavicon(mergedBranding.faviconUrl);
  }, [mergedBranding]);

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
