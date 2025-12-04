/**
 * i18n Utility Functions
 *
 * Type-safe helpers for translations
 */

import {
  JobStatus,
  TicketStatus,
  CustomerStatus,
  PaymentStatus,
  InvoiceStatus,
} from "@dotmac/types";
import type { Locale } from "../../i18n";

/**
 * Get translated status label
 *
 * Type-safe wrapper for status translations
 */
export function getStatusLabel(
  t: (key: string) => string,
  status: JobStatus | TicketStatus | CustomerStatus | PaymentStatus | InvoiceStatus,
  namespace: "jobs" | "tickets" | "customers" | "billing.payment" | "billing.invoice",
): string {
  // Convert enum value to translation key format
  // e.g., 'in_progress' -> 'inProgress'
  const key = status
    .split("_")
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");

  return t(`${namespace}.status.${key}`);
}

/**
 * Format date with locale-aware formatting
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(dateObj);
}

/**
 * Format currency with locale-aware formatting
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: Locale = "en",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format number with locale-aware formatting
 */
export function formatNumber(
  value: number,
  locale: Locale = "en",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(
  t: (key: string, values?: Record<string, unknown>) => string,
  date: Date | string,
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 1) {
    return t("time.now");
  } else if (diffMinutes < 60) {
    return t("time.minutesAgo", { count: diffMinutes });
  } else if (diffHours < 24) {
    return t("time.hoursAgo", { count: diffHours });
  } else if (diffDays < 7) {
    return t("time.daysAgo", { count: diffDays });
  } else if (diffWeeks < 4) {
    return t("time.weeksAgo", { count: diffWeeks });
  } else if (diffMonths < 12) {
    return t("time.monthsAgo", { count: diffMonths });
  } else {
    return t("time.yearsAgo", { count: diffYears });
  }
}

/**
 * Get validation error message
 */
export function getValidationError(
  t: (key: string, values?: Record<string, unknown>) => string,
  field: string,
  errorType:
    | "required"
    | "email"
    | "minLength"
    | "maxLength"
    | "pattern"
    | "number"
    | "positive"
    | "url"
    | "phone",
  params?: Record<string, unknown>,
): string {
  return t(`forms.validation.${errorType}`, { field, ...params });
}
