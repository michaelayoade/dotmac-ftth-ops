/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { ThemeProvider } from "../components/ThemeProvider";

describe("ThemeProvider", () => {
  describe("Basic Rendering", () => {
    it("renders children correctly", () => {
      render(
        <ThemeProvider portal="admin">
          <div data-testid="child">Hello World</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <ThemeProvider portal="admin">
          <div data-testid="child1">First</div>
          <div data-testid="child2">Second</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
    });
  });

  describe("Portal Configuration", () => {
    const portals = ["admin", "customer", "reseller", "technician", "management"] as const;

    portals.forEach((portal) => {
      it(`renders correctly for ${portal} portal`, () => {
        render(
          <ThemeProvider portal={portal}>
            <div data-testid="content">Content</div>
          </ThemeProvider>
        );

        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });
  });

  describe("Theme Prop", () => {
    it("accepts optional theme prop", () => {
      render(
        <ThemeProvider portal="admin" theme="dark">
          <div data-testid="content">Content</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("works without theme prop", () => {
      render(
        <ThemeProvider portal="customer">
          <div data-testid="content">Content</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("Nested Providers", () => {
    it("supports nested theme providers", () => {
      render(
        <ThemeProvider portal="admin">
          <ThemeProvider portal="customer">
            <div data-testid="nested">Nested Content</div>
          </ThemeProvider>
        </ThemeProvider>
      );

      expect(screen.getByTestId("nested")).toBeInTheDocument();
    });
  });
});
