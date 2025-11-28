"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { useAppConfig } from "./AppConfigContext";
import { applyBrandingConfig } from "@/lib/theme";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantBrandingQuery } from "@/hooks/useTenantBranding";
import { useToast } from "@dotmac/ui";

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
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tenantBranding = useTenantBrandingQuery({ enabled: Boolean(tenantId) });

  // Invalidate any tenant-specific branding caches if tenant changes
  useEffect(() => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: ["tenant-branding", tenantId] });
    }
  }, [tenantId, queryClient]);

  const brandingSnapshot = useMemo(
    () => tenantBranding.data?.branding ?? branding,
    [branding, tenantBranding.data?.branding],
  );

  useEffect(() => {
    applyBrandingConfig(brandingSnapshot, { theme: themeMode });
    updateFavicon(brandingSnapshot.faviconUrl);
  }, [brandingSnapshot, themeMode]);

  useEffect(() => {
    if (tenantBranding.error && !tenantBranding.isLoading) {
      toast({
        title: "Branding unavailable",
        description: "Using default branding because tenant branding could not be loaded.",
        variant: "destructive",
      });
    }
  }, [tenantBranding.error, tenantBranding.isLoading, toast]);

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
