/**
 * Loading States Component Tests
 *
 * Tests loading state components: LoadingSpinner, LoadingOverlay, LoadingCard,
 * LoadingTable, LoadingGrid, LoadingState, AsyncState, ButtonLoading, ProgressIndicator
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  LoadingSpinner,
  LoadingOverlay,
  LoadingCard,
  LoadingTable,
  LoadingGrid,
  LoadingState,
  AsyncState,
  ButtonLoading,
  ProgressIndicator,
} from "../loading-states";

describe("LoadingSpinner", () => {
  it("renders loading spinner", () => {
    const { container } = render(<LoadingSpinner />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<LoadingSpinner label="Loading data..." />);

    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("applies size classes", () => {
    const { container, rerender } = render(<LoadingSpinner size="sm" />);

    let spinner = container.querySelector(".h-4");
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner size="lg" />);
    spinner = container.querySelector(".h-8");
    expect(spinner).toBeInTheDocument();
  });

  it("supports custom className", () => {
    const { container } = render(<LoadingSpinner className="custom-spinner" />);

    const wrapper = container.querySelector(".custom-spinner");
    expect(wrapper).toBeInTheDocument();
  });
});

describe("LoadingOverlay", () => {
  it("does not render when show is false", () => {
    const { container } = render(<LoadingOverlay show={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders when show is true", () => {
    render(<LoadingOverlay show={true} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<LoadingOverlay show={true} message="Processing request..." />);

    expect(screen.getByText("Processing request...")).toBeInTheDocument();
  });

  it("applies blur when enabled", () => {
    const { container } = render(<LoadingOverlay show={true} blur={true} />);

    const overlay = container.querySelector(".backdrop-blur-sm");
    expect(overlay).toBeInTheDocument();
  });

  it("does not apply blur when disabled", () => {
    const { container } = render(<LoadingOverlay show={true} blur={false} />);

    const overlay = container.querySelector(".backdrop-blur-sm");
    expect(overlay).not.toBeInTheDocument();
  });

  it("has fixed positioning", () => {
    const { container } = render(<LoadingOverlay show={true} />);

    const overlay = container.querySelector(".fixed");
    expect(overlay).toBeInTheDocument();
  });
});

describe("LoadingCard", () => {
  it("renders loading card", () => {
    const { container } = render(<LoadingCard />);

    const card = container.querySelector(".bg-card");
    expect(card).toBeInTheDocument();
  });

  it("renders specified number of lines", () => {
    const { container } = render(<LoadingCard lines={5} />);

    const lines = container.querySelectorAll(".h-4.bg-muted.rounded");
    expect(lines.length).toBe(5);
  });

  it("shows avatar when enabled", () => {
    const { container } = render(<LoadingCard showAvatar={true} />);

    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toBeInTheDocument();
  });

  it("hides avatar when disabled", () => {
    const { container } = render(<LoadingCard showAvatar={false} />);

    const avatar = container.querySelector(".rounded-full");
    expect(avatar).not.toBeInTheDocument();
  });

  it("applies pulse animation", () => {
    const { container } = render(<LoadingCard />);

    const card = container.querySelector(".animate-pulse");
    expect(card).toBeInTheDocument();
  });

  it("supports custom className", () => {
    const { container } = render(<LoadingCard className="custom-card" />);

    const card = container.querySelector(".custom-card");
    expect(card).toBeInTheDocument();
  });
});

describe("LoadingTable", () => {
  it("renders loading table", () => {
    const { container } = render(<LoadingTable />);

    const table = container.querySelector(".bg-card");
    expect(table).toBeInTheDocument();
  });

  it("renders specified number of rows", () => {
    const { container } = render(<LoadingTable rows={3} />);

    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("renders specified number of columns", () => {
    const { container } = render(<LoadingTable columns={6} />);

    const firstRow = container.querySelector(".grid");
    expect(firstRow).toHaveStyle({ gridTemplateColumns: "repeat(6, 1fr)" });
  });

  it("applies pulse animation", () => {
    const { container } = render(<LoadingTable />);

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe("LoadingGrid", () => {
  it("renders loading grid", () => {
    const { container } = render(<LoadingGrid />);

    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
  });

  it("renders specified number of items", () => {
    const { container } = render(<LoadingGrid items={9} />);

    const cards = container.querySelectorAll(".bg-card");
    expect(cards.length).toBe(9);
  });

  it("applies grid columns", () => {
    const { container } = render(<LoadingGrid columns={4} />);

    const grid = container.querySelector(".grid");
    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(4, 1fr)" });
  });

  it("supports custom className", () => {
    const { container } = render(<LoadingGrid className="custom-grid" />);

    const grid = container.querySelector(".custom-grid");
    expect(grid).toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  const children = <div>Content</div>;

  it("shows loading component when loading", () => {
    render(
      <LoadingState loading={true} error={null} empty={false}>
        {children}
      </LoadingState>,
    );

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows children when not loading", () => {
    render(
      <LoadingState loading={false} error={null} empty={false}>
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("shows error component when error", () => {
    const error = new Error("Test error");

    render(
      <LoadingState loading={false} error={error} empty={false}>
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows empty component when empty", () => {
    render(
      <LoadingState loading={false} error={null} empty={true}>
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("accepts custom loading component", () => {
    render(
      <LoadingState
        loading={true}
        error={null}
        empty={false}
        loadingComponent={<div>Custom loading</div>}
      >
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("Custom loading")).toBeInTheDocument();
  });

  it("accepts custom error component", () => {
    const error = new Error("Test");

    render(
      <LoadingState
        loading={false}
        error={error}
        empty={false}
        errorComponent={<div>Custom error</div>}
      >
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("accepts custom empty component", () => {
    render(
      <LoadingState
        loading={false}
        error={null}
        empty={true}
        emptyComponent={<div>Custom empty</div>}
      >
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("Custom empty")).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    render(
      <LoadingState loading={false} error={null} empty={true} emptyMessage="No items found">
        {children}
      </LoadingState>,
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });
});

describe("AsyncState", () => {
  it("shows loading when loading", () => {
    render(
      <AsyncState data={undefined} loading={true} error={null}>
        {(data) => <div>{data}</div>}
      </AsyncState>,
    );

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error when error", () => {
    const error = new Error("Fetch failed");

    render(
      <AsyncState data={undefined} loading={false} error={error}>
        {(data) => <div>{data}</div>}
      </AsyncState>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows empty when no data", () => {
    render(
      <AsyncState data={undefined} loading={false} error={null}>
        {(data) => <div>{data}</div>}
      </AsyncState>,
    );

    const emptyIcon = document.querySelector("svg");
    expect(emptyIcon).toBeInTheDocument();
  });

  it("renders children with data", () => {
    render(
      <AsyncState data="Test data" loading={false} error={null}>
        {(data) => <div>{data}</div>}
      </AsyncState>,
    );

    expect(screen.getByText("Test data")).toBeInTheDocument();
  });

  it("uses custom isEmpty function", () => {
    const data: string[] = [];

    render(
      <AsyncState data={data} loading={false} error={null} isEmpty={(d) => d.length === 0}>
        {(data) => <div>{data.length} items</div>}
      </AsyncState>,
    );

    const emptyIcon = document.querySelector("svg");
    expect(emptyIcon).toBeInTheDocument();
  });
});

describe("ButtonLoading", () => {
  it("renders button with children", () => {
    render(<ButtonLoading>Click me</ButtonLoading>);

    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("shows spinner when loading", () => {
    const { container } = render(<ButtonLoading loading={true}>Submit</ButtonLoading>);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows loading text when provided", () => {
    render(
      <ButtonLoading loading={true} loadingText="Submitting...">
        Submit
      </ButtonLoading>,
    );

    expect(screen.getByText("Submitting...")).toBeInTheDocument();
  });

  it("is disabled when loading", () => {
    render(<ButtonLoading loading={true}>Submit</ButtonLoading>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<ButtonLoading disabled={true}>Submit</ButtonLoading>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(<ButtonLoading onClick={onClick}>Click</ButtonLoading>);

    await user.click(screen.getByText("Click"));

    expect(onClick).toHaveBeenCalled();
  });

  it("applies variant styles", () => {
    const { rerender } = render(<ButtonLoading variant="primary">Primary</ButtonLoading>);

    let button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary");

    rerender(<ButtonLoading variant="danger">Danger</ButtonLoading>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("bg-destructive");
  });

  it("supports custom className", () => {
    render(<ButtonLoading className="custom-btn">Button</ButtonLoading>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-btn");
  });
});

describe("ProgressIndicator", () => {
  const steps = [
    { label: "Step 1", status: "completed" as const },
    { label: "Step 2", status: "active" as const },
    { label: "Step 3", status: "pending" as const },
  ];

  it("renders all steps", () => {
    render(<ProgressIndicator steps={steps} />);

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  it("shows check icon for completed steps", () => {
    const { container } = render(
      <ProgressIndicator steps={[{ label: "Done", status: "completed" }]} />,
    );

    const checkIcon = container.querySelector("svg");
    expect(checkIcon).toBeInTheDocument();
  });

  it("shows spinner for active steps", () => {
    const { container } = render(
      <ProgressIndicator steps={[{ label: "Active", status: "active" }]} />,
    );

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows number for pending steps", () => {
    render(<ProgressIndicator steps={[{ label: "Pending", status: "pending" }]} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows error icon for error steps", () => {
    const { container } = render(
      <ProgressIndicator steps={[{ label: "Error", status: "error" }]} />,
    );

    const errorIcon = container.querySelector("svg");
    expect(errorIcon).toBeInTheDocument();
  });

  it("applies correct styles to step states", () => {
    render(<ProgressIndicator steps={steps} />);

    const completedStep = screen.getByText("Step 1").previousSibling;
    expect(completedStep).toHaveClass("bg-green-500");

    const activeStep = screen.getByText("Step 2").previousSibling;
    expect(activeStep).toHaveClass("bg-primary");
  });

  it("supports custom className", () => {
    const { container } = render(<ProgressIndicator steps={steps} className="custom-progress" />);

    const progress = container.querySelector(".custom-progress");
    expect(progress).toBeInTheDocument();
  });
});

describe("Real-World Usage Patterns", () => {
  it("renders loading dashboard", () => {
    render(
      <div>
        <LoadingCard lines={2} showAvatar={true} />
        <LoadingTable rows={5} columns={3} />
      </div>,
    );

    const card = document.querySelector(".bg-card");
    expect(card).toBeInTheDocument();
  });

  it("renders async data fetch", () => {
    const data = ["Item 1", "Item 2"];

    render(
      <AsyncState data={data} loading={false} error={null}>
        {(items) => (
          <ul>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </AsyncState>,
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("renders multi-step wizard", () => {
    const wizardSteps = [
      { label: "Account", status: "completed" as const },
      { label: "Profile", status: "active" as const },
      { label: "Preferences", status: "pending" as const },
    ];

    render(<ProgressIndicator steps={wizardSteps} />);

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
  });
});
