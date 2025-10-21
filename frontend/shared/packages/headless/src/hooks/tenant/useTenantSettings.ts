/**
 * Tenant Settings and Branding Hook
 * Handles tenant configuration and branding
 */

import { useState, useCallback, useEffect } from "react";
import { TenantBranding, TenantSession } from "../../types/tenant";
import { getISPApiClient } from "../../api/isp-client";

export interface UseTenantSettingsReturn {
  getTenantSetting: <T = any>(key: string, defaultValue?: T) => T;
  updateTenantSetting: (key: string, value: any) => Promise<void>;
  getBranding: () => TenantBranding;
  applyBranding: () => void;
  isLoading: boolean;
}

export function useTenantSettings(session: TenantSession | null): UseTenantSettingsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [cachedSettings, setCachedSettings] = useState<Record<string, any>>({});

  // Load settings when session changes
  useEffect(() => {
    if (session?.tenant?.settings) {
      setCachedSettings(session.tenant.settings);
    }
  }, [session?.tenant?.settings]);

  const getTenantSetting = useCallback(
    <T = any>(key: string, defaultValue?: T): T => {
      if (!session?.tenant?.settings) {
        return defaultValue as T;
      }

      return session.tenant.settings[key] ?? defaultValue;
    },
    [session?.tenant?.settings],
  );

  const updateTenantSetting = useCallback(
    async (key: string, value: any): Promise<void> => {
      if (!session?.tenant?.id) {
        throw new Error("No active tenant session");
      }

      setIsLoading(true);

      try {
        const apiClient = getISPApiClient();
        await apiClient.updateTenantSettings(session.tenant.id, {
          [key]: value,
        });

        // Update local cache
        setCachedSettings((prev) => ({ ...prev, [key]: value }));
      } catch (error) {
        throw new Error(
          `Failed to update setting: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [session?.tenant?.id],
  );

  const getBranding = useCallback((): TenantBranding => {
    const defaultBranding: TenantBranding = {
      logo_url: "",
      primary_color: "#0ea5e9",
      secondary_color: "#64748b",
      accent_color: "#06b6d4",
      font_family: "Inter, sans-serif",
      custom_css: "",
      favicon_url: "",
      login_background: "",
      company_name: "ISP Portal",
    };

    if (!session?.tenant?.branding) {
      return defaultBranding;
    }

    return {
      ...defaultBranding,
      ...session.tenant.branding,
    };
  }, [session?.tenant?.branding]);

  const applyBranding = useCallback(() => {
    const branding = getBranding();

    if (typeof document === "undefined") return; // SSR check

    // Apply CSS custom properties
    const root = document.documentElement;
    root.style.setProperty("--primary-color", branding.primary_color);
    root.style.setProperty("--secondary-color", branding.secondary_color);
    root.style.setProperty("--accent-color", branding.accent_color);
    root.style.setProperty("--font-family", branding.font_family);

    // Update page title and favicon
    if (branding.company_name) {
      document.title = branding.company_name;
    }

    if (branding.favicon_url) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }

    // Apply custom CSS if provided
    if (branding.custom_css) {
      let style = document.getElementById("tenant-custom-css");
      if (!style) {
        style = document.createElement("style");
        style.id = "tenant-custom-css";
        document.head.appendChild(style);
      }
      style.textContent = branding.custom_css;
    }
  }, [getBranding]);

  // Auto-apply branding when it changes
  useEffect(() => {
    applyBranding();
  }, [applyBranding]);

  return {
    getTenantSetting,
    updateTenantSetting,
    getBranding,
    applyBranding,
    isLoading,
  };
}
