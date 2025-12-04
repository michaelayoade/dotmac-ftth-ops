/**
 * Tests for theme utilities
 * Tests theme configuration and application
 */

import { defaultTheme, darkTheme, type Theme } from "../theme";

describe("theme", () => {
  describe("Theme Constants", () => {
    it("should have default theme", () => {
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.name).toBe("default");
      expect(defaultTheme.colors).toBeDefined();
      expect(defaultTheme.radius).toBe("0.5rem");
      expect(defaultTheme.font).toBe("system-ui, sans-serif");
    });

    it("should have dark theme", () => {
      expect(darkTheme).toBeDefined();
      expect(darkTheme.name).toBe("dark");
      expect(darkTheme.colors).toBeDefined();
      expect(darkTheme.radius).toBe("0.5rem");
    });

    it("should have all required color properties", () => {
      const requiredColors = [
        "primary",
        "secondary",
        "accent",
        "background",
        "foreground",
        "muted",
        "border",
      ];

      requiredColors.forEach((color) => {
        expect(defaultTheme.colors).toHaveProperty(color);
        expect(darkTheme.colors).toHaveProperty(color);
      });
    });

    it("should have valid HSL color values", () => {
      Object.values(defaultTheme.colors).forEach((color) => {
        expect(typeof color).toBe("string");
        expect(color).toContain("hsl");
      });

      Object.values(darkTheme.colors).forEach((color) => {
        expect(typeof color).toBe("string");
        expect(color).toContain("hsl");
      });
    });
  });

  describe("Type Safety", () => {
    it("should enforce Theme interface structure", () => {
      const customTheme: Theme = {
        name: "custom",
        colors: {
          primary: "hsl(0 0% 0%)",
          secondary: "hsl(0 0% 10%)",
          accent: "hsl(0 0% 20%)",
          background: "hsl(0 0% 100%)",
          foreground: "hsl(0 0% 0%)",
          muted: "hsl(0 0% 50%)",
          border: "hsl(0 0% 80%)",
        },
        radius: "1rem",
        font: "Inter, sans-serif",
      };

      expect(customTheme.name).toBe("custom");
      expect(customTheme.colors.primary).toBe("hsl(0 0% 0%)");
    });
  });

  describe("Theme properties", () => {
    it("should have consistent radius across themes", () => {
      expect(defaultTheme.radius).toBe(darkTheme.radius);
    });

    it("should have different color schemes", () => {
      expect(defaultTheme.colors.primary).not.toBe(darkTheme.colors.primary);
      expect(defaultTheme.colors.background).not.toBe(darkTheme.colors.background);
    });

    it("should have same structure in both themes", () => {
      const defaultKeys = Object.keys(defaultTheme.colors).sort();
      const darkKeys = Object.keys(darkTheme.colors).sort();

      expect(defaultKeys).toEqual(darkKeys);
    });
  });

  describe("Color values", () => {
    it("should use HSL color format", () => {
      const hslPattern = /hsl\([^)]+\)/;

      Object.values(defaultTheme.colors).forEach((color) => {
        expect(color).toMatch(hslPattern);
      });
    });

    it("should have non-empty color values", () => {
      Object.values(defaultTheme.colors).forEach((color) => {
        expect(color.length).toBeGreaterThan(0);
      });

      Object.values(darkTheme.colors).forEach((color) => {
        expect(color.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Theme metadata", () => {
    it("should have valid name property", () => {
      expect(defaultTheme.name).toBe("default");
      expect(darkTheme.name).toBe("dark");
    });

    it("should have valid font property", () => {
      expect(defaultTheme.font).toContain("sans-serif");
      expect(darkTheme.font).toContain("sans-serif");
    });

    it("should have valid radius values", () => {
      expect(defaultTheme.radius).toMatch(/^\d+(\.\d+)?(rem|px|em)$/);
      expect(darkTheme.radius).toMatch(/^\d+(\.\d+)?(rem|px|em)$/);
    });
  });

  describe("Edge cases", () => {
    it("should handle theme comparison", () => {
      expect(defaultTheme).not.toEqual(darkTheme);
      expect(defaultTheme.name).not.toEqual(darkTheme.name);
    });

    it("should allow theme cloning", () => {
      const clonedTheme = { ...defaultTheme };

      expect(clonedTheme).toEqual(defaultTheme);
      expect(clonedTheme).not.toBe(defaultTheme);
    });

    it("should allow color object cloning", () => {
      const clonedColors = { ...defaultTheme.colors };

      expect(clonedColors).toEqual(defaultTheme.colors);
      expect(clonedColors).not.toBe(defaultTheme.colors);
    });
  });
});
