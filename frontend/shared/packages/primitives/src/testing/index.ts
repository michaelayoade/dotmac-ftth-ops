import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { fireEvent, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type React from "react";
import { detectSecurityViolations, ensureTestingMatchers } from "./matchers";

ensureTestingMatchers();

type RenderResult = ReturnType<typeof rtlRender> & { user: ReturnType<typeof userEvent.setup> };
type PerformanceMetrics = { duration: number; domNodes: number; threshold: number };
type PerformanceRenderResult = RenderResult & {
  measurePerformance: (threshold?: number) => PerformanceMetrics;
};

type RenderWithTimersResult = RenderResult & {
  advanceTimers: (ms: number) => void;
  runAllTimers: () => void;
  cleanup: () => void;
};

const render = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  const user = userEvent.setup();
  const result = rtlRender(ui, options);
  return { user, ...result };
};

const renderA11y = async (ui: React.ReactElement, options?: RenderOptions) => {
  const result = render(ui, options);
  const accessibility = await axe(result.container);
  expect(accessibility).toHaveNoViolations();
  return result;
};

const renderSecurity = (ui: React.ReactElement, options?: RenderOptions) => {
  const result = render(ui, options);
  const issues = detectSecurityViolations(result.container);
  if (issues.length > 0) {
    throw new Error(`Security violations detected:\n- ${issues.join("\n- ")}`);
  }
  return result;
};

const renderPerformance = (
  ui: React.ReactElement,
  options?: RenderOptions,
): PerformanceRenderResult => {
  const start = performance.now();
  const result = render(ui, options);
  const duration = performance.now() - start;

  return {
    ...result,
    measurePerformance: (threshold = 16) => {
      const domNodes = result.container.querySelectorAll("*").length;
      return { duration, domNodes, threshold };
    },
  };
};

const renderComprehensive = async (
  ui: React.ReactElement,
  options?: RenderOptions,
): Promise<{ result: PerformanceRenderResult; metrics: PerformanceMetrics }> => {
  const perfResult = renderPerformance(ui, options);
  const accessibility = await axe(perfResult.container, {
    rules: {
      "nested-interactive": { enabled: false },
    },
  });
  expect(accessibility).toHaveNoViolations();

  return {
    result: perfResult,
    metrics: perfResult.measurePerformance(),
  };
};

// ✅ NEW: Lightweight render for fast iteration and wrapper tests
const renderQuick = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  // Skip axe, skip performance - just render for fast TDD cycles
  return render(ui, options);
};

// ✅ NEW: Render with fake timers for components with auto-refresh, animations, throttling
interface RenderWithTimersOptions extends RenderOptions {
  useRealTimers?: boolean;
}

const renderWithTimers = (
  ui: React.ReactElement,
  options?: RenderWithTimersOptions,
): RenderWithTimersResult => {
  const { useRealTimers = false, ...renderOptions } = options || {};

  if (!useRealTimers) {
    jest.useFakeTimers();
  }

  const result = render(ui, renderOptions);

  return {
    ...result,
    advanceTimers: (ms: number) => jest.advanceTimersByTime(ms),
    runAllTimers: () => jest.runAllTimers(),
    cleanup: () => {
      if (!useRealTimers) {
        jest.useRealTimers();
      }
    },
  };
};

export {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  renderQuick,
  renderWithTimers,
  screen,
  fireEvent,
  waitFor,
  userEvent,
  act,
};
