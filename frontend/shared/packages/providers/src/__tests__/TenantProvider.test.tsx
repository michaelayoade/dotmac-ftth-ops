/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { TenantProvider } from "../components/TenantProvider";

describe("TenantProvider", () => {
  describe("Basic Rendering", () => {
    it("renders children correctly", () => {
      render(
        <TenantProvider portal="admin">
          <div data-testid="child">Hello World</div>
        </TenantProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <TenantProvider portal="admin">
          <div data-testid="child1">First</div>
          <div data-testid="child2">Second</div>
        </TenantProvider>
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
          <TenantProvider portal={portal}>
            <div data-testid="content">Content</div>
          </TenantProvider>
        );

        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });
  });

  describe("Tenant Variant", () => {
    const variants = ["single", "multi", "isp"] as const;

    variants.forEach((variant) => {
      it(`accepts ${variant} variant`, () => {
        render(
          <TenantProvider portal="admin" variant={variant}>
            <div data-testid="content">Content</div>
          </TenantProvider>
        );

        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });

    it("works without variant prop", () => {
      render(
        <TenantProvider portal="admin">
          <div data-testid="content">Content</div>
        </TenantProvider>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("Portal and Variant Combinations", () => {
    it("accepts admin portal with multi variant", () => {
      render(
        <TenantProvider portal="admin" variant="multi">
          <div data-testid="combo">Admin Multi</div>
        </TenantProvider>
      );

      expect(screen.getByTestId("combo")).toBeInTheDocument();
    });

    it("accepts customer portal with single variant", () => {
      render(
        <TenantProvider portal="customer" variant="single">
          <div data-testid="combo">Customer Single</div>
        </TenantProvider>
      );

      expect(screen.getByTestId("combo")).toBeInTheDocument();
    });

    it("accepts reseller portal with isp variant", () => {
      render(
        <TenantProvider portal="reseller" variant="isp">
          <div data-testid="combo">Reseller ISP</div>
        </TenantProvider>
      );

      expect(screen.getByTestId("combo")).toBeInTheDocument();
    });
  });

  describe("Nested Providers", () => {
    it("supports nested tenant providers", () => {
      render(
        <TenantProvider portal="admin" variant="multi">
          <TenantProvider portal="customer" variant="single">
            <div data-testid="nested">Nested Content</div>
          </TenantProvider>
        </TenantProvider>
      );

      expect(screen.getByTestId("nested")).toBeInTheDocument();
    });
  });
});
