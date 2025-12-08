/**
 * SSR utilities for safe client-side operations
 */

import React from "react";

/**
 * Safely checks if we're running in a browser environment
 * @returns true if window is available (client-side), false if server-side
 */
export const isBrowser = typeof window !== "undefined";

/**
 * Safely checks if we're running on the server
 * @returns true if running server-side, false if client-side
 */
export const isServer = !isBrowser;

/**
 * Safe window accessor that returns undefined on server
 * @returns window object if available, undefined on server
 */
export const safeWindow = isBrowser ? window : undefined;

/**
 * Safe document accessor that returns undefined on server
 * @returns document object if available, undefined on server
 */
export const safeDocument = isBrowser ? document : undefined;

/**
 * Hook for safe client-side effects that should not run on server
 * @param effect - Effect function to run only on client
 * @param deps - Dependencies array
 */
export function useClientEffect(effect: React.EffectCallback, deps: React.DependencyList = []) {
  // Store effect in a ref to avoid re-triggering on effect change
  const effectRef = React.useRef(effect);
  effectRef.current = effect;

  React.useEffect(() => {
    if (isBrowser) {
      return effectRef.current();
    }
  }, deps);
}

/**
 * Hook for layout effects that should only run on client
 * Uses useLayoutEffect for synchronous DOM mutations
 */
export function useBrowserLayoutEffect(effect: React.EffectCallback, deps: React.DependencyList = []) {
  // Store effect in a ref to avoid re-triggering on effect change
  const effectRef = React.useRef(effect);
  effectRef.current = effect;

  React.useLayoutEffect(() => {
    if (isBrowser) {
      return effectRef.current();
    }
  }, deps);
}

/**
 * Hook that returns a boolean indicating if we're hydrated
 * Useful for conditional rendering of client-only content
 * @returns true after hydration, false during SSR and before hydration
 */
export function useIsHydrated() {
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

/**
 * Hook for safely using localStorage with SSR
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist or SSR
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = React.useState<T>(() => {
    if (!isBrowser) {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = React.useCallback(
    (newValue: T | ((val: T) => T)) => {
      try {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        setValue(valueToStore);

        if (isBrowser) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [key, value],
  );

  return [value, setStoredValue] as const;
}

/**
 * Hook for safely using sessionStorage with SSR
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist or SSR
 * @returns [value, setValue] tuple
 */
export function useSessionStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = React.useState<T>(() => {
    if (!isBrowser) {
      return defaultValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = React.useCallback(
    (newValue: T | ((val: T) => T)) => {
      try {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        setValue(valueToStore);

        if (isBrowser) {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch {
        // Silently fail if sessionStorage is not available
      }
    },
    [key, value],
  );

  return [value, setStoredValue] as const;
}

/**
 * Hook for responsive breakpoints that works with SSR
 * @param breakpoint - CSS breakpoint (e.g., '768px', '1024px')
 * @returns boolean indicating if viewport matches breakpoint
 */
export function useMediaQuery(breakpoint: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint})`);
    setMatches(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener("change", listener);

    return () => mediaQuery.removeEventListener("change", listener);
  }, [breakpoint]);

  return matches;
}

/**
 * Hook for detecting user preferences with SSR safety
 * @returns object with user preference states
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = React.useState({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    prefersDarkMode: false,
  });

  React.useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const updatePreferences = () => {
      setPreferences({
        prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        prefersHighContrast: window.matchMedia("(prefers-contrast: high)").matches,
        prefersDarkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      });
    };

    updatePreferences();

    // Listen for changes
    const mediaQueries = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(prefers-contrast: high)"),
      window.matchMedia("(prefers-color-scheme: dark)"),
    ];

    mediaQueries.forEach((mq) => mq.addEventListener("change", updatePreferences));

    return () => {
      mediaQueries.forEach((mq) => mq.removeEventListener("change", updatePreferences));
    };
  }, []);

  return preferences;
}
