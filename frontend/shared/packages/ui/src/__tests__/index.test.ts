/**
 * Tests for UI package exports (deprecated functionality)
 */

import * as UIPackage from "../index";

describe("UI Package Exports (Deprecated)", () => {
  describe("Re-exports from @dotmac/primitives", () => {
    it("should export Button and buttonVariants", () => {
      expect(UIPackage).toHaveProperty("Button");
      expect(UIPackage).toHaveProperty("buttonVariants");
    });

    it("should export Input component", () => {
      expect(UIPackage).toHaveProperty("Input");
    });

    it("should export Card component", () => {
      expect(UIPackage).toHaveProperty("Card");
    });

    it("should export Modal component", () => {
      expect(UIPackage).toHaveProperty("Modal");
    });
  });

  describe("Utils exports", () => {
    it("should export utility functions", () => {
      expect(UIPackage).toHaveProperty("getPortalConfig");
      expect(UIPackage).toHaveProperty("generatePortalCSSVariables");
      expect(UIPackage).toHaveProperty("getPortalThemeClass");
      expect(UIPackage).toHaveProperty("cn");
    });

    it("should export portal types", () => {
      // Type exports can't be tested directly, but we can test their usage
      const { getPortalConfig } = UIPackage;
      expect(() => getPortalConfig("admin")).not.toThrow();
      expect(() => getPortalConfig("customer")).not.toThrow();
    });
  });

  describe("Deprecation notice", () => {
    it("should indicate package is deprecated by having minimal exports", () => {
      const exports = Object.keys(UIPackage);

      // Should have the backward compatibility exports
      expect(exports).toContain("Button");
      expect(exports).toContain("Input");
      expect(exports).toContain("Card");
      expect(exports).toContain("Modal");

      // Should have utility exports
      expect(exports).toContain("getPortalConfig");
      expect(exports).toContain("generatePortalCSSVariables");
      expect(exports).toContain("getPortalThemeClass");
      expect(exports).toContain("cn");
    });
  });
});
