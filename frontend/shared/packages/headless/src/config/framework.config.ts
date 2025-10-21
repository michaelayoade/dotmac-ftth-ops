/**
 * DotMac Framework Configuration
 * Central configuration for ISP framework customization
 */

export interface LocaleConfig {
  primary: string;
  supported: string[];
  fallback: string;
  dateFormat: {
    short: Intl.DateTimeFormatOptions;
    medium: Intl.DateTimeFormatOptions;
    long: Intl.DateTimeFormatOptions;
    time: Intl.DateTimeFormatOptions;
  };
}

export interface CurrencyConfig {
  primary: string;
  symbol: string;
  position: "before" | "after";
  precision: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

export interface BusinessConfig {
  planTypes: {
    [key: string]: {
      label: string;
      category: "residential" | "business" | "enterprise";
      features: string[];
    };
  };
  statusTypes: {
    [key: string]: {
      label: string;
      color: "success" | "warning" | "danger" | "info" | "default";
      description: string;
    };
  };
  partnerTiers: {
    [key: string]: {
      label: string;
      color: "primary" | "secondary" | "warning" | "success" | "danger";
      benefits: string[];
      requirements: {
        customers: number;
        revenue: number;
      };
    };
  };
  units: {
    bandwidth: "mbps" | "gbps";
    data: "gb" | "tb";
    currency: string;
  };
}

export interface BrandingConfig {
  company: {
    name: string;
    logo: string;
    favicon: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
  portal: {
    [key: string]: {
      name: string;
      theme: string;
      logo?: string;
    };
  };
}

export interface FeatureFlags {
  multiTenancy: boolean;
  advancedAnalytics: boolean;
  automatedBilling: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  customDomains: boolean;
  ssoIntegration: boolean;
  mobileApp: boolean;
}

export interface FrameworkConfig {
  locale: LocaleConfig;
  currency: CurrencyConfig;
  business: BusinessConfig;
  branding: BrandingConfig;
  features: FeatureFlags;
  api: {
    baseUrl: string;
    version: string;
    timeout: number;
    retries: number;
  };
  monitoring: {
    analytics: boolean;
    errorReporting: boolean;
    performanceMonitoring: boolean;
    endpoint?: string;
  };
}

// Default configuration
export const defaultFrameworkConfig: FrameworkConfig = {
  locale: {
    primary: "en-US",
    supported: ["en-US", "es-ES", "fr-FR", "de-DE"],
    fallback: "en-US",
    dateFormat: {
      short: { year: "numeric", month: "short", day: "numeric" },
      medium: { year: "numeric", month: "long", day: "numeric" },
      long: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
      time: { hour: "2-digit", minute: "2-digit" },
    },
  },
  currency: {
    primary: "USD",
    symbol: "$",
    position: "before",
    precision: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  business: {
    planTypes: {
      residential_basic: {
        label: "Residential Basic",
        category: "residential",
        features: ["Basic Internet", "24/7 Support", "WiFi Included"],
      },
      residential_premium: {
        label: "Residential Premium",
        category: "residential",
        features: ["High-Speed Internet", "Priority Support", "Advanced WiFi", "Security Suite"],
      },
      business_starter: {
        label: "Business Starter",
        category: "business",
        features: ["Business Internet", "Static IP", "Business Support", "SLA"],
      },
      business_pro: {
        label: "Business Pro",
        category: "business",
        features: ["High-Speed Business", "Multiple IPs", "Priority Support", "99.9% SLA"],
      },
      enterprise: {
        label: "Enterprise",
        category: "enterprise",
        features: [
          "Dedicated Connection",
          "Custom Configuration",
          "Dedicated Support",
          "99.99% SLA",
        ],
      },
    },
    statusTypes: {
      active: {
        label: "Active",
        color: "success",
        description: "Service is active and running",
      },
      pending: {
        label: "Pending",
        color: "warning",
        description: "Service activation in progress",
      },
      suspended: {
        label: "Suspended",
        color: "danger",
        description: "Service temporarily suspended",
      },
      cancelled: {
        label: "Cancelled",
        color: "default",
        description: "Service has been cancelled",
      },
      maintenance: {
        label: "Maintenance",
        color: "info",
        description: "Service under maintenance",
      },
    },
    partnerTiers: {
      bronze: {
        label: "Bronze Partner",
        color: "secondary",
        benefits: ["5% Commission", "Basic Support", "Marketing Materials"],
        requirements: { customers: 10, revenue: 5000 },
      },
      silver: {
        label: "Silver Partner",
        color: "primary",
        benefits: ["10% Commission", "Priority Support", "Co-marketing"],
        requirements: { customers: 25, revenue: 15000 },
      },
      gold: {
        label: "Gold Partner",
        color: "warning",
        benefits: ["15% Commission", "Dedicated Support", "Custom Materials"],
        requirements: { customers: 50, revenue: 35000 },
      },
      platinum: {
        label: "Platinum Partner",
        color: "success",
        benefits: ["20% Commission", "Account Manager", "API Access"],
        requirements: { customers: 100, revenue: 75000 },
      },
    },
    units: {
      bandwidth: "mbps",
      data: "gb",
      currency: "USD",
    },
  },
  branding: {
    company: {
      name: "DotMac ISP",
      logo: "/assets/logo.svg",
      favicon: "/assets/favicon.ico",
      colors: {
        primary: "#3b82f6",
        secondary: "#64748b",
        accent: "#10b981",
      },
    },
    portal: {
      admin: {
        name: "Admin Portal",
        theme: "professional",
      },
      customer: {
        name: "Customer Portal",
        theme: "friendly",
      },
      reseller: {
        name: "Partner Portal",
        theme: "business",
      },
    },
  },
  features: {
    multiTenancy: true,
    advancedAnalytics: true,
    automatedBilling: true,
    apiAccess: true,
    whiteLabel: false,
    customDomains: false,
    ssoIntegration: false,
    mobileApp: false,
  },
  api: {
    baseUrl: "/api",
    version: "v1",
    timeout: 30000,
    retries: 3,
  },
  monitoring: {
    analytics: true,
    errorReporting: true,
    performanceMonitoring: true,
  },
};

// Configuration provider types
export interface ConfigContextType {
  config: FrameworkConfig;
  updateConfig: (updates: Partial<FrameworkConfig>) => void;
  resetConfig: () => void;
}
