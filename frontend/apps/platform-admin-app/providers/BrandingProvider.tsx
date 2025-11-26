"use client";

import { createContext, ReactNode, useContext, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppConfig } from "./AppConfigContext";
import { applyBrandingConfig } from "@/lib/theme";

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
  const { resolvedTheme } = useTheme();
  const themeMode = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    applyBrandingConfig(branding, { theme: themeMode });
    updateFavicon(branding.faviconUrl);
  }, [branding, themeMode]);

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
