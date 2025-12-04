/**
 * Tenant Settings and Branding Hook
 * Handles tenant configuration and branding
 */

import { useState, useCallback, useEffect } from "react";
import type { TenantBranding, TenantSession } from "../../types/tenant";

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

  const storageKey = session?.tenant?.id ? `tenant-settings-${session.tenant.id}` : null;

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setCachedSettings({});
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      setCachedSettings(stored ? JSON.parse(stored) : {});
    } catch {
      setCachedSettings({});
    }
  }, [storageKey]);

  const getTenantSetting = useCallback(
    <T = any>(key: string, defaultValue?: T): T => {
      return (cachedSettings[key] ?? defaultValue) as T;
    },
    [cachedSettings],
  );

  const updateTenantSetting = useCallback(
    async (key: string, value: any): Promise<void> => {
      if (!storageKey || typeof window === "undefined") {
        setCachedSettings((prev) => ({ ...prev, [key]: value }));
        return;
      }

      setIsLoading(true);
      setCachedSettings((prev) => {
        const next = { ...prev, [key]: value };
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      setIsLoading(false);
    },
    [storageKey],
  );

  const getBranding = useCallback((): TenantBranding => {
    const defaultBranding: TenantBranding = {
      logo_url: "",
      primary_color: "#0ea5e9",
      secondary_color: "#64748b",
      accent_color: "#06b6d4",
      custom_css: "",
      favicon_url: "",
      company_name: "ISP Portal",
      white_label: false,
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
