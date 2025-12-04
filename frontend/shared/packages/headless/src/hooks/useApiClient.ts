import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../auth/store";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface UseApiClientConfig {
  baseURL?: string;
  portal?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableCaching?: boolean;
  cacheTimeout?: number;
  responseTransformer?: (data: any) => any;
  headers?: Record<string, string>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const DEFAULTS: Required<
  Pick<
    UseApiClientConfig,
    "timeout" | "retries" | "retryDelay" | "enableCaching" | "cacheTimeout"
  >
> = {
  timeout: 5000,
  retries: 0,
  retryDelay: 300,
  enableCaching: false,
  cacheTimeout: 5000,
};

export function useApiClient(config: UseApiClientConfig = {}) {
  const auth = useAuthStore();
  const finalConfig = useMemo(
    () => ({
      ...DEFAULTS,
      baseURL: "",
      ...config,
    }),
    [config],
  );

  const [isLoading, setIsLoading] = useState(false);
  const loadingMap = useRef<Map<string, boolean>>(new Map());
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const pendingRejects = useRef<Map<string, (error: any) => void>>(new Map());
  const cancelledRequests = useRef<Set<string>>(new Set());

  const setLoadingFor = useCallback((url: string, loading: boolean) => {
    const map = loadingMap.current;
    if (loading) {
      map.set(url, true);
    } else {
      map.delete(url);
    }
    setIsLoading(map.size > 0);
  }, []);

  const resolveUrl = useCallback(
    (path: string) => {
      if (!finalConfig.baseURL) return path;
      const separator = path.startsWith("/") ? "" : "/";
      return `${finalConfig.baseURL}${separator}${path}`;
    },
    [finalConfig.baseURL],
  );

  const buildHeaders = useCallback(
    (extra?: Record<string, string>, overrideToken?: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...finalConfig.headers,
        ...(extra || {}),
      };

      const token = overrideToken || auth?.tokens?.accessToken;
      if (auth?.isAuthenticated && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (auth?.user?.tenantId) {
        headers["X-Tenant-ID"] = auth.user.tenantId;
      }
      if (finalConfig.portal) {
        headers["X-Portal"] = finalConfig.portal;
      }

      return headers;
    },
    [auth, finalConfig.headers, finalConfig.portal],
  );

  const shouldUseCache = (method: HttpMethod, options?: RequestOptions) => {
    if (method !== "GET") return false;
    if (options && options.cache === false) return false;
    return finalConfig.enableCaching;
  };

  const maybeFromCache = (cacheKey: string) => {
    const entry = cache.current.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.current.delete(cacheKey);
      return null;
    }
    return entry.data;
  };

  const saveToCache = (cacheKey: string, data: any) => {
    cache.current.set(cacheKey, {
      data,
      expiresAt: Date.now() + finalConfig.cacheTimeout,
    });
  };

  const isRequestLoading = useCallback((url: string) => loadingMap.current.has(url), []);

  const invalidateCache = useCallback((url: string) => {
    const keys = Array.from(cache.current.keys());
    keys
      .filter((key) => key.endsWith(url))
      .forEach((key) => {
        cache.current.delete(key);
      });
  }, []);

  const cancelRequest = useCallback(
    (url: string) => {
      const controller = controllers.current.get(url);
      const reject = pendingRejects.current.get(url);
      if (reject) {
        reject(new Error("Request aborted"));
        pendingRejects.current.delete(url);
      }
      if (controller) {
        controller.abort();
        controllers.current.delete(url);
        setLoadingFor(url, false);
      }
      cancelledRequests.current.add(url);
    },
    [setLoadingFor],
  );

  const sendRequest = useCallback(
    async (method: HttpMethod, path: string, data?: any, options?: RequestOptions) => {
      const url = resolveUrl(path);
      const cacheKey = `${method}:${url}`;

      if (shouldUseCache(method, options)) {
        const cached = maybeFromCache(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      const controller = new AbortController();
      controllers.current.set(url, controller);
      const timeoutMs = options?.timeout ?? finalConfig.timeout;
      const maxRetries = options?.retries ?? finalConfig.retries;
      let attempt = 0;

      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const execute = async (tokenOverride?: string): Promise<any> => {
        try {
          if (cancelledRequests.current.has(url)) {
            throw new Error("Request aborted");
          }
          setLoadingFor(url, true);

          const requestInit: RequestInit = {
            method,
            headers: buildHeaders(options?.headers, tokenOverride),
            signal: controller.signal,
          };

          if (data && method !== "GET" && method !== "HEAD") {
            requestInit.body = JSON.stringify(data);
          }

          const response = await fetch(url, requestInit);

          if (!response) {
            throw new Error("Request aborted");
          }

          if (controller.signal.aborted) {
            throw new Error("Request aborted");
          }

          if (cancelledRequests.current.has(url)) {
            throw new Error("Request aborted");
          }

          const responseHeaders = (response as any)?.headers;
          const safeHeaders =
            responseHeaders && typeof responseHeaders.get === "function"
              ? responseHeaders
              : new Headers(
                  (responseHeaders && typeof responseHeaders === "object" && responseHeaders) || {},
                );
          const contentType = safeHeaders.get("content-type") || undefined;
          const isJsonResponse = contentType ? contentType.includes("application/json") : true;
          let parsed: any = null;
          if (typeof (response as any).json === "function") {
            try {
              parsed = await (response as any).json();
            } catch (err) {
              if (isJsonResponse) {
                throw new Error((err as Error).message || "Invalid JSON response");
              }
            }
          }

          if (!(response as any).ok) {
            if ((response as any).status === 401 && auth?.refreshToken) {
              const refreshed = await auth.refreshToken();
              if (refreshed?.accessToken) {
                return execute(refreshed.accessToken);
              }
            }
            const message =
              parsed?.error ||
              parsed?.message ||
              (response as any).statusText ||
              "Request failed";
            const error: any = new Error(message);
            error.status = (response as any).status;
            throw error;
          }

          if (cancelledRequests.current.has(url)) {
            throw new Error("Request aborted");
          }

          const result = finalConfig.responseTransformer
            ? finalConfig.responseTransformer(parsed ?? response)
            : parsed ?? response;

          if (shouldUseCache(method, options)) {
            saveToCache(cacheKey, result);
          }

          return result;
        } catch (error: any) {
          if (controller.signal.aborted || cancelledRequests.current.has(url)) {
            throw new Error(error?.message || "Request aborted");
          }
          if (attempt < maxRetries && (error?.status == null || error.status >= 500)) {
            attempt += 1;
            await delay(finalConfig.retryDelay);
            return execute(tokenOverride);
          }

          throw error;
        } finally {
          setLoadingFor(url, false);
          controllers.current.delete(url);
        }
      };

      const outerPromise = new Promise<any>((resolve, reject) => {
        pendingRejects.current.set(url, reject);
        let timeoutTriggered = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        if (timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            timeoutTriggered = true;
            controller.abort();
            setLoadingFor(url, false);
            controllers.current.delete(url);
            cancelledRequests.current.add(url);
            pendingRejects.current.delete(url);
            reject(new Error("Request timeout"));
          }, timeoutMs);
        }

        execute()
          .then(resolve)
          .catch((error) => {
            if (timeoutTriggered) {
              reject(new Error("Request timeout"));
            } else if (cancelledRequests.current.has(url) || controller.signal.aborted) {
              reject(new Error("Request aborted"));
            } else {
              reject(error);
            }
          })
          .finally(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            pendingRejects.current.delete(url);
            cancelledRequests.current.delete(url);
          });
      });

      return outerPromise;
    },
    [
      auth,
      buildHeaders,
      finalConfig.cacheTimeout,
      finalConfig.enableCaching,
      finalConfig.retryDelay,
      finalConfig.retries,
      finalConfig.timeout,
      resolveUrl,
      setLoadingFor,
    ],
  );

  const get = useCallback(
    (path: string, options?: RequestOptions) => sendRequest("GET", path, undefined, options),
    [sendRequest],
  );
  const post = useCallback(
    (path: string, body?: any, options?: RequestOptions) => sendRequest("POST", path, body, options),
    [sendRequest],
  );
  const put = useCallback(
    (path: string, body?: any, options?: RequestOptions) => sendRequest("PUT", path, body, options),
    [sendRequest],
  );
  const del = useCallback(
    (path: string, options?: RequestOptions) => sendRequest("DELETE", path, undefined, options),
    [sendRequest],
  );

  useEffect(
    () => () => {
      controllers.current.forEach((controller, url) => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        pendingRejects.current.delete(url);
      });
      controllers.current.clear();
      pendingRejects.current.clear();
      loadingMap.current.clear();
      setIsLoading(false);
    },
    [],
  );

  const api = {
    get,
    post,
    put,
    delete: del,
    isLoading,
    isRequestLoading,
    invalidateCache,
    cancelRequest,
  };

  return api;
}
