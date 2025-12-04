/**
 * Formatting hooks for DotMac Framework
 * Configurable formatting utilities for currency, dates, and numbers
 */

import { useCallback } from "react";

import {
  useBusinessConfig,
  useConfig,
  useCurrencyConfig,
  useLocaleConfig,
} from "../config/ConfigProvider";

export function useFormatting() {
  const localeConfig = useLocaleConfig();
  const currencyConfig = useCurrencyConfig();
  const businessConfig = useBusinessConfig();

  // Currency formatting
  const formatCurrency = useCallback(
    (
      amount: number,
      options: {
        currency?: string;
        locale?: string;
        precision?: number;
      } = {
        // Implementation pending
      },
    ) => {
      const currency = options.currency || currencyConfig.primary;
      const locale = options.locale || localeConfig.primary;
      const minimumFractionDigits = options.precision ?? currencyConfig.precision;

      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }).format(amount);
    },
    [currencyConfig, localeConfig],
  );

  // Date formatting
  const formatDate = useCallback(
    (
      date: string | Date,
      format: "short" | "medium" | "long" | "time" | Intl.DateTimeFormatOptions = "short",
      locale?: string,
    ) => {
      const targetLocale = locale || localeConfig.primary;
      const dateObj = typeof date === "string" ? new Date(date) : date;

      const formatOptions = typeof format === "string" ? localeConfig.dateFormat[format] : format;

      return dateObj.toLocaleDateString(targetLocale, formatOptions);
    },
    [localeConfig],
  );

  // Number formatting
  const formatNumber = useCallback(
    (
      number: number,
      options: Intl.NumberFormatOptions = {
        // Implementation pending
      },
      locale?: string,
    ) => {
      const targetLocale = locale || localeConfig.primary;
      return new Intl.NumberFormat(targetLocale, options).format(number);
    },
    [localeConfig],
  );

  // Percentage formatting
  const formatPercentage = useCallback(
    (value: number, precision: number = 1, locale?: string) => {
      const targetLocale = locale || localeConfig.primary;
      return new Intl.NumberFormat(targetLocale, {
        style: "percent",
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value / 100);
    },
    [localeConfig],
  );

  // Bandwidth formatting
  const formatBandwidth = useCallback(
    (value: number, unit?: "mbps" | "gbps") => {
      const targetUnit = unit || businessConfig.units.bandwidth;

      if (targetUnit === "gbps" && value >= 1000) {
        return `${(value / 1000).toFixed(1)} Gbps`;
      }

      return `${value} ${targetUnit.toUpperCase()}`;
    },
    [businessConfig],
  );

  // Data size formatting
  const formatDataSize = useCallback((bytes: number, precision: number = 2) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(precision)} ${units[unitIndex]}`;
  }, []);

  // Relative time formatting
  const formatRelativeTime = useCallback(
    (date: string | Date, locale?: string) => {
      const targetLocale = locale || localeConfig.primary;
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

      if (diffInSeconds < 60) {
        return "Just now";
      }
      if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)}m ago`;
      }
      if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)}h ago`;
      }
      if (diffInSeconds < 2592000) {
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
      }

      return dateObj.toLocaleDateString(targetLocale, localeConfig.dateFormat.short);
    },
    [localeConfig],
  );

  // Status formatting
  const formatStatus = useCallback(
    (status: string, _type: "customer" | "service" | "partner" = "customer") => {
      const statusConfig = businessConfig.statusTypes[status];
      if (!statusConfig) {
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          color: "default" as const,
          description: "",
        };
      }
      return statusConfig;
    },
    [businessConfig],
  );

  // Plan formatting
  const formatPlan = useCallback(
    (planKey: string) => {
      const planConfig = businessConfig.planTypes[planKey];
      if (!planConfig) {
        return {
          label: planKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          category: "residential" as const,
          features: [],
        };
      }
      return planConfig;
    },
    [businessConfig],
  );

  return {
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercentage,
    formatBandwidth,
    formatDataSize,
    formatRelativeTime,
    formatStatus,
    formatPlan,
    // Direct access to configs for advanced use cases
    localeConfig,
    currencyConfig,
    businessConfig,
  };
}

// Specialized hooks for common use cases
export function useCurrencyFormatter() {
  const { formatCurrency } = useFormatting();
  return formatCurrency;
}

export function useDateFormatter() {
  const { formatDate } = useFormatting();
  return formatDate;
}

export function useBusinessFormatter() {
  const { formatStatus, formatPlan, formatBandwidth } = useFormatting();
  return { formatStatus, formatPlan, formatBandwidth };
}
