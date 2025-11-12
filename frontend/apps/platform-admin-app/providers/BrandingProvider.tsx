"use client";

import { createContext, ReactNode, useContext, useEffect } from "react";
import { useAppConfig } from "./AppConfigContext";
import { applyBrandingConfig, applyThemeTokens } from "@/lib/theme";

interface BrandingProviderProps {
  children: ReactNode;
}

interface BrandingContextValue {
  branding: ReturnType<typeof useAppConfig>["branding"];
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

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
  const { branding } = useAppConfig();

  useEffect(() => {
    applyThemeTokens({
      "brand-primary": branding.colors?.primary,
      "brand-primary-hover": branding.colors?.primaryHover,
      "brand-primary-foreground": branding.colors?.primaryForeground,
      "brand-secondary": branding.colors?.secondary,
      "brand-secondary-hover": branding.colors?.secondaryHover,
      "brand-secondary-foreground": branding.colors?.secondaryForeground,
      "brand-accent": branding.colors?.accent,
      "brand-background": branding.colors?.background,
      "brand-foreground": branding.colors?.foreground,
    });
    applyBrandingConfig(branding);
    updateFavicon(branding.faviconUrl);
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading: false }}>
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
