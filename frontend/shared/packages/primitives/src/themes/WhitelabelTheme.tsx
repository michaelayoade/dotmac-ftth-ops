/**
 * Whitelabel Theme Provider
 * Dynamic theming system for partner branding
 * Leverages existing ISPBrandTheme with runtime configuration
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface WhitelabelConfig {
  brand: {
    name: string;
    tagline?: string;
    logo: string;
    logo_dark?: string;
    favicon?: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    font_family: string;
    font_url?: string;
  };
  domain: {
    custom?: string;
    ssl: boolean;
    verified: boolean;
  };
  contact: {
    email: string;
    phone?: string;
    support_url?: string;
  };
  legal: {
    company_name: string;
    privacy_url?: string;
    terms_url?: string;
    address?: string;
  };
  social: {
    website?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
  };
  css_variables: Record<string, string>;
  custom_css?: string;
}

interface WhitelabelContextType {
  config: WhitelabelConfig | null;
  isWhitelabel: boolean;
  updateConfig: (config: WhitelabelConfig) => void;
  resetToDefault: () => void;
}

const WhitelabelContext = createContext<WhitelabelContextType | undefined>(undefined);

interface WhitelabelThemeProviderProps {
  children: ReactNode;
  partnerId?: string;
  domain?: string;
  fallbackConfig?: WhitelabelConfig;
  apiEndpoint?: string;
}

export const WhitelabelThemeProvider: React.FC<WhitelabelThemeProviderProps> = ({
  children,
  partnerId,
  domain,
  fallbackConfig,
  apiEndpoint = "/api/isp/v1/admin/partners",
}) => {
  const [config, setConfig] = useState<WhitelabelConfig | null>(fallbackConfig || null);
  const [isWhitelabel, setIsWhitelabel] = useState(!!fallbackConfig);
  const [loading, setLoading] = useState(!!partnerId || !!domain);

  // Load whitelabel configuration
  useEffect(() => {
    if (partnerId || domain) {
      loadWhitelabelConfig();
    }
  }, [partnerId, domain]);

  const loadWhitelabelConfig = async () => {
    try {
      setLoading(true);

      let url: string;
      if (domain) {
        // Load by domain (public access)
        url = `${apiEndpoint}/by-domain/${domain}/theme`;
      } else if (partnerId) {
        // Load by partner ID (admin access)
        url = `${apiEndpoint}/${partnerId}/brand/theme`;
      } else {
        return;
      }

      const response = await fetch(url);

      if (response.ok) {
        const whitelabelConfig = await response.json();
        setConfig(whitelabelConfig);
        setIsWhitelabel(true);

        // Apply dynamic CSS variables
        applyThemeVariables(whitelabelConfig);

        // Load custom font if specified
        if (whitelabelConfig.typography.font_url) {
          loadCustomFont(whitelabelConfig.typography.font_url);
        }

        // Update favicon if specified
        if (whitelabelConfig.brand.favicon) {
          updateFavicon(whitelabelConfig.brand.favicon);
        }

        // Update document title if brand name exists
        if (whitelabelConfig.brand.name) {
          updatePageTitle(whitelabelConfig.brand.name);
        }
      } else if (response.status === 404) {
        // No whitelabel config found, use default theme
        setIsWhitelabel(false);
        setConfig(null);
      }
    } catch (error) {
      console.error("Failed to load whitelabel configuration:", error);
      setIsWhitelabel(false);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (newConfig: WhitelabelConfig) => {
    setConfig(newConfig);
    setIsWhitelabel(true);
    applyThemeVariables(newConfig);

    if (newConfig.typography.font_url) {
      loadCustomFont(newConfig.typography.font_url);
    }

    if (newConfig.brand.favicon) {
      updateFavicon(newConfig.brand.favicon);
    }
  };

  const resetToDefault = () => {
    setConfig(null);
    setIsWhitelabel(false);

    // Remove custom CSS variables
    const root = document.documentElement;
    Object.keys(config?.css_variables || {}).forEach((variable) => {
      root.style.removeProperty(variable);
    });

    // Reset favicon
    updateFavicon("/favicon.ico");

    // Reset page title
    document.title = "DotMac ISP Framework";
  };

  const applyThemeVariables = (themeConfig: WhitelabelConfig) => {
    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(themeConfig.css_variables).forEach(([variable, value]) => {
      root.style.setProperty(variable, value);
    });

    // Apply base colors
    root.style.setProperty("--color-primary", themeConfig.colors.primary);
    root.style.setProperty("--color-secondary", themeConfig.colors.secondary);
    root.style.setProperty("--color-accent", themeConfig.colors.accent);
    root.style.setProperty("--color-background", themeConfig.colors.background);
    root.style.setProperty("--color-text", themeConfig.colors.text);

    // Apply typography
    root.style.setProperty("--font-family", themeConfig.typography.font_family);

    // Inject custom CSS if provided
    if (themeConfig.custom_css) {
      injectCustomCSS(themeConfig.custom_css);
    }
  };

  const loadCustomFont = (fontUrl: string) => {
    // Check if font is already loaded
    const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
    if (existingLink) return;

    // Create and append font link
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontUrl;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };

  const updateFavicon = (faviconUrl: string) => {
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;

    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }

    favicon.href = faviconUrl;
  };

  const updatePageTitle = (brandName: string) => {
    // Only update if not already set by the page
    if (document.title === "DotMac ISP Framework" || !document.title) {
      document.title = brandName;
    }
  };

  const injectCustomCSS = (customCSS: string) => {
    // Remove existing custom CSS
    const existingStyle = document.getElementById("whitelabel-custom-css");
    if (existingStyle) {
      existingStyle.remove();
    }

    // Inject new custom CSS
    const style = document.createElement("style");
    style.id = "whitelabel-custom-css";
    style.textContent = customCSS;
    document.head.appendChild(style);
  };

  const contextValue: WhitelabelContextType = {
    config,
    isWhitelabel,
    updateConfig,
    resetToDefault,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <WhitelabelContext.Provider value={contextValue}>{children}</WhitelabelContext.Provider>;
};

// Hook for using whitelabel context
export const useWhitelabel = () => {
  const context = useContext(WhitelabelContext);
  if (context === undefined) {
    throw new Error("useWhitelabel must be used within a WhitelabelThemeProvider");
  }
  return context;
};

// Helper component for brand logo
export const WhitelabelLogo: React.FC<{
  className?: string;
  variant?: "light" | "dark";
  fallbackText?: string;
}> = ({ className = "h-8", variant = "light", fallbackText = "Logo" }) => {
  const { config, isWhitelabel } = useWhitelabel();

  if (!isWhitelabel || !config?.brand.logo) {
    return (
      <div className={`${className} flex items-center font-bold text-primary-600`}>
        {fallbackText}
      </div>
    );
  }

  const logoUrl =
    variant === "dark" && config.brand.logo_dark ? config.brand.logo_dark : config.brand.logo;

  return (
    <img
      src={logoUrl}
      alt={config.brand.name}
      className={className}
      onError={(e) => {
        // Fallback to text if image fails to load
        const target = e.target as HTMLElement;
        target.style.display = "none";
        if (target.nextSibling) {
          (target.nextSibling as HTMLElement).style.display = "block";
        }
      }}
    />
  );
};

// Helper component for brand contact info
export const WhitelabelContact: React.FC<{
  type: "email" | "phone" | "support";
  className?: string;
  fallback?: string;
}> = ({ type, className, fallback }) => {
  const { config, isWhitelabel } = useWhitelabel();

  if (!isWhitelabel || !config?.contact) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }

  const contactInfo = {
    email: config.contact.email,
    phone: config.contact.phone,
    support: config.contact.support_url,
  };

  const value = contactInfo[type];
  if (!value) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }

  if (type === "email") {
    return (
      <a href={`mailto:${value}`} className={className}>
        {value}
      </a>
    );
  }

  if (type === "phone") {
    return (
      <a href={`tel:${value}`} className={className}>
        {value}
      </a>
    );
  }

  if (type === "support") {
    return (
      <a href={value} className={className} target="_blank" rel="noopener noreferrer">
        Support
      </a>
    );
  }

  return <span className={className}>{value}</span>;
};

export default WhitelabelThemeProvider;
