import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type React from "react";

type RenderResult = ReturnType<typeof rtlRender> & { user: ReturnType<typeof userEvent.setup> };

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

const renderSecurity = async (ui: React.ReactElement, options?: RenderOptions) => {
  return render(ui, options);
};

const renderPerformance = (ui: React.ReactElement, options?: RenderOptions) => {
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

const renderComprehensive = async (ui: React.ReactElement, options?: RenderOptions) => {
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

export {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
  userEvent,
};
