/**
 * @jest-environment jsdom
 */

import Cookies from "js-cookie";

import { TenantResolver } from "../tenant-resolver";

// Mock js-cookie
jest.mock("js-cookie", () => ({
  get: jest.fn(),
}));

describe("TenantResolver", () => {
  const mockCookies = Cookies as jest.Mocked<typeof Cookies>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.location
    Object.defineProperty(window, "location", {
      value: {
        hostname: "localhost",
        search: "",
      },
      writable: true,
    });
  });

  describe("constructor", () => {
    it("creates resolver with header source", () => {
      const resolver = new TenantResolver({
        tenantId: "test-tenant",
        source: "header",
      });

      expect(resolver.getTenantId()).toBe("test-tenant");
    });

    it("creates resolver with subdomain source", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "acme.example.com", search: "" },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "subdomain",
      });

      expect(resolver.getTenantId()).toBe("acme");
    });

    it("creates resolver with query source", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "localhost", search: "?tenant=query-tenant" },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "query",
      });

      expect(resolver.getTenantId()).toBe("query-tenant");
    });

    it("creates resolver with cookie source", () => {
      mockCookies.get.mockReturnValue("cookie-tenant");

      const resolver = new TenantResolver({
        tenantId: "",
        source: "cookie",
      });

      expect(resolver.getTenantId()).toBe("cookie-tenant");
    });
  });

  describe("getTenantId()", () => {
    describe("header source", () => {
      it("returns configured tenant ID", () => {
        const resolver = new TenantResolver({
          tenantId: "header-tenant-123",
          source: "header",
        });

        expect(resolver.getTenantId()).toBe("header-tenant-123");
      });

      it("returns empty string if tenant ID is empty", () => {
        const resolver = new TenantResolver({
          tenantId: "",
          source: "header",
        });

        expect(resolver.getTenantId()).toBe("");
      });
    });

    describe("subdomain source", () => {
      it("extracts tenant from three-part hostname", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "tenant.example.com", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBe("tenant");
      });

      it("extracts tenant from four-part hostname", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "tenant.api.example.com", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBe("tenant");
      });

      it("returns null for two-part hostname (no subdomain)", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "example.com", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBeNull();
      });

      it("returns null for localhost (no subdomain)", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBeNull();
      });

      it("handles subdomain with hyphens", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "my-tenant.example.com", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBe("my-tenant");
      });

      it("handles subdomain with numbers", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "tenant123.example.com", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "subdomain",
        });

        expect(resolver.getTenantId()).toBe("tenant123");
      });
    });

    describe("query source", () => {
      it("extracts tenant from 'tenant' query param", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "?tenant=query-tenant" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBe("query-tenant");
      });

      it("extracts tenant from 'tenantId' query param", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "?tenantId=tenant-id-value" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBe("tenant-id-value");
      });

      it("prefers 'tenant' over 'tenantId' when both present", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "?tenant=first&tenantId=second" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBe("first");
      });

      it("returns null when no tenant query param exists", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "?other=value" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBeNull();
      });

      it("returns null for empty search string", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBeNull();
      });

      it("handles URL-encoded tenant values", () => {
        Object.defineProperty(window, "location", {
          value: { hostname: "localhost", search: "?tenant=my%20tenant" },
          writable: true,
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "query",
        });

        expect(resolver.getTenantId()).toBe("my tenant");
      });
    });

    describe("cookie source", () => {
      it("extracts tenant from 'tenant-id' cookie", () => {
        mockCookies.get.mockImplementation((name: string) => {
          if (name === "tenant-id") return "cookie-tenant-1";
          return undefined;
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "cookie",
        });

        expect(resolver.getTenantId()).toBe("cookie-tenant-1");
        expect(mockCookies.get).toHaveBeenCalledWith("tenant-id");
      });

      it("extracts tenant from 'tenantId' cookie if tenant-id not found", () => {
        mockCookies.get.mockImplementation((name: string) => {
          if (name === "tenant-id") return undefined;
          if (name === "tenantId") return "cookie-tenant-2";
          return undefined;
        });

        const resolver = new TenantResolver({
          tenantId: "",
          source: "cookie",
        });

        expect(resolver.getTenantId()).toBe("cookie-tenant-2");
      });

      it("returns null when no tenant cookie exists", () => {
        mockCookies.get.mockReturnValue(undefined);

        const resolver = new TenantResolver({
          tenantId: "",
          source: "cookie",
        });

        expect(resolver.getTenantId()).toBeNull();
      });
    });

    describe("default fallback", () => {
      it("returns tenantId for unknown source", () => {
        const resolver = new TenantResolver({
          tenantId: "fallback-tenant",
          source: "unknown" as any,
        });

        expect(resolver.getTenantId()).toBe("fallback-tenant");
      });

      it("returns null for unknown source with empty tenantId", () => {
        const resolver = new TenantResolver({
          tenantId: "",
          source: "unknown" as any,
        });

        expect(resolver.getTenantId()).toBeNull();
      });
    });
  });

  describe("static fromHostname()", () => {
    it("creates resolver from hostname subdomain", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "tenant-from-host.example.com", search: "" },
        writable: true,
      });

      const resolver = TenantResolver.fromHostname();

      // fromHostname takes the first part of hostname
      expect(resolver.getTenantId()).toBe("tenant-from-host");
    });

    it("creates resolver from localhost", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "localhost", search: "" },
        writable: true,
      });

      const resolver = TenantResolver.fromHostname();

      // fromHostname uses subdomain source, which returns null for single-part hostnames
      // because extractTenantFromSubdomain requires > 2 parts
      expect(resolver.getTenantId()).toBeNull();
    });

    it("creates resolver from IP address", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "192.168.1.100", search: "" },
        writable: true,
      });

      const resolver = TenantResolver.fromHostname();

      expect(resolver.getTenantId()).toBe("192");
    });
  });

  describe("static fromConfig()", () => {
    it("creates resolver with specified tenant ID", () => {
      const resolver = TenantResolver.fromConfig("config-tenant");

      expect(resolver.getTenantId()).toBe("config-tenant");
    });

    it("creates resolver with empty tenant ID", () => {
      const resolver = TenantResolver.fromConfig("");

      expect(resolver.getTenantId()).toBe("");
    });

    it("uses header source", () => {
      // Verify that fromConfig uses header source (doesn't extract from URL)
      Object.defineProperty(window, "location", {
        value: { hostname: "different.example.com", search: "?tenant=other" },
        writable: true,
      });

      const resolver = TenantResolver.fromConfig("specified-tenant");

      // Should return configured value, not from URL
      expect(resolver.getTenantId()).toBe("specified-tenant");
    });
  });

  describe("edge cases", () => {
    it("handles empty hostname parts", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: ".example.com", search: "" },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "subdomain",
      });

      // First part is empty string, which is falsy
      expect(resolver.getTenantId()).toBeNull();
    });

    it("handles complex query strings", () => {
      Object.defineProperty(window, "location", {
        value: {
          hostname: "localhost",
          search: "?foo=bar&tenant=complex-tenant&baz=qux",
        },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "query",
      });

      expect(resolver.getTenantId()).toBe("complex-tenant");
    });

    it("handles tenant ID with special characters in query", () => {
      Object.defineProperty(window, "location", {
        value: {
          hostname: "localhost",
          search: "?tenant=tenant%2Fwith%2Fslashes",
        },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "query",
      });

      expect(resolver.getTenantId()).toBe("tenant/with/slashes");
    });
  });

  describe("server-side rendering (SSR) safety", () => {
    // These tests verify behavior when window is undefined
    // Note: In jsdom environment, window is defined, so we test the positive case

    it("subdomain extraction works in browser", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "ssr-tenant.example.com", search: "" },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "subdomain",
      });

      expect(resolver.getTenantId()).toBe("ssr-tenant");
    });

    it("query extraction works in browser", () => {
      Object.defineProperty(window, "location", {
        value: { hostname: "localhost", search: "?tenant=ssr-query" },
        writable: true,
      });

      const resolver = new TenantResolver({
        tenantId: "",
        source: "query",
      });

      expect(resolver.getTenantId()).toBe("ssr-query");
    });
  });
});
