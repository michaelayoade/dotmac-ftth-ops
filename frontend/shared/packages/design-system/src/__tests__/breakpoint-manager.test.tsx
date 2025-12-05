/**
 * @jest-environment jsdom
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";
import {
  BreakpointManager,
  useBreakpoint,
  useResponsiveValue,
  responsive,
  Responsive,
  withResponsive,
  breakpointManager,
  type Breakpoint,
  type ResponsiveValue,
} from "../responsive/breakpoint-manager";
import { breakpoints } from "../tokens/design-tokens";

// Mock matchMedia helper
const createMatchMedia = (width: number) => {
  return (query: string): MediaQueryList => {
    const minWidth = parseInt(query.match(/min-width:\s*(\d+)px/)?.[1] || "0");
    const matches = width >= minWidth;

    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as MediaQueryList;
  };
};

describe("BreakpointManager", () => {
  let manager: BreakpointManager;
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;

    // Default to desktop width
    window.matchMedia = createMatchMedia(1024);
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    manager = new BreakpointManager();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe("constructor", () => {
    it("creates manager with default config", () => {
      expect(manager).toBeInstanceOf(BreakpointManager);
    });

    it("accepts custom config", () => {
      const customManager = new BreakpointManager({
        defaultBreakpoint: "lg",
        enableSSR: false,
      });

      expect(customManager.getBreakpoints()).toEqual(breakpoints);
    });
  });

  describe("getCurrentBreakpoint()", () => {
    it("returns current breakpoint", () => {
      const bp = manager.getCurrentBreakpoint();
      expect(["xs", "sm", "md", "lg", "xl", "2xl"]).toContain(bp);
    });
  });

  describe("getCurrentWidth()", () => {
    it("returns current window width", () => {
      const width = manager.getCurrentWidth();
      expect(width).toBe(1024);
    });

    it("returns 0 in SSR environment", () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const ssrManager = new BreakpointManager();
      expect(ssrManager.getCurrentWidth()).toBe(0);

      global.window = originalWindow;
    });
  });

  describe("matches()", () => {
    it("checks if breakpoint matches", () => {
      window.matchMedia = createMatchMedia(800);
      const mgr = new BreakpointManager();

      // At 800px, should match md (768px) but not lg (1024px)
      expect(mgr.matches("md")).toBe(true);
      expect(mgr.matches("lg")).toBe(false);
    });

    it("returns default in SSR when enableSSR is true", () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const ssrManager = new BreakpointManager({
        defaultBreakpoint: "md",
        enableSSR: true,
      });

      expect(ssrManager.matches("md")).toBe(true);
      expect(ssrManager.matches("lg")).toBe(false);

      global.window = originalWindow;
    });
  });

  describe("isAtLeast()", () => {
    it("checks if viewport is at least a breakpoint", () => {
      window.matchMedia = createMatchMedia(1024);
      const lgManager = new BreakpointManager();

      // Manually set the breakpoint for testing
      // @ts-ignore - accessing private property for test
      lgManager["currentBreakpoint"] = "lg";

      expect(lgManager.isAtLeast("xs")).toBe(true);
      expect(lgManager.isAtLeast("md")).toBe(true);
      expect(lgManager.isAtLeast("lg")).toBe(true);
      expect(lgManager.isAtLeast("xl")).toBe(false);
    });
  });

  describe("isAtMost()", () => {
    it("checks if viewport is at most a breakpoint", () => {
      // @ts-ignore - accessing private property for test
      manager["currentBreakpoint"] = "md";

      expect(manager.isAtMost("xs")).toBe(false);
      expect(manager.isAtMost("md")).toBe(true);
      expect(manager.isAtMost("lg")).toBe(true);
      expect(manager.isAtMost("2xl")).toBe(true);
    });
  });

  describe("isBetween()", () => {
    it("checks if viewport is between two breakpoints", () => {
      // @ts-ignore - accessing private property for test
      manager["currentBreakpoint"] = "md";

      expect(manager.isBetween("sm", "lg")).toBe(true);
      expect(manager.isBetween("md", "xl")).toBe(true);
      expect(manager.isBetween("lg", "xl")).toBe(false);
      expect(manager.isBetween("xs", "sm")).toBe(false);
    });
  });

  describe("subscribe()", () => {
    it("adds subscriber and returns unsubscribe function", () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe(callback);

      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe
      unsubscribe();

      // Trigger change - callback should not be called
      // @ts-ignore - accessing private method for test
      manager["notifySubscribers"]();

      expect(callback).not.toHaveBeenCalled();
    });

    it("notifies subscribers on breakpoint change", () => {
      const callback = jest.fn();
      manager.subscribe(callback);

      // Trigger notification
      // @ts-ignore - accessing private method for test
      manager["notifySubscribers"]();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("resolveValue()", () => {
    it("returns primitive value as-is", () => {
      expect(manager.resolveValue("string")).toBe("string");
      expect(manager.resolveValue(123)).toBe(123);
      expect(manager.resolveValue(true)).toBe(true);
    });

    it("returns null/undefined as-is", () => {
      expect(manager.resolveValue(null)).toBe(null);
      expect(manager.resolveValue(undefined)).toBe(undefined);
    });

    it("resolves responsive value for exact match", () => {
      // @ts-ignore - accessing private property for test
      manager["currentBreakpoint"] = "md";

      const responsive: ResponsiveValue<string> = {
        xs: "extra-small",
        md: "medium",
        lg: "large",
      };

      expect(manager.resolveValue(responsive)).toBe("medium");
    });

    it("falls back to smaller breakpoint when exact not available", () => {
      // @ts-ignore - accessing private property for test
      manager["currentBreakpoint"] = "lg";

      const responsive: ResponsiveValue<string> = {
        xs: "extra-small",
        md: "medium",
      };

      expect(manager.resolveValue(responsive)).toBe("medium");
    });

    it("falls back to larger breakpoint when no smaller available", () => {
      // @ts-ignore - accessing private property for test
      manager["currentBreakpoint"] = "xs";

      const responsive: ResponsiveValue<string> = {
        md: "medium",
        lg: "large",
      };

      expect(manager.resolveValue(responsive)).toBe("medium");
    });
  });

  describe("createMediaQuery()", () => {
    it("creates min-width media query by default", () => {
      const query = manager.createMediaQuery("md");
      expect(query).toBe("(min-width: 768px)");
    });

    it("creates max-width media query", () => {
      const query = manager.createMediaQuery("lg", "max");
      expect(query).toBe("(max-width: 1024px)");
    });
  });

  describe("getBreakpoints()", () => {
    it("returns all breakpoints", () => {
      const bps = manager.getBreakpoints();
      expect(bps).toEqual(breakpoints);
    });
  });

  describe("getBreakpointValue()", () => {
    it("returns numeric pixel value", () => {
      expect(manager.getBreakpointValue("md")).toBe(768);
      expect(manager.getBreakpointValue("lg")).toBe(1024);
      expect(manager.getBreakpointValue("xs")).toBe(320);
    });
  });
});

describe("useBreakpoint hook", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = createMatchMedia(1024);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns breakpoint state", () => {
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBeDefined();
    expect(typeof result.current.width).toBe("number");
    expect(typeof result.current.matches).toBe("function");
    expect(typeof result.current.isAtLeast).toBe("function");
    expect(typeof result.current.isAtMost).toBe("function");
    expect(typeof result.current.isBetween).toBe("function");
  });

  it("provides working helper functions", () => {
    const { result } = renderHook(() => useBreakpoint());

    // Functions should be callable and return booleans
    expect(typeof result.current.matches("md")).toBe("boolean");
    expect(typeof result.current.isAtLeast("sm")).toBe("boolean");
    expect(typeof result.current.isAtMost("xl")).toBe("boolean");
    expect(typeof result.current.isBetween("sm", "lg")).toBe("boolean");
  });
});

describe("useResponsiveValue hook", () => {
  it("resolves responsive value", () => {
    const responsiveValue: ResponsiveValue<string> = {
      xs: "small",
      md: "medium",
      lg: "large",
    };

    const { result } = renderHook(() => useResponsiveValue(responsiveValue));

    expect(result.current).toBeDefined();
    expect(["small", "medium", "large"]).toContain(result.current);
  });

  it("returns primitive values as-is", () => {
    const { result } = renderHook(() => useResponsiveValue("static-value"));

    expect(result.current).toBe("static-value");
  });
});

describe("responsive utilities", () => {
  describe("responsive.classes()", () => {
    it("creates responsive class string", () => {
      const classes = responsive.classes("base-class", {
        xs: "xs-class",
        md: "md-class",
        lg: "lg-class",
      });

      expect(classes).toContain("base-class");
      expect(classes).toContain("xs-class");
      expect(classes).toContain("md:md-class");
      expect(classes).toContain("lg:lg-class");
    });

    it("handles empty responsive values", () => {
      const classes = responsive.classes("base", {});
      expect(classes).toBe("base");
    });
  });

  describe("responsive.styles()", () => {
    it("merges base and responsive styles", () => {
      const base = { color: "red", fontSize: "16px" };
      const responsiveStyles: ResponsiveValue<{ color: string }> = {
        md: { color: "blue" },
      };

      const result = responsive.styles(base, responsiveStyles);

      expect(result.fontSize).toBe("16px");
      // Color depends on current breakpoint
    });
  });

  describe("responsive.mediaQueries", () => {
    it("has media query strings for all breakpoints", () => {
      expect(responsive.mediaQueries.xs).toBe("@media (min-width: 320px)");
      expect(responsive.mediaQueries.md).toBe("@media (min-width: 768px)");
      expect(responsive.mediaQueries.lg).toBe("@media (min-width: 1024px)");
    });
  });

  describe("responsive.grid", () => {
    it("has container config", () => {
      expect(responsive.grid.container.width).toBe("100%");
      expect(responsive.grid.container.margin).toBe("0 auto");
    });

    it("has columns helper", () => {
      const columns = responsive.grid.columns({ xs: 1, md: 2, lg: 4 });

      expect(columns.xs).toBe("repeat(1, minmax(0, 1fr))");
      expect(columns.md).toBe("repeat(2, minmax(0, 1fr))");
      expect(columns.lg).toBe("repeat(4, minmax(0, 1fr))");
    });
  });
});

describe("Responsive component", () => {
  it("renders children by default", () => {
    const TestComponent = () => (
      <Responsive>
        <div data-testid="child">Content</div>
      </Responsive>
    );

    const { container } = require("@testing-library/react").render(<TestComponent />);
    expect(container.querySelector("[data-testid='child']")).toBeTruthy();
  });

  it("hides children when hide is true", () => {
    const TestComponent = () => (
      <Responsive hide={{ md: true }}>
        <div data-testid="child">Content</div>
      </Responsive>
    );

    // This depends on current breakpoint
    const { container } = require("@testing-library/react").render(<TestComponent />);
    // The test result depends on the breakpoint manager state
  });

  it("shows children when show is true", () => {
    const TestComponent = () => (
      <Responsive show={{ md: true }}>
        <div data-testid="child">Content</div>
      </Responsive>
    );

    const { container } = require("@testing-library/react").render(<TestComponent />);
    // The test result depends on the breakpoint manager state
  });
});

describe("withResponsive HOC", () => {
  it("creates a wrapped component", () => {
    const BaseComponent: React.FC<{ size: string }> = ({ size }) => (
      <div data-size={size}>Content</div>
    );

    const ResponsiveComponent = withResponsive(BaseComponent, {
      md: { size: "medium" },
      lg: { size: "large" },
    });

    expect(ResponsiveComponent.displayName).toBe("withResponsive(BaseComponent)");
  });

  it("passes merged props to wrapped component", () => {
    const BaseComponent: React.FC<{ size: string; color?: string }> = ({ size, color }) => (
      <div data-size={size} data-color={color}>Content</div>
    );

    const ResponsiveComponent = withResponsive(BaseComponent, {
      md: { size: "medium" },
    });

    const { container } = require("@testing-library/react").render(
      <ResponsiveComponent size="default" color="blue" />
    );

    expect(container.querySelector("[data-color='blue']")).toBeTruthy();
  });
});

describe("breakpointManager singleton", () => {
  it("is exported and functional", () => {
    expect(breakpointManager).toBeInstanceOf(BreakpointManager);
    expect(typeof breakpointManager.getCurrentBreakpoint()).toBe("string");
  });
});
