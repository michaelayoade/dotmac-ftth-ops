/**
 * @jest-environment jsdom
 */

import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import Cookies from "js-cookie";

import { AuthInterceptor } from "../auth-interceptor";

// Mock js-cookie
jest.mock("js-cookie", () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AuthInterceptor", () => {
  const mockCookies = Cookies as jest.Mocked<typeof Cookies>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("constructor", () => {
    it("uses default configuration when no config provided", () => {
      const interceptor = new AuthInterceptor();
      // We can verify defaults through behavior
      mockCookies.get.mockReturnValue("test-token");

      const config = { headers: {} } as InternalAxiosRequestConfig;
      const result = interceptor.requestInterceptor(config);

      expect(mockCookies.get).toHaveBeenCalledWith("access_token");
      expect(result.headers?.["Authorization"]).toBe("Bearer test-token");
    });

    it("merges custom configuration with defaults", () => {
      const interceptor = new AuthInterceptor({
        tokenKey: "custom_token",
        headerPrefix: "Token",
      });

      mockCookies.get.mockReturnValue("custom-value");

      const config = { headers: {} } as InternalAxiosRequestConfig;
      const result = interceptor.requestInterceptor(config);

      expect(mockCookies.get).toHaveBeenCalledWith("custom_token");
      expect(result.headers?.["Authorization"]).toBe("Token custom-value");
    });
  });

  describe("requestInterceptor", () => {
    describe("cookie token source", () => {
      it("adds authorization header when token exists in cookie", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "cookie" });
        mockCookies.get.mockReturnValue("cookie-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("Bearer cookie-token");
      });

      it("does not add header when cookie token is missing", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "cookie" });
        mockCookies.get.mockReturnValue(undefined);

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBeUndefined();
      });
    });

    describe("localStorage token source", () => {
      it("adds authorization header when token exists in localStorage", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "localStorage" });
        localStorage.setItem("access_token", "local-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("Bearer local-token");
      });

      it("does not add header when localStorage token is missing", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "localStorage" });

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBeUndefined();
      });
    });

    describe("sessionStorage token source", () => {
      it("adds authorization header when token exists in sessionStorage", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "sessionStorage" });
        sessionStorage.setItem("access_token", "session-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("Bearer session-token");
      });

      it("does not add header when sessionStorage token is missing", () => {
        const interceptor = new AuthInterceptor({ tokenSource: "sessionStorage" });

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBeUndefined();
      });
    });

    describe("skipAuth option", () => {
      it("does not add authorization header when skipAuth is true", () => {
        const interceptor = new AuthInterceptor();
        mockCookies.get.mockReturnValue("valid-token");

        const config = { headers: {}, skipAuth: true } as InternalAxiosRequestConfig & { skipAuth?: boolean };
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBeUndefined();
      });

      it("adds authorization header when skipAuth is false", () => {
        const interceptor = new AuthInterceptor();
        mockCookies.get.mockReturnValue("valid-token");

        const config = { headers: {}, skipAuth: false } as InternalAxiosRequestConfig & { skipAuth?: boolean };
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("Bearer valid-token");
      });

      it("adds authorization header when skipAuth is undefined", () => {
        const interceptor = new AuthInterceptor();
        mockCookies.get.mockReturnValue("valid-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("Bearer valid-token");
      });
    });

    describe("custom header configuration", () => {
      it("uses custom header name", () => {
        const interceptor = new AuthInterceptor({
          headerName: "X-Auth-Token",
          headerPrefix: "",
        });
        mockCookies.get.mockReturnValue("custom-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Auth-Token"]).toBe(" custom-token");
      });

      it("uses custom header prefix", () => {
        const interceptor = new AuthInterceptor({
          headerPrefix: "JWT",
        });
        mockCookies.get.mockReturnValue("jwt-token");

        const config = { headers: {} } as InternalAxiosRequestConfig;
        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["Authorization"]).toBe("JWT jwt-token");
      });
    });

    it("preserves existing headers", () => {
      const interceptor = new AuthInterceptor();
      mockCookies.get.mockReturnValue("token");

      const config = {
        headers: {
          "Content-Type": "application/json",
          "X-Custom": "value"
        }
      } as InternalAxiosRequestConfig;
      const result = interceptor.requestInterceptor(config);

      expect(result.headers?.["Content-Type"]).toBe("application/json");
      expect(result.headers?.["X-Custom"]).toBe("value");
      expect(result.headers?.["Authorization"]).toBe("Bearer token");
    });

    it("initializes headers object if not present", () => {
      const interceptor = new AuthInterceptor();
      mockCookies.get.mockReturnValue("token");

      const config = {} as InternalAxiosRequestConfig;
      const result = interceptor.requestInterceptor(config);

      expect(result.headers).toBeDefined();
      expect(result.headers?.["Authorization"]).toBe("Bearer token");
    });
  });

  describe("responseInterceptor", () => {
    describe("onFulfilled", () => {
      it("returns response unchanged", () => {
        const interceptor = new AuthInterceptor();
        const response = {
          data: { message: "success" },
          status: 200
        } as AxiosResponse;

        const result = interceptor.responseInterceptor.onFulfilled(response);

        expect(result).toBe(response);
      });
    });

    describe("onRejected", () => {
      it("rejects with error for non-401 status", async () => {
        const interceptor = new AuthInterceptor();
        const error = {
          response: { status: 500 },
          config: { headers: {} },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);
      });

      it("attempts token refresh on 401 error", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        // First call is for getRefreshToken
        mockCookies.get.mockReturnValue("refresh-token");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token"
          }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        // When retryRequest throws, it gets caught and clearTokens/handleAuthFailure are called,
        // then the original error is rejected
        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        // Verify that fetch was called for token refresh
        expect(mockFetch).toHaveBeenCalledWith("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: "refresh-token" }),
        });

        // Tokens were set before retryRequest threw, then cleared after the error
        expect(mockCookies.set).toHaveBeenCalledWith("access_token", "new-access-token", expect.any(Object));
        expect(mockCookies.remove).toHaveBeenCalledWith("access_token");
        expect(mockCookies.remove).toHaveBeenCalledWith("refresh_token");
      });

      it("does not retry if request was already retried", async () => {
        const interceptor = new AuthInterceptor();
        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: true },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("rejects with original error when refresh fails (fetch throws)", async () => {
        // When refreshToken catches an internal error, it returns null
        // and the original error is rejected without clearing tokens
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("old-refresh-token");
        mockFetch.mockRejectedValueOnce(new Error("Refresh failed"));

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        // Note: tokens are NOT cleared when refreshToken fails internally
        // The implementation catches the error and returns null
        expect(mockFetch).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it("clears tokens and dispatches auth:failure when retryRequest throws", async () => {
        // This tests the path where refresh succeeds but retryRequest throws
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("refresh-token");
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "new-token" }),
        });

        const dispatchEventSpy = jest.spyOn(window, "dispatchEvent");

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        // Tokens are cleared after retryRequest throws
        expect(mockCookies.remove).toHaveBeenCalledWith("access_token");
        expect(mockCookies.remove).toHaveBeenCalledWith("refresh_token");
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "auth:failure",
            detail: { reason: "token_refresh_failed" },
          })
        );

        dispatchEventSpy.mockRestore();
      });

      it("returns null if no refresh token available", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue(undefined);

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("returns null if no refresh endpoint configured", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: undefined,
        });

        mockCookies.get.mockReturnValue("refresh-token");

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);

        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("handles refresh response without new tokens", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("refresh-token");
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}), // Empty response
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);
      });

      it("handles non-OK refresh response", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("refresh-token");
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        await expect(interceptor.responseInterceptor.onRejected(error))
          .rejects.toBe(error);
      });
    });
  });

  describe("token storage operations", () => {
    describe("cookie storage", () => {
      it("sets access token with secure options when token refresh succeeds", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        // getRefreshToken will be called
        mockCookies.get.mockReturnValue("refresh-token");
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "new-token" }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected to throw due to retryRequest
        }

        expect(mockCookies.set).toHaveBeenCalledWith("access_token", "new-token", {
          secure: true,
          sameSite: "strict",
          expires: 7,
        });
      });

      it("sets refresh token with 30-day expiry when both tokens returned", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("old-refresh-token");
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token"
          }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected to throw due to retryRequest
        }

        // Verify both tokens were set
        expect(mockCookies.set).toHaveBeenCalledWith("access_token", "new-access-token", {
          secure: true,
          sameSite: "strict",
          expires: 7,
        });
        expect(mockCookies.set).toHaveBeenCalledWith("refresh_token", "new-refresh-token", {
          secure: true,
          sameSite: "strict",
          expires: 30,
        });
      });

      it("clears both tokens when retryRequest throws after successful refresh", async () => {
        // This test verifies that tokens are cleared when refresh succeeds
        // but the retry of the original request throws
        const interceptor = new AuthInterceptor({
          tokenSource: "cookie",
          refreshEndpoint: "/api/auth/refresh",
        });

        mockCookies.get.mockReturnValue("refresh-token");
        // Refresh succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "new-token" }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected - retryRequest throws
        }

        // Tokens are first set (from successful refresh), then cleared (from retryRequest failure)
        expect(mockCookies.set).toHaveBeenCalledWith("access_token", "new-token", expect.any(Object));
        expect(mockCookies.remove).toHaveBeenCalledWith("access_token");
        expect(mockCookies.remove).toHaveBeenCalledWith("refresh_token");
      });
    });

    describe("localStorage storage", () => {
      it("stores tokens in localStorage when refresh succeeds (then clears on retryRequest failure)", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "localStorage",
          refreshEndpoint: "/api/auth/refresh",
        });

        // Set the refresh token so getRefreshToken returns it
        localStorage.setItem("refresh_token", "old-refresh");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token"
          }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected to throw due to retryRequest
        }

        // Note: tokens are set and then cleared due to retryRequest failure
        // The implementation: setToken -> setRefreshToken -> retryRequest throws -> clearTokens
        // So final state is cleared tokens
        expect(localStorage.getItem("access_token")).toBeNull();
        expect(localStorage.getItem("refresh_token")).toBeNull();
      });

      it("does not clear tokens when refreshToken fails internally", async () => {
        // When refreshToken catches an internal error, it returns null
        // without clearing tokens
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const interceptor = new AuthInterceptor({
          tokenSource: "localStorage",
          refreshEndpoint: "/api/auth/refresh",
        });

        localStorage.setItem("access_token", "old-access");
        localStorage.setItem("refresh_token", "old-refresh");
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected
        }

        // Tokens are NOT cleared when refreshToken fails internally
        expect(localStorage.getItem("access_token")).toBe("old-access");
        expect(localStorage.getItem("refresh_token")).toBe("old-refresh");
        consoleSpy.mockRestore();
      });
    });

    describe("sessionStorage storage", () => {
      it("stores tokens in sessionStorage when refresh succeeds (then clears on retryRequest failure)", async () => {
        const interceptor = new AuthInterceptor({
          tokenSource: "sessionStorage",
          refreshEndpoint: "/api/auth/refresh",
        });

        // Set the refresh token so getRefreshToken returns it
        sessionStorage.setItem("refresh_token", "old-refresh");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token"
          }),
        });

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected to throw due to retryRequest
        }

        // Note: tokens are set and then cleared due to retryRequest failure
        // The implementation: setToken -> setRefreshToken -> retryRequest throws -> clearTokens
        // So final state is cleared tokens
        expect(sessionStorage.getItem("access_token")).toBeNull();
        expect(sessionStorage.getItem("refresh_token")).toBeNull();
      });

      it("does not clear tokens when refreshToken fails internally", async () => {
        // When refreshToken catches an internal error, it returns null
        // without clearing tokens
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const interceptor = new AuthInterceptor({
          tokenSource: "sessionStorage",
          refreshEndpoint: "/api/auth/refresh",
        });

        sessionStorage.setItem("access_token", "old-access");
        sessionStorage.setItem("refresh_token", "old-refresh");
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const error = {
          response: { status: 401 },
          config: { headers: {}, _retry: false },
        };

        try {
          await interceptor.responseInterceptor.onRejected(error);
        } catch {
          // Expected
        }

        // Tokens are NOT cleared when refreshToken fails internally
        expect(sessionStorage.getItem("access_token")).toBe("old-access");
        expect(sessionStorage.getItem("refresh_token")).toBe("old-refresh");
        consoleSpy.mockRestore();
      });
    });
  });

  describe("custom token keys", () => {
    it("uses custom token key for access token", () => {
      const interceptor = new AuthInterceptor({
        tokenSource: "cookie",
        tokenKey: "custom_access_token",
      });

      mockCookies.get.mockReturnValue("custom-token");

      const config = { headers: {} } as InternalAxiosRequestConfig;
      interceptor.requestInterceptor(config);

      expect(mockCookies.get).toHaveBeenCalledWith("custom_access_token");
    });

    it("uses custom token key for refresh token", async () => {
      const interceptor = new AuthInterceptor({
        tokenSource: "cookie",
        refreshTokenKey: "custom_refresh_token",
        refreshEndpoint: "/api/auth/refresh",
      });

      mockCookies.get
        .mockReturnValueOnce(undefined) // access_token
        .mockReturnValueOnce("custom-refresh"); // custom_refresh_token

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "new-token" }),
      });

      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      try {
        await interceptor.responseInterceptor.onRejected(error);
      } catch {
        // Expected
      }

      expect(mockCookies.get).toHaveBeenCalledWith("custom_refresh_token");
    });
  });

  describe("edge cases", () => {
    it("handles invalid JSON response from refresh endpoint", async () => {
      const interceptor = new AuthInterceptor({
        tokenSource: "cookie",
        refreshEndpoint: "/api/auth/refresh",
      });

      mockCookies.get.mockReturnValue("refresh-token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null), // Invalid response
      });

      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      await expect(interceptor.responseInterceptor.onRejected(error))
        .rejects.toBe(error);
    });

    it("handles non-string access_token in refresh response", async () => {
      const interceptor = new AuthInterceptor({
        tokenSource: "cookie",
        refreshEndpoint: "/api/auth/refresh",
      });

      mockCookies.get.mockReturnValue("refresh-token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 12345 }), // Number instead of string
      });

      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      await expect(interceptor.responseInterceptor.onRejected(error))
        .rejects.toBe(error);
    });

    it("handles missing refreshTokenKey configuration", async () => {
      const interceptor = new AuthInterceptor({
        tokenSource: "cookie",
        refreshTokenKey: undefined,
        refreshEndpoint: "/api/auth/refresh",
      });

      mockCookies.get.mockReturnValue(undefined);

      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      await expect(interceptor.responseInterceptor.onRejected(error))
        .rejects.toBe(error);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles error without response object", async () => {
      const interceptor = new AuthInterceptor();
      const error = {
        config: { headers: {} },
        // No response property
      };

      await expect(interceptor.responseInterceptor.onRejected(error))
        .rejects.toBe(error);
    });
  });
});
