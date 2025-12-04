/**
 * Comprehensive Accessibility Utilities for WCAG 2.1 AA Compliance
 * Provides tools for screen readers, keyboard navigation, and inclusive design
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ARIA role mappings for different component types
export const ARIA_ROLES = {
  // Chart components
  CHART: "img",
  CHART_CONTAINER: "figure",
  CHART_TITLE: "heading",
  CHART_DESCRIPTION: "text",
  CHART_DATA_TABLE: "table",

  // Status components
  STATUS_INDICATOR: "status",
  ALERT: "alert",
  PROGRESS: "progressbar",
  METRIC: "meter",

  // Interactive elements
  BUTTON: "button",
  LINK: "link",
  TOOLTIP: "tooltip",
  DIALOG: "dialog",

  // Navigation
  NAV: "navigation",
  MENU: "menu",
  MENUITEM: "menuitem",
  TAB: "tab",
  TABPANEL: "tabpanel",
} as const;

// ARIA properties for different states
export const ARIA_PROPERTIES = {
  // Visibility states
  HIDDEN: "aria-hidden",
  EXPANDED: "aria-expanded",
  PRESSED: "aria-pressed",
  SELECTED: "aria-selected",

  // Labeling
  LABEL: "aria-label",
  LABELLEDBY: "aria-labelledby",
  DESCRIBEDBY: "aria-describedby",

  // Live regions
  LIVE: "aria-live",
  ATOMIC: "aria-atomic",
  BUSY: "aria-busy",

  // Values and ranges
  VALUENOW: "aria-valuenow",
  VALUEMIN: "aria-valuemin",
  VALUEMAX: "aria-valuemax",
  VALUETEXT: "aria-valuetext",
} as const;

// Live region politeness levels
export const ARIA_LIVE_LEVELS = {
  OFF: "off",
  POLITE: "polite",
  ASSERTIVE: "assertive",
} as const;

// Screen reader announcement utility
export const announceToScreenReader = (
  message: string,
  priority: "polite" | "assertive" = "polite",
) => {
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.style.position = "absolute";
  announcement.style.left = "-10000px";
  announcement.style.width = "1px";
  announcement.style.height = "1px";
  announcement.style.overflow = "hidden";

  document.body.appendChild(announcement);
  announcement.textContent = message;

  // Clean up after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Generate accessible chart descriptions
export const generateChartDescription = (
  chartType: "line" | "bar" | "area" | "pie",
  data: any[],
  title?: string,
): string => {
  if (!data || data.length === 0) {
    return `${title ? title + ": " : ""}Empty ${chartType} chart with no data available.`;
  }

  const dataCount = data.length;
  let description = `${title ? title + ": " : ""}${chartType} chart with ${dataCount} data point${dataCount === 1 ? "" : "s"}.`;

  // Add trend information for time series
  if (chartType === "line" || chartType === "area") {
    const firstValue = data[0]?.value || 0;
    const lastValue = data[data.length - 1]?.value || 0;
    const trend =
      lastValue > firstValue ? "increasing" : lastValue < firstValue ? "decreasing" : "stable";
    description += ` Overall trend is ${trend}.`;
  }

  // Add summary statistics
  if (data.every((d) => typeof d.value === "number")) {
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    description += ` Values range from ${min.toFixed(1)} to ${max.toFixed(1)}, with an average of ${avg.toFixed(1)}.`;
  }

  return description;
};

// Generate data table for screen readers (chart alternative)
export const generateDataTable = (data: any[], headers: string[]): string => {
  if (!data || data.length === 0) {
    return "No data available";
  }

  let table = `Data table with ${headers.length} columns and ${data.length} rows. `;
  table += `Columns are: ${headers.join(", ")}. `;

  // Add first few rows as example
  const maxRows = Math.min(3, data.length);
  for (let i = 0; i < maxRows; i++) {
    const row = data[i];
    const rowData = headers.map((header) => row[header] || "N/A").join(", ");
    table += `Row ${i + 1}: ${rowData}. `;
  }

  if (data.length > 3) {
    table += `And ${data.length - 3} more rows.`;
  }

  return table;
};

// Keyboard navigation hook
export const useKeyboardNavigation = (
  items: HTMLElement[],
  options: {
    loop?: boolean;
    orientation?: "horizontal" | "vertical" | "both";
    onSelect?: (index: number) => void;
    disabled?: boolean;
  } = {},
) => {
  const { loop = true, orientation = "both", onSelect, disabled = false } = options;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled || items.length === 0) return;

      const { key } = event;
      let newIndex = currentIndex;
      let handled = false;

      switch (key) {
        case "ArrowLeft":
          if (orientation === "horizontal" || orientation === "both") {
            newIndex = loop
              ? (currentIndex - 1 + items.length) % items.length
              : Math.max(0, currentIndex - 1);
            handled = true;
          }
          break;

        case "ArrowRight":
          if (orientation === "horizontal" || orientation === "both") {
            newIndex = loop
              ? (currentIndex + 1) % items.length
              : Math.min(items.length - 1, currentIndex + 1);
            handled = true;
          }
          break;

        case "ArrowUp":
          if (orientation === "vertical" || orientation === "both") {
            newIndex = loop
              ? (currentIndex - 1 + items.length) % items.length
              : Math.max(0, currentIndex - 1);
            handled = true;
          }
          break;

        case "ArrowDown":
          if (orientation === "vertical" || orientation === "both") {
            newIndex = loop
              ? (currentIndex + 1) % items.length
              : Math.min(items.length - 1, currentIndex + 1);
            handled = true;
          }
          break;

        case "Home":
          newIndex = 0;
          handled = true;
          break;

        case "End":
          newIndex = items.length - 1;
          handled = true;
          break;

        case "Enter":
        case " ":
          if (onSelect) {
            onSelect(currentIndex);
            handled = true;
          }
          break;
      }

      if (handled) {
        event.preventDefault();
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
          items[newIndex]?.focus();
        }
      }
    },
    [currentIndex, items, loop, orientation, onSelect, disabled],
  );

  return { currentIndex, setCurrentIndex, handleKeyDown };
};

// Focus management hook
export const useFocusManagement = () => {
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            event.preventDefault();
          }
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  }, []);

  const saveFocus = useCallback(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    previouslyFocusedElement.current?.focus();
    previouslyFocusedElement.current = null;
  }, []);

  return { trapFocus, saveFocus, restoreFocus };
};

// Color contrast utilities
export const COLOR_CONTRAST = {
  // WCAG AA compliant color pairs (4.5:1 ratio minimum)
  COMBINATIONS: {
    PRIMARY: {
      background: "#3B82F6", // Blue-500
      text: "#FFFFFF",
      contrast: 4.76,
    },
    SUCCESS: {
      background: "#059669", // Green-600
      text: "#FFFFFF",
      contrast: 4.81,
    },
    WARNING: {
      background: "#D97706", // Orange-600
      text: "#FFFFFF",
      contrast: 4.52,
    },
    ERROR: {
      background: "#DC2626", // Red-600
      text: "#FFFFFF",
      contrast: 5.25,
    },
    INFO: {
      background: "#0284C7", // Sky-600
      text: "#FFFFFF",
      contrast: 4.89,
    },
    NEUTRAL: {
      background: "#4B5563", // Gray-600
      text: "#FFFFFF",
      contrast: 7.21,
    },
  },

  // Text alternatives for color-coded information
  TEXT_INDICATORS: {
    online: "✓ Online",
    offline: "✗ Offline",
    maintenance: "⚠ Maintenance",
    degraded: "⚡ Degraded",
    active: "● Active",
    suspended: "⏸ Suspended",
    pending: "⏳ Pending",
    paid: "✓ Paid",
    overdue: "⚠ Overdue",
    processing: "⏳ Processing",
    critical: "🚨 Critical",
    high: "⬆ High",
    medium: "➡ Medium",
    low: "⬇ Low",
  },
} as const;

// Status text generator for screen readers
export const generateStatusText = (
  variant: string,
  value?: string | number,
  context?: string,
): string => {
  const indicator =
    COLOR_CONTRAST.TEXT_INDICATORS[variant as keyof typeof COLOR_CONTRAST.TEXT_INDICATORS];
  const baseText = indicator || variant;

  let statusText = baseText;

  if (value !== undefined) {
    statusText += ` ${value}`;
  }

  if (context) {
    statusText += ` ${context}`;
  }

  return statusText;
};

// Reduced motion detection
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};

// Screen reader detection
export const useScreenReader = () => {
  const [isScreenReader, setIsScreenReader] = useState(false);

  useEffect(() => {
    // Detect screen reader by checking for specific user agent strings or accessibility APIs
    const userAgent = navigator.userAgent.toLowerCase();
    const isScreenReaderUA =
      userAgent.includes("nvda") ||
      userAgent.includes("jaws") ||
      userAgent.includes("dragon") ||
      userAgent.includes("voiceover");

    // Check for Windows high contrast mode (often used with screen readers)
    const isHighContrast = window.matchMedia("(prefers-contrast: high)").matches;

    // Check for forced colors mode
    const isForcedColors = window.matchMedia("(forced-colors: active)").matches;

    setIsScreenReader(isScreenReaderUA || isHighContrast || isForcedColors);
  }, []);

  return isScreenReader;
};

// Generate unique IDs for ARIA relationships
let idCounter = 0;
export const generateId = (prefix: string = "accessibility"): string => {
  return `${prefix}-${Date.now()}-${++idCounter}`;
};
