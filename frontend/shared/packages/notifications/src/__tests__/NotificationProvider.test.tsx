/**
 * @fileoverview Tests for NotificationProvider component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NotificationProvider } from "../index";

describe("NotificationProvider", () => {
  it("should render children", () => {
    render(
      <NotificationProvider>
        <div data-testid="child">Child content</div>
      </NotificationProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <NotificationProvider>
        <div data-testid="child-1">First child</div>
        <div data-testid="child-2">Second child</div>
        <div data-testid="child-3">Third child</div>
      </NotificationProvider>,
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("child-3")).toBeInTheDocument();
  });

  it("should render nested components", () => {
    const NestedComponent = () => <span>Nested</span>;

    render(
      <NotificationProvider>
        <div>
          <NestedComponent />
        </div>
      </NotificationProvider>,
    );

    expect(screen.getByText("Nested")).toBeInTheDocument();
  });

  it("should handle null children", () => {
    expect(() => {
      render(<NotificationProvider>{null}</NotificationProvider>);
    }).not.toThrow();
  });

  it("should handle undefined children", () => {
    expect(() => {
      render(<NotificationProvider>{undefined}</NotificationProvider>);
    }).not.toThrow();
  });

  it("should render string children", () => {
    render(<NotificationProvider>Plain text content</NotificationProvider>);

    expect(screen.getByText("Plain text content")).toBeInTheDocument();
  });

  it("should render fragment children", () => {
    render(
      <NotificationProvider>
        <>
          <div>Fragment child 1</div>
          <div>Fragment child 2</div>
        </>
      </NotificationProvider>,
    );

    expect(screen.getByText("Fragment child 1")).toBeInTheDocument();
    expect(screen.getByText("Fragment child 2")).toBeInTheDocument();
  });

  it("should preserve children props", () => {
    const handleClick = jest.fn();

    render(
      <NotificationProvider>
        <button onClick={handleClick} data-testid="button">
          Click me
        </button>
      </NotificationProvider>,
    );

    const button = screen.getByTestId("button");
    button.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should support conditional rendering", () => {
    const { rerender } = render(
      <NotificationProvider>
        {true && <div data-testid="conditional">Shown</div>}
      </NotificationProvider>,
    );

    expect(screen.getByTestId("conditional")).toBeInTheDocument();

    rerender(
      <NotificationProvider>
        {false && <div data-testid="conditional">Hidden</div>}
      </NotificationProvider>,
    );

    expect(screen.queryByTestId("conditional")).not.toBeInTheDocument();
  });
});
