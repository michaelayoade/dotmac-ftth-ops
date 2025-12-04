/**
 * Configuration Provider for DotMac Framework
 * Provides centralized configuration management across the application
 */

"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import {
  type ConfigContextType,
  defaultFrameworkConfig,
  type FrameworkConfig,
} from "./framework.config";

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
  initialConfig?: Partial<FrameworkConfig>;
  configEndpoint?: string;
}

export function ConfigProvider({
  children,
  initialConfig = {
    // Implementation pending
  },
  configEndpoint,
}: ConfigProviderProps) {
  const [config, setConfig] = useState<FrameworkConfig>(() => ({
    ...defaultFrameworkConfig,
    ...initialConfig,
  }));

  // Load configuration from endpoint if provided
  useEffect(() => {
    if (configEndpoint) {
      fetch(configEndpoint)
        .then((res) => res.json())
        .then((remoteConfig) => {
          setConfig((prev) => ({
            ...prev,
            ...remoteConfig,
          }));
        })
        .catch((_error) => {
          // Error handler implementation pending
        });
    }
  }, [configEndpoint]);

  // Load configuration from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem("dotmac-framework-config");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig((prev) => ({
          ...prev,
          ...parsedConfig,
        }));
      } catch (_error) {
        // Error handling intentionally empty
      }
    }
  }, []);

  // Save configuration changes to localStorage
  const updateConfig = (updates: Partial<FrameworkConfig>) => {
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        ...updates,
      };

      // Save to localStorage
      try {
        localStorage.setItem("dotmac-framework-config", JSON.stringify(newConfig));
      } catch (_error) {
        // Error handling intentionally empty
      }

      return newConfig;
    });
  };

  const resetConfig = () => {
    setConfig(defaultFrameworkConfig);
    localStorage.removeItem("dotmac-framework-config");
  };

  const value: ConfigContextType = {
    config,
    updateConfig,
    resetConfig,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

// Hook to use configuration
export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}

// Utility hook to get specific config sections
export function useLocaleConfig() {
  const { config } = useConfig();
  return config.locale;
}

export function useCurrencyConfig() {
  const { config } = useConfig();
  return config.currency;
}

export function useBusinessConfig() {
  const { config } = useConfig();
  return config.business;
}

export function useBrandingConfig() {
  const { config } = useConfig();
  return config.branding;
}

export function useFeatureFlags() {
  const { config } = useConfig();
  return config.features;
}
