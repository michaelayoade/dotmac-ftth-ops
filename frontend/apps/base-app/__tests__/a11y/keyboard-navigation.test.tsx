/**
 * Keyboard Navigation Tests
 *
 * Tests that keyboard navigation works properly throughout the app
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "@/components/ui/button";
import userEvent from "@testing-library/user-event";

describe("Keyboard Navigation", () => {
  describe("Tab Navigation", () => {
    it("should navigate through buttons with Tab key", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
          <Button>Third</Button>
        </div>,
      );

      const buttons = screen.getAllByRole("button");

      // Tab through buttons
      await user.tab();
      expect(buttons[0]).toHaveFocus();

      await user.tab();
      expect(buttons[1]).toHaveFocus();

      await user.tab();
      expect(buttons[2]).toHaveFocus();
    });

    it("should reverse navigation with Shift+Tab", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
        </div>,
      );

      const buttons = screen.getAllByRole("button");

      // Tab to second button
      await user.tab();
      await user.tab();
      expect(buttons[1]).toHaveFocus();

      // Shift+Tab back to first
      await user.tab({ shift: true });
      expect(buttons[0]).toHaveFocus();
    });

    it("should skip disabled buttons", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First</Button>
          <Button disabled>Disabled</Button>
          <Button>Third</Button>
        </div>,
      );

      const buttons = screen.getAllByRole("button");

      await user.tab();
      expect(buttons[0]).toHaveFocus();

      await user.tab();
      // Should skip disabled button and focus third
      expect(buttons[2]).toHaveFocus();
    });
  });

  describe("Button Activation", () => {
    it("should activate button with Enter key", async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      button.focus();

      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should activate button with Space key", async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      button.focus();

      await user.keyboard(" ");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not activate disabled button", async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>,
      );

      const button = screen.getByRole("button");

      await user.keyboard("{Enter}");
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Focus Indicators", () => {
    it("should show focus ring when button receives keyboard focus", () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole("button");

      // Focus the button
      button.focus();

      // Button should have focus
      expect(button).toHaveFocus();

      // Should have focus-visible classes
      expect(button.className).toContain("focus-visible:ring-2");
      expect(button.className).toContain("focus-visible:ring-primary");
    });

    it("should have visible focus outline", async () => {
      const { container } = render(<Button>Focus test</Button>);
      const results = await axe(container);

      // Axe should check for focus indicators
      expect(results).toHaveNoViolations();
    });
  });

  describe("No Keyboard Traps", () => {
    it("should allow tabbing out of button group", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <input type="text" placeholder="Before" />
          <div>
            <Button>Button 1</Button>
            <Button>Button 2</Button>
          </div>
          <input type="text" placeholder="After" />
        </div>,
      );

      const inputBefore = screen.getByPlaceholderText("Before");
      const inputAfter = screen.getByPlaceholderText("After");

      // Start at first input
      inputBefore.focus();
      expect(inputBefore).toHaveFocus();

      // Tab through buttons
      await user.tab();
      await user.tab();
      await user.tab();

      // Should reach input after buttons
      expect(inputAfter).toHaveFocus();
    });
  });

  describe("Skip Link", () => {
    it("should focus skip link on first Tab", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <a href="#main-content" className="sr-only focus:not-sr-only">
            Skip to main content
          </a>
          <main id="main-content">
            <h1>Main Content</h1>
          </main>
        </div>,
      );

      await user.tab();

      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveFocus();
    });
  });
});
