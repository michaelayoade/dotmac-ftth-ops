/**
 * ISP Branding Override System
 *
 * Allows individual ISP tenants to customize their portal appearance
 * while maintaining design system consistency
 */

"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useState } from "react";
import { usePortalTheme } from "@dotmac/ui";

/**
 * Branding customization options for ISP tenants
 */
export interface ISPBrandingConfig {
  /** Tenant/ISP identifier */
  tenantId: string;

  /** Brand identity */
  brandName: string;
  logoUrl?: string;
  faviconUrl?: string;

  /** Color overrides (optional - uses portal defaults if not specified) */
  colors?: {
    primary?: string; // HSL format: "hsl(207, 90%, 54%)"
    accent?: string;
    // Additional color overrides can be added here
  };

  /** Typography overrides */
  typography?: {
    fontFamily?: string; // Custom font family
    headingWeight?: number; // Default heading font weight
  };

  /** Logo positioning and sizing */
  logo?: {
    maxWidth?: string; // e.g., "200px"
    maxHeight?: string; // e.g., "60px"
    position?: "left" | "center";
  };

  /** Custom messaging */
  messaging?: {
    tagline?: string;
    supportEmail?: string;
    supportPhone?: string;
    helpUrl?: string;
  };

  /** Feature toggles */
  features?: {
    showPoweredByDotMac?: boolean;
    customFooter?: boolean;
  };
}

/**
 * Default branding config
 */
const defaultBrandingConfig: ISPBrandingConfig = {
  tenantId: "default",
  brandName: "Your ISP",
  features: {
    showPoweredByDotMac: true,
    customFooter: false,
  },
};

/**
 * Branding Context
 */
interface BrandingContextValue {
  branding: ISPBrandingConfig;
  updateBranding: (config: Partial<ISPBrandingConfig>) => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/**
 * ISP Branding Provider
 * Manages tenant-specific branding overrides
 */
export function ISPBrandingProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  initialBranding?: Partial<ISPBrandingConfig>;
}) {
  const { theme, currentPortal } = usePortalTheme();
  const [branding, setBranding] = useState<ISPBrandingConfig>(() => ({
    ...defaultBrandingConfig,
    ...initialBranding,
  }));

  // Apply branding CSS variables
  useEffect(() => {
    const root = document.documentElement;

    // Apply color overrides if specified
    if (branding.colors?.primary) {
      root.style.setProperty("--portal-primary-override", branding.colors.primary);
    }
    if (branding.colors?.accent) {
      root.style.setProperty("--portal-accent-override", branding.colors.accent);
    }

    // Apply typography overrides
    if (branding.typography?.fontFamily) {
      root.style.setProperty("--font-family-override", branding.typography.fontFamily);
    }

    // Set branding data attributes for CSS targeting
    root.setAttribute("data-tenant-id", branding.tenantId);
    root.setAttribute("data-branded", "true");

    return () => {
      root.style.removeProperty("--portal-primary-override");
      root.style.removeProperty("--portal-accent-override");
      root.style.removeProperty("--font-family-override");
      root.removeAttribute("data-tenant-id");
      root.removeAttribute("data-branded");
    };
  }, [branding]);

  // Update favicon if custom one is provided
  useEffect(() => {
    if (branding.faviconUrl) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = branding.faviconUrl;
      }
    }
  }, [branding.faviconUrl]);

  // Update document title with brand name
  useEffect(() => {
    if (branding.brandName) {
      const baseTitle = document.title.split(" | ")[0] || "";
      document.title = baseTitle ? `${baseTitle} | ${branding.brandName}` : branding.brandName;
    }
  }, [branding.brandName]);

  const updateBranding = (config: Partial<ISPBrandingConfig>) => {
    setBranding((prev) => ({ ...prev, ...config }));
  };

  const resetBranding = () => {
    setBranding(defaultBrandingConfig);
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        updateBranding,
        resetBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Hook to access ISP branding configuration
 */
export function useISPBranding() {
  const context = useContext(BrandingContext);

  if (!context) {
    throw new Error("useISPBranding must be used within ISPBrandingProvider");
  }

  return context;
}

/**
 * Hook to get effective primary color (with branding override)
 */
export function useEffectivePrimaryColor(): string {
  const { theme } = usePortalTheme();
  const { branding } = useISPBranding();

  return branding.colors?.primary || theme.colors.primary[500];
}

/**
 * Hook to get effective accent color (with branding override)
 */
export function useEffectiveAccentColor(): string {
  const { theme } = usePortalTheme();
  const { branding } = useISPBranding();

  return branding.colors?.accent || theme.colors.accent.DEFAULT;
}

/**
 * Branded Logo Component
 */
export function BrandedLogo({ className }: { className?: string }) {
  const { branding } = useISPBranding();
  const { theme } = usePortalTheme();

  if (branding.logoUrl) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: branding.logo?.maxWidth || "180px",
          height: branding.logo?.maxHeight || "50px",
        }}
      >
        <Image
          src={branding.logoUrl}
          alt={branding.brandName}
          fill
          style={{
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  // Fallback to text logo with portal icon
  return (
    <div className={className}>
      <span className="text-2xl mr-2">{theme.metadata.icon}</span>
      <span className="font-bold text-lg">{branding.brandName}</span>
    </div>
  );
}

/**
 * Powered By Footer Component
 */
export function PoweredByFooter({ className }: { className?: string }) {
  const { branding } = useISPBranding();

  if (!branding.features?.showPoweredByDotMac) {
    return null;
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="https://dotmac.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-portal-primary transition-colors"
        >
          DotMac Platform
        </a>
      </p>
    </div>
  );
}

/**
 * Fetch branding configuration from API
 */
export async function fetchBrandingConfig(tenantId: string): Promise<ISPBrandingConfig> {
  try {
    const response = await fetch(`/api/isp/v1/tenants/${tenantId}/branding`);

    if (!response.ok) {
      console.warn(`Failed to fetch branding for tenant ${tenantId}, using defaults`);
      return { ...defaultBrandingConfig, tenantId };
    }

    const data = await response.json();
    return { ...defaultBrandingConfig, ...data, tenantId };
  } catch (error) {
    console.error("Error fetching branding config:", error);
    return { ...defaultBrandingConfig, tenantId };
  }
}

/**
 * Save branding configuration to API
 */
export async function saveBrandingConfig(
  tenantId: string,
  config: Partial<ISPBrandingConfig>,
): Promise<boolean> {
  try {
    const response = await fetch(`/api/isp/v1/tenants/${tenantId}/branding`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    return response.ok;
  } catch (error) {
    console.error("Error saving branding config:", error);
    return false;
  }
}

/**
 * Example ISP branding configurations
 */
export const exampleBrandingConfigs: Record<string, Partial<ISPBrandingConfig>> = {
  /**
   * Example 1: Fiber Internet Co.
   * Professional blue ISP with custom colors
   */
  fiberco: {
    tenantId: "fiberco",
    brandName: "Fiber Internet Co.",
    colors: {
      primary: "hsl(210, 100%, 45%)", // Bright blue
      accent: "hsl(160, 70%, 45%)", // Teal
    },
    messaging: {
      tagline: "Lightning-Fast Fiber Internet",
      supportEmail: "support@fiberco.com",
      supportPhone: "1-800-FIBER-CO",
    },
    features: {
      showPoweredByDotMac: true,
    },
  },

  /**
   * Example 2: Community Wireless
   * Warm, community-focused ISP
   */
  communitywifi: {
    tenantId: "communitywifi",
    brandName: "Community Wireless",
    colors: {
      primary: "hsl(30, 95%, 50%)", // Warm orange
      accent: "hsl(45, 100%, 50%)", // Golden yellow
    },
    messaging: {
      tagline: "Connecting Our Community",
      supportEmail: "hello@communitywifi.org",
      helpUrl: "https://help.communitywifi.org",
    },
    features: {
      showPoweredByDotMac: false, // White-label
      customFooter: true,
    },
  },

  /**
   * Example 3: Metro Broadband
   * Modern, tech-forward ISP
   */
  metrobroadband: {
    tenantId: "metrobroadband",
    brandName: "Metro Broadband",
    colors: {
      primary: "hsl(270, 80%, 50%)", // Purple
      accent: "hsl(330, 80%, 55%)", // Pink
    },
    typography: {
      headingWeight: 700,
    },
    messaging: {
      tagline: "Internet for the Modern City",
      supportEmail: "support@metrobroadband.net",
      supportPhone: "(555) 123-4567",
    },
  },
};
