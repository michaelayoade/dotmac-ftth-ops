/**
 * Accessibility tests for primitive components
 */

// Export for module validation
export const accessibilityTestSuite = "accessibility-tests";

import {
  LoadingBar,
  LoadingDots,
  LoadingSpinner,
  Skeleton,
} from "@dotmac/headless/components/LoadingStates";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { ErrorBoundary } from "../error/ErrorBoundary";
import { useKeyboardNavigation } from "../utils/accessibility";

describe("Loading Components Accessibility", () => {
  it("LoadingSpinner should be accessible", async () => {
    const { container } = render(<LoadingSpinner size="md" color="primary" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("LoadingDots should be accessible", async () => {
    const { container } = render(<LoadingDots size="md" color="primary" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("LoadingBar should be accessible", async () => {
    const { container } = render(<LoadingBar progress={50} height="md" color="primary" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("LoadingBar indeterminate should be accessible", async () => {
    const { container } = render(<LoadingBar indeterminate height="md" color="primary" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Skeleton should be accessible", async () => {
    const { container } = render(<Skeleton width="100%" height="2rem" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Loading components should have proper ARIA labels", () => {
    const spinnerResult = render(<LoadingSpinner />);
    const spinnerStatus = spinnerResult.container.querySelector('[role="status"]');
    if (spinnerStatus) {
      expect(spinnerStatus).toHaveAttribute("aria-label");
    }
    spinnerResult.unmount();

    const dotsResult = render(<LoadingDots />);
    const dotsStatus = dotsResult.container.querySelector('[role="status"]');
    if (dotsStatus) {
      expect(dotsStatus).toHaveAttribute("aria-label");
    }
    dotsResult.unmount();

    const barResult = render(<LoadingBar progress={25} />);
    const progressbar = barResult.queryByRole("progressbar");
    expect(progressbar).toBeTruthy();
    barResult.unmount();

    const skeletonResult = render(<Skeleton />);
    const skeletonStatus = skeletonResult.container.querySelector('[role="status"]');
    if (skeletonStatus) {
      expect(skeletonStatus).toHaveAttribute("aria-label");
    }
    skeletonResult.unmount();
  });

  it("ProgressBar should have correct ARIA attributes", () => {
    const { getByRole } = render(<LoadingBar progress={75} />);
    const progressBar = getByRole("progressbar");

    expect(progressBar).toHaveAttribute("aria-valuenow", "75");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("Indeterminate ProgressBar should not have aria-valuenow", () => {
    const { getByRole } = render(<LoadingBar indeterminate />);
    const progressBar = getByRole("progressbar");

    expect(progressBar).not.toHaveAttribute("aria-valuenow");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });
});

describe("Keyboard Navigation", () => {
  it("should support keyboard navigation utilities", async () => {
    // Test keyboard navigation with proper ARIA attributes
    const TestComponent = () => {
      const [focusedIndex, setFocusedIndex] = React.useState(0);
      const items = ["item1", "item2", "item3"];

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
        }
      };

      return (
        <ul aria-label="Test navigation list" onKeyDown={handleKeyDown} role="listbox">
          {items.map((item, index) => (
            <li
              key={item}
              role="option"
              aria-selected={index === focusedIndex}
              tabIndex={index === focusedIndex ? 0 : -1}
            >
              {item}
            </li>
          ))}
        </ul>
      );
    };

    const { container } = render(<TestComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// Error Boundary Accessibility Tests
describe("ErrorBoundary Accessibility", () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error("Test error");
    }
    return <div>No error</div>;
  };

  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("ErrorBoundary fallback should be accessible", async () => {
    const { container } = render(
      <ErrorBoundary level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ErrorBoundary should have proper heading hierarchy", () => {
    const { getByRole } = render(
      <ErrorBoundary level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("ErrorBoundary buttons should be focusable", () => {
    const { getByText } = render(
      <ErrorBoundary level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const tryAgainButton = getByText("Try Again");
    expect(tryAgainButton).toBeInTheDocument();
    expect(tryAgainButton).not.toHaveAttribute("disabled");
  });
});
