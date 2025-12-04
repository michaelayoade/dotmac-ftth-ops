/**
 * @fileoverview Tests for customer portal middleware
 */

jest.mock("next/server", () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: "next" })),
    redirect: jest.fn((url: URL) => ({ type: "redirect", url: url.toString() })),
  },
  NextRequest: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";

describe("middleware", () => {
  const mockNextResponse = NextResponse as jest.Mocked<typeof NextResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (
    pathname: string,
    options: { hasCookie?: boolean } = {}
  ): NextRequest => {
    const url = new URL(`http://localhost:3006${pathname}`);

    return {
      nextUrl: url,
      url: url.toString(),
      cookies: {
        get: jest.fn((name: string) => {
          if (name === "customer_access_token" && options.hasCookie) {
            return { name, value: "mock-token" };
          }
          return undefined;
        }),
      },
    } as unknown as NextRequest;
  };

  describe("static paths", () => {
    it("allows _next paths", () => {
      const request = createMockRequest("/_next/static/chunk.js");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows API paths", () => {
      const request = createMockRequest("/api/health");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows favicon", () => {
      const request = createMockRequest("/favicon.ico");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows logo.svg", () => {
      const request = createMockRequest("/logo.svg");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows images paths", () => {
      const request = createMockRequest("/images/banner.png");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows fonts paths", () => {
      const request = createMockRequest("/fonts/inter.woff2");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });

  describe("public paths", () => {
    it("allows login page", () => {
      const request = createMockRequest("/login");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows forgot-password page", () => {
      const request = createMockRequest("/forgot-password");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows reset-password page", () => {
      const request = createMockRequest("/reset-password");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows register page", () => {
      const request = createMockRequest("/register");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows terms page", () => {
      const request = createMockRequest("/terms");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows privacy page", () => {
      const request = createMockRequest("/privacy");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows subpaths of public routes", () => {
      const request = createMockRequest("/reset-password/token-123");
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });

  describe("protected portal paths", () => {
    it("redirects to login when no token and accessing portal", () => {
      const request = createMockRequest("/portal", { hasCookie: false });
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalled();
      const redirectCall = mockNextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectCall.pathname).toBe("/login");
      expect(redirectCall.searchParams.get("redirect")).toBe("/portal");
    });

    it("redirects to login with correct redirect path for nested portal routes", () => {
      const request = createMockRequest("/portal/billing", { hasCookie: false });
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalled();
      const redirectCall = mockNextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectCall.pathname).toBe("/login");
      expect(redirectCall.searchParams.get("redirect")).toBe("/portal/billing");
    });

    it("allows portal access when token exists", () => {
      const request = createMockRequest("/portal", { hasCookie: true });
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });

    it("allows nested portal routes when token exists", () => {
      const request = createMockRequest("/portal/service", { hasCookie: true });
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });

  describe("root path", () => {
    it("redirects to portal when authenticated", () => {
      const request = createMockRequest("/", { hasCookie: true });
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalled();
      const redirectCall = mockNextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectCall.pathname).toBe("/portal");
    });

    it("redirects to login when not authenticated", () => {
      const request = createMockRequest("/", { hasCookie: false });
      middleware(request);

      expect(mockNextResponse.redirect).toHaveBeenCalled();
      const redirectCall = mockNextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectCall.pathname).toBe("/login");
    });
  });

  describe("other paths", () => {
    it("allows unknown paths through", () => {
      const request = createMockRequest("/unknown-page", { hasCookie: false });
      middleware(request);
      expect(mockNextResponse.next).toHaveBeenCalled();
    });
  });
});
