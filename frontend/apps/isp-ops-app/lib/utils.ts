/**
 * Utility Functions
 *
 * Common utility functions used throughout the application.
 */

// eslint-disable-next-line no-restricted-imports -- This is the source file for cn()
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: string | Date, format: string = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;

  // Check if date is valid
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  if (format === "short") {
    return new Intl.DateTimeFormat("en-US").format(d);
  }

  if (format === "long") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  if (format === "time") {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
    }).format(d);
  }

  return d.toLocaleDateString();
}

/**
 * Truncate text
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  const delay = Math.max(0, wait);
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

/**
 * Generate random ID
 */
export function generateId(prefix: string = ""): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

const utils = {
  cn,
  formatCurrency,
  formatDate,
  truncate,
  debounce,
  generateId,
};

export default utils;
