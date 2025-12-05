/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import {
  ThemeGenerator,
  themeGenerator,
  useTheme,
  type ThemeConfig,
} from "../css/theme-generator";
import { lightTheme, darkTheme, designTokens } from "../tokens/design-tokens";

// Setup mocks
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const createMockMediaQueryList = (matches: boolean): MediaQueryList => ({
  matches,
  media: "(prefers-color-scheme: dark)",
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe("ThemeGenerator", () => {
  let generator: ThemeGenerator;
  let mockMediaQuery: MediaQueryList;
  let dispatchEventSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });

    // Mock matchMedia
    mockMediaQuery = createMockMediaQueryList(false);
    window.matchMedia = jest.fn().mockReturnValue(mockMediaQuery);

    // Mock document methods
    dispatchEventSpy = jest.spyOn(window, "dispatchEvent");

    // Reset document classList
    document.documentElement.classList.remove("light", "dark");

    generator = new ThemeGenerator();
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
  });

  describe("constructor", () => {
    it("creates generator with default config", () => {
      expect(generator).toBeInstanceOf(ThemeGenerator);
    });

    it("accepts custom config", () => {
      const customGenerator = new ThemeGenerator({
        enableDarkMode: false,
        defaultTheme: "dark",
        storageKey: "custom-theme",
      });

      expect(customGenerator).toBeInstanceOf(ThemeGenerator);
    });

    it("loads saved theme from localStorage on init", () => {
      mockLocalStorage.getItem.mockReturnValue("dark");

      const savedThemeGenerator = new ThemeGenerator();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("theme-preference");
    });
  });

  describe("generateThemeCSS()", () => {
    it("generates CSS for light theme", () => {
      const css = generator.generateThemeCSS("light");

      expect(css).toContain(":root");
      expect(css).toContain("transition: background-color");
    });

    it("generates CSS for dark theme", () => {
      const css = generator.generateThemeCSS("dark");

      expect(css).toContain(":root");
      expect(css).toContain(".dark");
    });

    it("includes color variables in CSS", () => {
      const css = generator.generateThemeCSS("light");

      // Should contain CSS custom properties
      expect(css).toContain("--color-");
    });
  });

  describe("generateCompleteCSS()", () => {
    it("generates complete CSS with both themes", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain("/* Design System Theme Variables */");
      expect(css).toContain(":root");
    });

    it("includes utility classes", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain("/* Utility Classes */");
      expect(css).toContain("/* Spacing */");
      expect(css).toContain("/* Typography */");
      expect(css).toContain("/* Border Radius */");
      expect(css).toContain("/* Shadows */");
      expect(css).toContain("/* Colors */");
    });

    it("generates spacing utilities", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain(".m-");
      expect(css).toContain(".p-");
    });

    it("generates typography utilities", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain(".text-");
      expect(css).toContain(".font-");
    });

    it("generates border radius utilities", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain(".rounded-");
    });

    it("generates shadow utilities", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain(".shadow-");
    });

    it("includes dark mode media query when system theme enabled", () => {
      const css = generator.generateCompleteCSS();

      expect(css).toContain("@media (prefers-color-scheme: dark)");
    });

    it("excludes dark mode styles when dark mode disabled", () => {
      const noDarkGenerator = new ThemeGenerator({ enableDarkMode: false });
      const css = noDarkGenerator.generateCompleteCSS();

      expect(css).not.toContain(".dark");
    });
  });

  describe("applyTheme()", () => {
    it("applies light theme class to document", () => {
      generator.applyTheme("light");

      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("applies dark theme class to document", () => {
      generator.applyTheme("dark");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });

    it("dispatches theme-changed event", () => {
      generator.applyTheme("dark");

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "theme-changed",
          detail: expect.objectContaining({ theme: "dark" }),
        })
      );
    });

    it("updates theme-color meta tag", () => {
      generator.applyTheme("light");

      const metaTag = document.querySelector('meta[name="theme-color"]');
      expect(metaTag).toBeTruthy();
      expect(metaTag?.getAttribute("content")).toBe(lightTheme.colors.background);
    });
  });

  describe("setTheme()", () => {
    it("sets theme and saves to localStorage", () => {
      generator.setTheme("dark");

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme-preference", "dark");
      expect(generator.getCurrentTheme()).toBe("dark");
    });

    it("resolves system theme to light when system prefers light", () => {
      mockMediaQuery.matches = false;

      generator.setTheme("system");

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme-preference", "system");
    });

    it("resolves system theme to dark when system prefers dark", () => {
      // Re-create generator with dark system preference
      mockMediaQuery = createMockMediaQueryList(true);
      window.matchMedia = jest.fn().mockReturnValue(mockMediaQuery);

      const darkSystemGenerator = new ThemeGenerator();
      darkSystemGenerator.setTheme("system");

      expect(darkSystemGenerator.getCurrentTheme()).toBe("dark");
    });
  });

  describe("toggleTheme()", () => {
    it("toggles from light to dark", () => {
      generator.applyTheme("light");
      expect(generator.getCurrentTheme()).toBe("light");

      generator.toggleTheme();
      expect(generator.getCurrentTheme()).toBe("dark");
    });

    it("toggles from dark to light", () => {
      generator.applyTheme("dark");
      expect(generator.getCurrentTheme()).toBe("dark");

      generator.toggleTheme();
      expect(generator.getCurrentTheme()).toBe("light");
    });
  });

  describe("getCurrentTheme()", () => {
    it("returns current theme", () => {
      generator.applyTheme("dark");
      expect(generator.getCurrentTheme()).toBe("dark");

      generator.applyTheme("light");
      expect(generator.getCurrentTheme()).toBe("light");
    });
  });

  describe("getSystemTheme()", () => {
    it("returns system theme preference", () => {
      const systemTheme = generator.getSystemTheme();
      expect(["light", "dark"]).toContain(systemTheme);
    });
  });

  describe("getCSSVariables()", () => {
    it("returns CSS variables for current theme", () => {
      generator.applyTheme("light");
      const vars = generator.getCSSVariables();

      expect(vars["--color-background"]).toBe(lightTheme.colors.background);
    });

    it("returns dark theme variables when dark", () => {
      generator.applyTheme("dark");
      const vars = generator.getCSSVariables();

      expect(vars["--color-background"]).toBe(darkTheme.colors.background);
    });
  });

  describe("createStyleObject()", () => {
    it("returns style object for React", () => {
      const style = generator.createStyleObject();

      expect(typeof style).toBe("object");
      expect(style).toHaveProperty("--color-background");
    });
  });

  describe("injectCSS()", () => {
    it("injects style tag into document head", () => {
      generator.injectCSS();

      const styleTag = document.getElementById("design-system-theme-styles");
      expect(styleTag).toBeTruthy();
      expect(styleTag?.tagName).toBe("STYLE");
    });

    it("replaces existing style tag", () => {
      generator.injectCSS();
      generator.injectCSS();

      const styleTags = document.querySelectorAll("#design-system-theme-styles");
      expect(styleTags.length).toBe(1);
    });
  });

  describe("localStorage error handling", () => {
    it("handles localStorage.setItem errors", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage full");
      });

      expect(() => generator.setTheme("dark")).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save theme preference:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("handles localStorage.getItem errors", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage access denied");
      });

      const errorGenerator = new ThemeGenerator();
      expect(errorGenerator).toBeInstanceOf(ThemeGenerator);

      consoleSpy.mockRestore();
    });
  });
});

describe("themeGenerator singleton", () => {
  it("is exported and functional", () => {
    expect(themeGenerator).toBeInstanceOf(ThemeGenerator);
    expect(typeof themeGenerator.getCurrentTheme()).toBe("string");
  });
});

describe("useTheme hook", () => {
  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
  });

  it("returns theme state and functions", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBeDefined();
    expect(typeof result.current.setTheme).toBe("function");
    expect(typeof result.current.toggleTheme).toBe("function");
    expect(result.current.systemTheme).toBeDefined();
    expect(result.current.cssVariables).toBeDefined();
  });

  it("setTheme updates theme", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("dark");
    });

    // Theme should be updated
    expect(themeGenerator.getCurrentTheme()).toBe("dark");
  });

  it("toggleTheme toggles current theme", () => {
    // Start with known state
    themeGenerator.applyTheme("light");

    const { result } = renderHook(() => useTheme());
    const initialTheme = result.current.theme;

    act(() => {
      result.current.toggleTheme();
    });

    expect(themeGenerator.getCurrentTheme()).not.toBe(initialTheme);
  });
});

describe("SSR behavior", () => {
  it("handles SSR environment gracefully", () => {
    // In jsdom environment, window is always present
    // This test verifies the hook can be rendered without throwing
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBeDefined();
    expect(result.current.systemTheme).toBeDefined();
  });
});

describe("Theme Configuration", () => {
  const customConfig: Partial<ThemeConfig> = {
    enableDarkMode: true,
    enableSystemTheme: true,
    defaultTheme: "light",
    storageKey: "custom-theme-key",
    rootSelector: ":root",
    darkModeClass: "theme-dark",
    lightModeClass: "theme-light",
    transitionDuration: "200ms",
  };

  beforeEach(() => {
    // Reset mocks and document state
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    document.documentElement.classList.remove("light", "dark", "theme-light", "theme-dark");
  });

  it("uses custom storage key", () => {
    const customGenerator = new ThemeGenerator(customConfig);
    customGenerator.setTheme("dark");

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("custom-theme-key", "dark");
  });

  it("uses custom theme classes", () => {
    const customGenerator = new ThemeGenerator(customConfig);
    customGenerator.applyTheme("dark");

    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
  });

  it("uses custom transition duration", () => {
    const customGenerator = new ThemeGenerator(customConfig);
    const css = customGenerator.generateThemeCSS("light");

    expect(css).toContain("200ms");
  });
});
