/**
 * Responsive Breakpoint Manager
 * Provides utilities for responsive design and breakpoint management
 */

import { breakpoints } from "../tokens/design-tokens";
import React from "react";

export type Breakpoint = keyof typeof breakpoints;
export type BreakpointValue = (typeof breakpoints)[Breakpoint];

export interface BreakpointConfig {
  breakpoints: typeof breakpoints;
  defaultBreakpoint: Breakpoint;
  enableSSR: boolean;
}

export interface ResponsiveValue<T> {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  "2xl"?: T;
}

export interface MediaQueryResult {
  matches: boolean;
  breakpoint: Breakpoint;
  width: number;
}

const defaultConfig: BreakpointConfig = {
  breakpoints,
  defaultBreakpoint: "md",
  enableSSR: true,
};

export class BreakpointManager {
  private config: BreakpointConfig;
  private mediaQueries: Map<Breakpoint, MediaQueryList> = new Map();
  private currentBreakpoint: Breakpoint = "md";
  private subscribers: Set<(breakpoint: Breakpoint) => void> = new Set();

  constructor(config: Partial<BreakpointConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.currentBreakpoint = this.config.defaultBreakpoint;
    this.initialize();
  }

  private initialize(): void {
    if (typeof window === "undefined") return;

    // Create media queries for each breakpoint
    Object.entries(this.config.breakpoints).forEach(([name, value]) => {
      const breakpoint = name as Breakpoint;
      const mediaQuery = window.matchMedia(`(min-width: ${value})`);

      mediaQuery.addEventListener("change", () => {
        this.updateCurrentBreakpoint();
      });

      this.mediaQueries.set(breakpoint, mediaQuery);
    });

    // Set initial breakpoint
    this.updateCurrentBreakpoint();
  }

  private updateCurrentBreakpoint(): void {
    const breakpointEntries = Object.entries(this.config.breakpoints) as [Breakpoint, string][];

    // Find the largest matching breakpoint
    let newBreakpoint = "xs" as Breakpoint;

    for (const [breakpoint, _] of breakpointEntries.reverse()) {
      const mediaQuery = this.mediaQueries.get(breakpoint);
      if (mediaQuery?.matches) {
        newBreakpoint = breakpoint;
        break;
      }
    }

    if (newBreakpoint !== this.currentBreakpoint) {
      this.currentBreakpoint = newBreakpoint;
      this.notifySubscribers();
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.currentBreakpoint));
  }

  /**
   * Get current active breakpoint
   */
  getCurrentBreakpoint(): Breakpoint {
    return this.currentBreakpoint;
  }

  /**
   * Get current window width
   */
  getCurrentWidth(): number {
    if (typeof window === "undefined") return 0;
    return window.innerWidth;
  }

  /**
   * Check if current viewport matches a breakpoint
   */
  matches(breakpoint: Breakpoint): boolean {
    if (typeof window === "undefined") {
      return this.config.enableSSR ? breakpoint === this.config.defaultBreakpoint : false;
    }

    const mediaQuery = this.mediaQueries.get(breakpoint);
    return mediaQuery?.matches ?? false;
  }

  /**
   * Check if current viewport is at least a certain breakpoint
   */
  isAtLeast(breakpoint: Breakpoint): boolean {
    const breakpointOrder: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
    const currentIndex = breakpointOrder.indexOf(this.currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);

    return currentIndex >= targetIndex;
  }

  /**
   * Check if current viewport is at most a certain breakpoint
   */
  isAtMost(breakpoint: Breakpoint): boolean {
    const breakpointOrder: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
    const currentIndex = breakpointOrder.indexOf(this.currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);

    return currentIndex <= targetIndex;
  }

  /**
   * Check if current viewport is between two breakpoints
   */
  isBetween(minBreakpoint: Breakpoint, maxBreakpoint: Breakpoint): boolean {
    return this.isAtLeast(minBreakpoint) && this.isAtMost(maxBreakpoint);
  }

  /**
   * Subscribe to breakpoint changes
   */
  subscribe(callback: (breakpoint: Breakpoint) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Resolve responsive value to current breakpoint value
   */
  resolveValue<T>(responsiveValue: ResponsiveValue<T> | T): T | undefined {
    if (!responsiveValue || typeof responsiveValue !== "object") {
      return responsiveValue as T;
    }

    const responsive = responsiveValue as ResponsiveValue<T>;
    const breakpointOrder: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
    const currentIndex = breakpointOrder.indexOf(this.currentBreakpoint);

    // Look for exact match first
    if (responsive[this.currentBreakpoint] !== undefined) {
      return responsive[this.currentBreakpoint];
    }

    // Fall back to largest available breakpoint that's smaller than current
    for (let i = currentIndex; i >= 0; i--) {
      const breakpoint = breakpointOrder[i];
      if (responsive[breakpoint] !== undefined) {
        return responsive[breakpoint];
      }
    }

    // If no smaller breakpoint found, try larger ones
    for (let i = currentIndex + 1; i < breakpointOrder.length; i++) {
      const breakpoint = breakpointOrder[i];
      if (responsive[breakpoint] !== undefined) {
        return responsive[breakpoint];
      }
    }

    return undefined;
  }

  /**
   * Create media query string for a breakpoint
   */
  createMediaQuery(breakpoint: Breakpoint, type: "min" | "max" = "min"): string {
    const value = this.config.breakpoints[breakpoint];
    return `(${type}-width: ${value})`;
  }

  /**
   * Get all breakpoint values
   */
  getBreakpoints(): typeof breakpoints {
    return this.config.breakpoints;
  }

  /**
   * Convert breakpoint to pixel value
   */
  getBreakpointValue(breakpoint: Breakpoint): number {
    const value = this.config.breakpoints[breakpoint];
    return parseInt(value.replace("px", ""));
  }
}

// Default breakpoint manager instance
export const breakpointManager = new BreakpointManager();

// React hook for responsive breakpoints
export const useBreakpoint = (): {
  breakpoint: Breakpoint;
  width: number;
  matches: (bp: Breakpoint) => boolean;
  isAtLeast: (bp: Breakpoint) => boolean;
  isAtMost: (bp: Breakpoint) => boolean;
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
} => {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(() =>
    breakpointManager.getCurrentBreakpoint(),
  );

  const [width, setWidth] = React.useState<number>(() => breakpointManager.getCurrentWidth());

  React.useEffect(() => {
    const handleResize = () => {
      setWidth(breakpointManager.getCurrentWidth());
    };

    const unsubscribe = breakpointManager.subscribe((newBreakpoint) => {
      setBreakpoint(newBreakpoint);
    });

    window.addEventListener("resize", handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const matches = React.useCallback(
    (bp: Breakpoint) => {
      return breakpointManager.matches(bp);
    },
    [breakpoint],
  );

  const isAtLeast = React.useCallback(
    (bp: Breakpoint) => {
      return breakpointManager.isAtLeast(bp);
    },
    [breakpoint],
  );

  const isAtMost = React.useCallback(
    (bp: Breakpoint) => {
      return breakpointManager.isAtMost(bp);
    },
    [breakpoint],
  );

  const isBetween = React.useCallback(
    (min: Breakpoint, max: Breakpoint) => {
      return breakpointManager.isBetween(min, max);
    },
    [breakpoint],
  );

  return {
    breakpoint,
    width,
    matches,
    isAtLeast,
    isAtMost,
    isBetween,
  };
};

// Hook for responsive values
export const useResponsiveValue = <T,>(value: ResponsiveValue<T> | T): T | undefined => {
  const { breakpoint } = useBreakpoint();

  return React.useMemo(() => {
    return breakpointManager.resolveValue(value);
  }, [value, breakpoint]);
};

// Utility functions for responsive design
export const responsive = {
  /**
   * Create responsive CSS classes
   */
  classes: (base: string, responsive: ResponsiveValue<string>): string => {
    let classes = base;

    Object.entries(responsive).forEach(([bp, value]) => {
      if (value) {
        const prefix = bp === "xs" ? "" : `${bp}:`;
        classes += ` ${prefix}${value}`;
      }
    });

    return classes;
  },

  /**
   * Create responsive styles object
   */
  styles: <T extends React.CSSProperties>(
    base: T,
    responsiveStyles: ResponsiveValue<Partial<T>>,
  ): T => {
    const currentValue = breakpointManager.resolveValue(responsiveStyles);
    return { ...base, ...currentValue };
  },

  /**
   * Generate media queries for CSS-in-JS
   */
  mediaQueries: Object.entries(breakpoints).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: `@media (min-width: ${value})`,
    }),
    {} as Record<Breakpoint, string>,
  ),

  /**
   * Responsive grid system
   */
  grid: {
    container: {
      width: "100%",
      maxWidth: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      margin: "0 auto",
      padding: {
        xs: "1rem",
        sm: "1.5rem",
        md: "2rem",
      },
    },

    columns: (cols: ResponsiveValue<number>): ResponsiveValue<string> => {
      const transform = (value: number) => `repeat(${value}, minmax(0, 1fr))`;

      return Object.entries(cols).reduce(
        (acc, [bp, value]) => ({
          ...acc,
          [bp]: typeof value === "number" ? transform(value) : value,
        }),
        {},
      ) as ResponsiveValue<string>;
    },
  },
};

// React component for responsive visibility
export const Responsive: React.FC<{
  children: React.ReactNode;
  show?: ResponsiveValue<boolean>;
  hide?: ResponsiveValue<boolean>;
}> = ({ children, show, hide }) => {
  const shouldShow = useResponsiveValue(show);
  const shouldHide = useResponsiveValue(hide);

  if (shouldHide === true || shouldShow === false) {
    return null;
  }

  return <>{children}</>;
};

// Higher-order component for responsive rendering
export const withResponsive = <P extends object>(
  Component: React.ComponentType<P>,
  responsiveProps: ResponsiveValue<Partial<P>>,
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const resolvedProps = useResponsiveValue(responsiveProps);
    const mergedProps = { ...props, ...resolvedProps };

    return <Component ref={ref} {...mergedProps} />;
  });
};

export default BreakpointManager;
