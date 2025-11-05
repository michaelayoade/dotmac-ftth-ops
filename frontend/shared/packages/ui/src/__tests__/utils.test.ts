/**
 * Tests for shared UI utilities
 */

import {
  getPortalConfig,
  generatePortalCSSVariables,
  getPortalThemeClass,
  cn,
  type PortalType,
  type PortalColorType,
} from "../lib/utils";

describe("UI utilities", () => {
  describe("getPortalConfig", () => {
    it("should return correct config for admin portal", () => {
      const config = getPortalConfig("admin");
      expect(config).toEqual({
        primary: "#3b82f6",
        secondary: "#1e40af",
        accent: "#60a5fa",
        background: "#f8fafc",
        text: "#1e293b",
      });
    });

    it("should return correct config for customer portal", () => {
      const config = getPortalConfig("customer");
      expect(config).toEqual({
        primary: "#10b981",
        secondary: "#059669",
        accent: "#34d399",
        background: "#f0fdf4",
        text: "#064e3b",
      });
    });

    it("should return correct config for all portal types", () => {
      const portals: PortalType[] = ["admin", "customer", "reseller", "technician", "management"];

      portals.forEach((portal) => {
        const config = getPortalConfig(portal);
        expect(config).toHaveProperty("primary");
        expect(config).toHaveProperty("secondary");
        expect(config).toHaveProperty("accent");
        expect(config).toHaveProperty("background");
        expect(config).toHaveProperty("text");

        // Ensure all values are valid hex colors
        Object.values(config).forEach((color) => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });
    });
  });

  describe("generatePortalCSSVariables", () => {
    it("should generate CSS variables for admin portal", () => {
      const variables = generatePortalCSSVariables("admin");
      expect(variables).toEqual({
        "--portal-primary": "#3b82f6",
        "--portal-secondary": "#1e40af",
        "--portal-accent": "#60a5fa",
        "--portal-background": "#f8fafc",
        "--portal-text": "#1e293b",
      });
    });

    it("should generate valid CSS variable names", () => {
      const variables = generatePortalCSSVariables("customer");
      Object.keys(variables).forEach((key) => {
        expect(key).toMatch(/^--portal-/);
      });
    });
  });

  describe("getPortalThemeClass", () => {
    it("should return correct theme class for each portal", () => {
      expect(getPortalThemeClass("admin")).toBe("portal-theme-admin");
      expect(getPortalThemeClass("customer")).toBe("portal-theme-customer");
      expect(getPortalThemeClass("reseller")).toBe("portal-theme-reseller");
      expect(getPortalThemeClass("technician")).toBe("portal-theme-technician");
      expect(getPortalThemeClass("management")).toBe("portal-theme-management");
    });
  });

  describe("cn utility", () => {
    it("should combine class names correctly", () => {
      expect(cn("class1", "class2", "class3")).toBe("class1 class2 class3");
    });

    it("should filter out falsy values", () => {
      expect(cn("class1", undefined, "class2", null, "class3", false)).toBe("class1 class2 class3");
    });

    it("should handle empty input", () => {
      expect(cn()).toBe("");
    });

    it("should handle only falsy values", () => {
      expect(cn(undefined, null, false)).toBe("");
    });

    it("should handle single class", () => {
      expect(cn("single-class")).toBe("single-class");
    });

    it("should handle mixed truthy and falsy values", () => {
      const condition = false;
      expect(cn("always", condition && "conditional", "also-always")).toBe("always also-always");
    });

    it("should merge Tailwind conflicting classes", () => {
      expect(cn("px-2 py-2", "px-4")).toBe("py-2 px-4");
    });
  });

  describe("Type definitions", () => {
    it("should have correct PortalType union", () => {
      const validPortals: PortalType[] = [
        "admin",
        "customer",
        "reseller",
        "technician",
        "management",
      ];

      validPortals.forEach((portal) => {
        expect(() => getPortalConfig(portal)).not.toThrow();
      });
    });

    it("should have correct PortalColorType structure", () => {
      const config = getPortalConfig("admin");
      const expectedKeys: (keyof PortalColorType)[] = [
        "primary",
        "secondary",
        "accent",
        "background",
        "text",
      ];

      expectedKeys.forEach((key) => {
        expect(config).toHaveProperty(key);
        expect(typeof config[key]).toBe("string");
      });
    });
  });
});
