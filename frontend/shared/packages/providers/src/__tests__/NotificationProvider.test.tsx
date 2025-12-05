/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { NotificationProvider } from "../components/NotificationProvider";

describe("NotificationProvider", () => {
  describe("Basic Rendering", () => {
    it("renders children correctly", () => {
      render(
        <NotificationProvider>
          <div data-testid="child">Hello World</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("renders without children", () => {
      const { container } = render(<NotificationProvider />);
      // Should not throw
      expect(container).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <NotificationProvider>
          <div data-testid="child1">First</div>
          <div data-testid="child2">Second</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
    });
  });

  describe("Configuration Props", () => {
    it("accepts maxNotifications prop", () => {
      render(
        <NotificationProvider maxNotifications={5}>
          <div data-testid="content">Content</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("accepts defaultDuration prop", () => {
      render(
        <NotificationProvider defaultDuration={3000}>
          <div data-testid="content">Content</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("accepts position prop", () => {
      const positions = [
        "top-right",
        "top-left",
        "bottom-right",
        "bottom-left",
        "top-center",
        "bottom-center",
      ] as const;

      positions.forEach((position) => {
        const { unmount } = render(
          <NotificationProvider position={position}>
            <div data-testid={`content-${position}`}>Content</div>
          </NotificationProvider>
        );

        expect(screen.getByTestId(`content-${position}`)).toBeInTheDocument();
        unmount();
      });
    });

    it("accepts all props together", () => {
      render(
        <NotificationProvider
          maxNotifications={10}
          defaultDuration={5000}
          position="bottom-right"
        >
          <div data-testid="content">Content</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("Nested Providers", () => {
    it("supports nested notification providers", () => {
      render(
        <NotificationProvider maxNotifications={5}>
          <NotificationProvider maxNotifications={3}>
            <div data-testid="nested">Nested Content</div>
          </NotificationProvider>
        </NotificationProvider>
      );

      expect(screen.getByTestId("nested")).toBeInTheDocument();
    });
  });

  describe("Default Values", () => {
    it("works without any props", () => {
      render(
        <NotificationProvider>
          <div data-testid="default">Default Config</div>
        </NotificationProvider>
      );

      expect(screen.getByTestId("default")).toBeInTheDocument();
    });
  });
});
