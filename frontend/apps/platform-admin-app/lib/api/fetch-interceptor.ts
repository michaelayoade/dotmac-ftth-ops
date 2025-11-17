"use client";

/**
 * Fetch interceptor that rewrites hard-coded /api/v1 paths to the current runtime prefix.
 * This allows older code that concatenates "/api/v1" manually to continue working when
 * the backend changes its REST path via runtime config.
 */

import { platformConfig } from "@/lib/config";

const DEFAULT_PREFIX = "/api/v1";
let originalFetch: typeof fetch | null = null;

function rewriteUrl(url: string): string {
  const desiredPrefix = platformConfig.api.prefix || DEFAULT_PREFIX;

  if (desiredPrefix === DEFAULT_PREFIX) {
    return url;
  }

  const replacePath = (pathname: string): string => {
    if (pathname.startsWith(DEFAULT_PREFIX)) {
      return `${desiredPrefix}${pathname.slice(DEFAULT_PREFIX.length)}`;
    }
    return pathname;
  };

  const isAbsolute = /^https?:\/\//i.test(url);

  if (isAbsolute) {
    try {
      const parsed = new URL(url);
      if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
        parsed.pathname = replacePath(parsed.pathname);
        return parsed.toString();
      }
      return url;
    } catch {
      return url;
    }
  }

  if (url.startsWith(DEFAULT_PREFIX)) {
    return `${desiredPrefix}${url.slice(DEFAULT_PREFIX.length)}`;
  }

  return url;
}

export function setupApiFetchInterceptor(): void {
  if (typeof window === "undefined" || originalFetch) {
    return;
  }

  originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let nextInput = input;

    if (typeof input === "string") {
      nextInput = rewriteUrl(input);
    } else if (input instanceof Request) {
      const rewritten = rewriteUrl(input.url);
      if (rewritten !== input.url) {
        nextInput = new Request(rewritten, input);
      }
    }

    return originalFetch!(nextInput as RequestInfo, init);
  };
}
