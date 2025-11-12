/**
 * SSR-safe utilities for DOM and browser API access
 */

/**
 * Check if code is running in browser environment
 */
export const isBrowser = (): boolean => {
  return typeof window !== "undefined" && typeof document !== "undefined";
};

/**
 * Check if code is running on server (SSR)
 */
export const isServer = (): boolean => {
  return !isBrowser();
};

/**
 * Safe window access
 */
export const safeWindow = (): Window | undefined => {
  return isBrowser() ? window : undefined;
};

/**
 * Safe document access
 */
export const safeDocument = (): Document | undefined => {
  return isBrowser() ? document : undefined;
};

/**
 * Safe localStorage access
 */
export const safeLocalStorage = (): Storage | undefined => {
  return isBrowser() ? window.localStorage : undefined;
};

/**
 * Safe sessionStorage access
 */
export const safeSessionStorage = (): Storage | undefined => {
  return isBrowser() ? window.sessionStorage : undefined;
};

/**
 * Safe navigator access
 */
export const safeNavigator = (): Navigator | undefined => {
  return isBrowser() ? window.navigator : undefined;
};

/**
 * Safe location access
 */
export const safeLocation = (): Location | undefined => {
  return isBrowser() ? window.location : undefined;
};

/**
 * Safe crypto access
 */
export const safeCrypto = (): Crypto | undefined => {
  return isBrowser() ? window.crypto : undefined;
};

/**
 * Execute function only in browser
 */
export const browserOnly = <T>(fn: () => T, fallback?: T): T | undefined => {
  if (isBrowser()) {
    try {
      return fn();
    } catch (error) {
      console.error("Browser-only function error:", error);
      return fallback;
    }
  }
  return fallback;
};

/**
 * Execute function only on server
 */
export const serverOnly = <T>(fn: () => T, fallback?: T): T | undefined => {
  if (isServer()) {
    try {
      return fn();
    } catch (error) {
      console.error("Server-only function error:", error);
      return fallback;
    }
  }
  return fallback;
};

/**
 * Safe requestAnimationFrame
 */
export const safeRequestAnimationFrame = (callback: FrameRequestCallback): number | null => {
  if (isBrowser() && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }
  return null;
};

/**
 * Safe cancelAnimationFrame
 */
export const safeCancelAnimationFrame = (id: number): void => {
  if (isBrowser() && window.cancelAnimationFrame && id) {
    window.cancelAnimationFrame(id);
  }
};

/**
 * Safe setTimeout (works in both environments)
 */
export const safeSetTimeout = (callback: () => void, delay?: number): NodeJS.Timeout | number => {
  return setTimeout(callback, delay);
};

/**
 * Safe clearTimeout (works in both environments)
 */
export const safeClearTimeout = (id: NodeJS.Timeout | number): void => {
  clearTimeout(id as any);
};

/**
 * Get viewport dimensions safely
 */
export const getViewportDimensions = (): {
  width: number;
  height: number;
} | null => {
  if (isBrowser()) {
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight,
    };
  }
  return null;
};

/**
 * Check if media query matches
 */
export const matchesMediaQuery = (query: string): boolean => {
  if (isBrowser() && window.matchMedia) {
    return window.matchMedia(query).matches;
  }
  return false;
};

/**
 * Add event listener safely
 */
export const safeAddEventListener = <K extends keyof WindowEventMap>(
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
): (() => void) | null => {
  if (isBrowser()) {
    window.addEventListener(type, listener, options);
    return () => window.removeEventListener(type, listener, options);
  }
  return null;
};

/**
 * Get cookie value safely
 */
export const getCookie = (name: string): string | null => {
  if (!isBrowser()) return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }

  return null;
};

/**
 * Set cookie safely
 */
export const setCookie = (
  name: string,
  value: string,
  options: {
    expires?: Date;
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
  } = {},
): void => {
  if (!isBrowser()) return;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.expires) {
    cookieString += `; expires=${options.expires.toUTCString()}`;
  }

  if (options.maxAge) {
    cookieString += `; max-age=${options.maxAge}`;
  }

  if (options.path) {
    cookieString += `; path=${options.path}`;
  }

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  if (options.secure) {
    cookieString += "; secure";
  }

  if (options.sameSite) {
    cookieString += `; samesite=${options.sameSite}`;
  }

  document.cookie = cookieString;
};

/**
 * Delete cookie safely
 */
export const deleteCookie = (name: string, path = "/"): void => {
  if (!isBrowser()) return;

  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env["NODE_ENV"] === "development";
};

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
  return process.env["NODE_ENV"] === "production";
};

/**
 * Check if running in test mode
 */
export const isTest = (): boolean => {
  return process.env["NODE_ENV"] === "test";
};
