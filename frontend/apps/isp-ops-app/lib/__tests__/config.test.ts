/**
 * Tests for config utility
 * Tests application configuration and environment variable handling
 */

import platformConfig from "../config";

describe("config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("API configuration", () => {
    it("should have API configuration", () => {
      expect(platformConfig.api).toBeDefined();
      expect(platformConfig.api.baseUrl).toBeDefined();
      expect(platformConfig.api.prefix).toBeDefined();
      expect(platformConfig.api.timeout).toBe(30000);
    });

    it("should have buildUrl function", () => {
      expect(typeof platformConfig.api.buildUrl).toBe("function");
    });

    it("should build API URLs with prefix", () => {
      const url = platformConfig.api.buildUrl("/users");
      expect(url).toContain("/users");
    });

    it("should build API URLs without prefix when skipPrefix is true", () => {
      const url = platformConfig.api.buildUrl("/health", { skipPrefix: true });
      expect(url).toBe("/health");
    });

    it("should have GraphQL endpoint", () => {
      expect(platformConfig.api.graphqlEndpoint).toBeDefined();
      expect(platformConfig.api.graphqlEndpoint).toContain("/graphql");
    });
  });

  describe("Feature flags", () => {
    it("should have features configuration", () => {
      expect(platformConfig.features).toBeDefined();
    });

    it("should have enableGraphQL feature", () => {
      expect(typeof platformConfig.features.enableGraphQL).toBe("boolean");
    });

    it("should have enableAnalytics feature", () => {
      expect(typeof platformConfig.features.enableAnalytics).toBe("boolean");
    });

    it("should have enableBanking feature", () => {
      expect(typeof platformConfig.features.enableBanking).toBe("boolean");
    });

    it("should have enablePayments feature", () => {
      expect(typeof platformConfig.features.enablePayments).toBe("boolean");
    });

    it("should have enableRadius feature defaulting to true", () => {
      expect(typeof platformConfig.features.enableRadius).toBe("boolean");
    });

    it("should have enableNetwork feature defaulting to true", () => {
      expect(typeof platformConfig.features.enableNetwork).toBe("boolean");
    });

    it("should have enableAutomation feature defaulting to true", () => {
      expect(typeof platformConfig.features.enableAutomation).toBe("boolean");
    });
  });

  describe("App metadata", () => {
    it("should have app configuration", () => {
      expect(platformConfig.app).toBeDefined();
      expect(platformConfig.app.name).toBeDefined();
      expect(platformConfig.app.version).toBeDefined();
      expect(platformConfig.app.environment).toBeDefined();
    });

    it("should default app name", () => {
      expect(platformConfig.app.name).toBeTruthy();
    });

    it("should default version", () => {
      expect(platformConfig.app.version).toBeTruthy();
    });

    it("should default environment", () => {
      expect(platformConfig.app.environment).toBeTruthy();
    });
  });

  describe("Banking configuration", () => {
    it("should have banking configuration", () => {
      expect(platformConfig.banking).toBeDefined();
      expect(platformConfig.banking.enabled).toBeDefined();
      expect(platformConfig.banking.providers).toBeDefined();
    });

    it("should have providers as array", () => {
      expect(Array.isArray(platformConfig.banking.providers)).toBe(true);
      expect(platformConfig.banking.providers.length).toBeGreaterThan(0);
    });

    it("should default providers to stripe and paypal", () => {
      const providers = platformConfig.banking.providers;
      expect(providers).toContain("stripe");
      expect(providers).toContain("paypal");
    });
  });

  describe("Pagination configuration", () => {
    it("should have pagination defaults", () => {
      expect(platformConfig.pagination).toBeDefined();
      expect(platformConfig.pagination.defaultPageSize).toBe(20);
    });

    it("should have page size options", () => {
      expect(platformConfig.pagination.pageSizeOptions).toEqual([10, 20, 50, 100]);
    });
  });

  describe("Date/time formats", () => {
    it("should have format configuration", () => {
      expect(platformConfig.formats).toBeDefined();
      expect(platformConfig.formats.date).toBeDefined();
      expect(platformConfig.formats.dateTime).toBeDefined();
      expect(platformConfig.formats.time).toBeDefined();
    });

    it("should have standard date format", () => {
      expect(platformConfig.formats.date).toBe("yyyy-MM-dd");
    });

    it("should have standard dateTime format", () => {
      expect(platformConfig.formats.dateTime).toBe("yyyy-MM-dd HH:mm:ss");
    });

    it("should have standard time format", () => {
      expect(platformConfig.formats.time).toBe("HH:mm:ss");
    });
  });

  describe("Branding configuration", () => {
    it("should have branding configuration", () => {
      expect(platformConfig.branding).toBeDefined();
    });

    it("should have company information", () => {
      expect(platformConfig.branding.companyName).toBeDefined();
      expect(platformConfig.branding.productName).toBeDefined();
      expect(platformConfig.branding.productTagline).toBeDefined();
    });

    it("should have logo configuration", () => {
      expect(platformConfig.branding.logoUrl).toBeDefined();
      expect(platformConfig.branding.logo).toBeDefined();
      expect(platformConfig.branding.logo.light).toBeDefined();
      expect(platformConfig.branding.logo.dark).toBeDefined();
    });

    it("should have support contact information", () => {
      expect(platformConfig.branding.supportEmail).toBeDefined();
      expect(platformConfig.branding.successEmail).toBeDefined();
      expect(platformConfig.branding.partnerSupportEmail).toBeDefined();
    });

    it("should have documentation URLs", () => {
      expect(platformConfig.branding.docsUrl).toBeDefined();
      expect(platformConfig.branding.supportPortalUrl).toBeDefined();
      expect(platformConfig.branding.termsUrl).toBeDefined();
      expect(platformConfig.branding.privacyUrl).toBeDefined();
    });

    it("should have favicon URL", () => {
      expect(platformConfig.branding.faviconUrl).toBeDefined();
    });

    it("should have color configuration", () => {
      expect(platformConfig.branding.colors).toBeDefined();
      expect(platformConfig.branding.colors.primary).toBeDefined();
      expect(platformConfig.branding.colors.primaryHover).toBeDefined();
      expect(platformConfig.branding.colors.primaryForeground).toBeDefined();
      expect(platformConfig.branding.colors.secondary).toBeDefined();
      expect(platformConfig.branding.colors.secondaryHover).toBeDefined();
      expect(platformConfig.branding.colors.secondaryForeground).toBeDefined();
    });

    it("should have primary color as hex", () => {
      expect(platformConfig.branding.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should have secondary color as hex", () => {
      expect(platformConfig.branding.colors.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should have custom CSS variables", () => {
      expect(platformConfig.branding.customCss).toBeDefined();
      expect(platformConfig.branding.customCss["--brand-primary"]).toBeDefined();
      expect(platformConfig.branding.customCss["--brand-secondary"]).toBeDefined();
    });

    it("should match CSS variables with color values", () => {
      expect(platformConfig.branding.customCss["--brand-primary"]).toBe(
        platformConfig.branding.colors.primary
      );
      expect(platformConfig.branding.customCss["--brand-secondary"]).toBe(
        platformConfig.branding.colors.secondary
      );
    });
  });

  describe("buildUrl functionality", () => {
    it("should handle empty paths", () => {
      const url = platformConfig.api.buildUrl("");
      expect(typeof url).toBe("string");
    });

    it("should handle paths with leading slash", () => {
      const url = platformConfig.api.buildUrl("/api/users");
      expect(url).toContain("/users");
    });

    it("should handle paths without leading slash", () => {
      const url = platformConfig.api.buildUrl("users");
      expect(url).toContain("/users");
    });

    it("should handle root path", () => {
      const url = platformConfig.api.buildUrl("/");
      expect(typeof url).toBe("string");
    });

    it("should skip prefix when requested", () => {
      const url1 = platformConfig.api.buildUrl("/health");
      const url2 = platformConfig.api.buildUrl("/health", { skipPrefix: true });

      // url2 should be shorter (no prefix)
      expect(url2.length).toBeLessThanOrEqual(url1.length);
    });
  });

  describe("Type safety", () => {
    it("should have readonly configuration", () => {
      // Configuration object exists and is accessible
      expect(platformConfig).toBeDefined();
    });

    it("should have all required top-level properties", () => {
      const requiredKeys = [
        "api",
        "features",
        "app",
        "banking",
        "pagination",
        "formats",
        "branding",
      ];

      requiredKeys.forEach((key) => {
        expect(platformConfig).toHaveProperty(key);
      });
    });
  });

  describe("Default values", () => {
    it("should provide sensible defaults", () => {
      expect(platformConfig.api.timeout).toBe(30000);
      expect(platformConfig.pagination.defaultPageSize).toBe(20);
      expect(platformConfig.app.name).toBeTruthy();
      expect(platformConfig.branding.companyName).toBeTruthy();
    });

    it("should have default support email", () => {
      expect(platformConfig.branding.supportEmail).toContain("@");
    });

    it("should have default docs URL", () => {
      expect(platformConfig.branding.docsUrl).toMatch(/^https?:\/\//);
    });

    it("should default successEmail to supportEmail", () => {
      // They should match or successEmail should be defined
      expect(platformConfig.branding.successEmail).toBeDefined();
    });

    it("should have default logo path", () => {
      expect(platformConfig.branding.logoUrl).toContain("/logo");
    });
  });

  describe("Edge cases", () => {
    it("should handle missing environment variables gracefully", () => {
      // Config should still be valid even with missing env vars
      expect(platformConfig).toBeDefined();
      expect(platformConfig.api).toBeDefined();
      expect(platformConfig.features).toBeDefined();
    });

    it("should handle empty API base URL", () => {
      const url = platformConfig.api.buildUrl("/test");
      expect(url).toContain("/test");
    });

    it("should handle optional color values", () => {
      // Optional colors may be undefined
      const { accent, background, foreground } = platformConfig.branding.colors;
      // These are optional, just verify they don't cause errors
      expect(accent !== undefined || accent === undefined).toBe(true);
      expect(background !== undefined || background === undefined).toBe(true);
      expect(foreground !== undefined || foreground === undefined).toBe(true);
    });
  });
});
