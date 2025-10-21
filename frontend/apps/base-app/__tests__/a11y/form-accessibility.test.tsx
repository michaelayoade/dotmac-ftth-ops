/**
 * Form Accessibility Tests
 *
 * Tests that forms meet WCAG 2.1 AA standards
 */

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

describe("Form Accessibility", () => {
  describe("Form Labels", () => {
    it("should associate label with input using htmlFor/id", async () => {
      const { container } = render(
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" />
        </div>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const label = screen.getByText("Email");
      const input = screen.getByLabelText("Email");

      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });

    it("should support aria-label for inputs", async () => {
      const { container } = render(<Input aria-label="Search" type="search" />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const input = screen.getByLabelText("Search");
      expect(input).toBeInTheDocument();
    });

    it("should support aria-labelledby", async () => {
      const { container } = render(
        <div>
          <span id="username-label">Username</span>
          <Input aria-labelledby="username-label" />
        </div>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Required Fields", () => {
    it("should mark required fields with aria-required", async () => {
      const { container } = render(
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input id="name" required aria-required="true" />
        </div>,
      );

      const input = screen.getByLabelText(/Name/);
      expect(input).toHaveAttribute("aria-required", "true");
      expect(input).toHaveAttribute("required");

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Error Messages", () => {
    it("should announce errors with aria-invalid and aria-describedby", async () => {
      const { container } = render(
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" aria-invalid="true" aria-describedby="email-error" />
          <p id="email-error" role="alert">
            Please enter a valid email address
          </p>
        </div>,
      );

      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "email-error");

      const error = screen.getByRole("alert");
      expect(error).toHaveTextContent("Please enter a valid email address");

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should use aria-errormessage for error messages", async () => {
      const { container } = render(
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            aria-invalid="true"
            aria-errormessage="password-error"
          />
          <p id="password-error" role="alert">
            Password must be at least 8 characters
          </p>
        </div>,
      );

      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("aria-errormessage", "password-error");

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Form Validation", () => {
    it("should announce validation status changes", () => {
      const { rerender } = render(
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" />
        </div>,
      );

      // Add error
      rerender(
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" aria-invalid="true" aria-describedby="username-error" />
          <p id="username-error" role="alert">
            Username is required
          </p>
        </div>,
      );

      const input = screen.getByLabelText("Username");
      expect(input).toHaveAttribute("aria-invalid", "true");

      const error = screen.getByRole("alert");
      expect(error).toBeInTheDocument();
    });
  });

  describe("Fieldsets and Legends", () => {
    it("should group related inputs with fieldset and legend", async () => {
      const { container } = render(
        <fieldset>
          <legend>Contact Information</legend>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" />
          </div>
        </fieldset>,
      );

      const legend = screen.getByText("Contact Information");
      expect(legend).toBeInTheDocument();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Help Text", () => {
    it("should associate help text with input using aria-describedby", async () => {
      const { container } = render(
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" aria-describedby="password-help" />
          <p id="password-help" className="text-sm text-muted-foreground">
            Must be at least 8 characters with a mix of letters and numbers
          </p>
        </div>,
      );

      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("aria-describedby", "password-help");

      const helpText = screen.getByText(/Must be at least 8 characters/);
      expect(helpText).toBeInTheDocument();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Autocomplete", () => {
    it("should use autocomplete for common fields", async () => {
      const { container } = render(
        <form>
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="tel">Phone</Label>
            <Input id="tel" type="tel" autoComplete="tel" />
          </div>
        </form>,
      );

      const nameInput = screen.getByLabelText("Full Name");
      expect(nameInput).toHaveAttribute("autocomplete", "name");

      const emailInput = screen.getByLabelText("Email");
      expect(emailInput).toHaveAttribute("autocomplete", "email");

      const telInput = screen.getByLabelText("Phone");
      expect(telInput).toHaveAttribute("autocomplete", "tel");

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
