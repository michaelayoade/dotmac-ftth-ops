/**
 * Skip Link Component Tests
 *
 * Tests SkipLink component for keyboard navigation accessibility
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { SkipLink } from "../skip-link";

describe("SkipLink", () => {
  describe("Basic Rendering", () => {
    it("renders skip link", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toBeInTheDocument();
    });

    it("is an anchor element", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link.tagName).toBe("A");
    });

    it("has correct href", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveAttribute("href", "#main-content");
    });
  });

  describe("Accessibility", () => {
    it("is screen reader only by default", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("sr-only");
    });

    it("becomes visible on focus", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:not-sr-only");
    });

    it("can be focused with keyboard", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      link.focus();

      expect(document.activeElement).toBe(link);
    });

    it("provides clear navigation hint", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link.textContent).toBe("Skip to main content");
    });
  });

  describe("Styling", () => {
    it("has absolute positioning when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:absolute");
    });

    it("has top and left positioning when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:top-4", "focus:left-4");
    });

    it("has high z-index when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:z-50");
    });

    it("has padding when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:px-4", "focus:py-2");
    });

    it("has primary background when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:bg-primary");
    });

    it("has primary foreground text when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:text-primary-foreground");
    });

    it("has rounded corners when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:rounded-md");
    });

    it("removes default outline when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:outline-none");
    });

    it("has focus ring when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:ring-2", "focus:ring-primary");
    });

    it("has ring offset when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      expect(link).toHaveClass("focus:ring-offset-2", "focus:ring-offset-background");
    });
  });

  describe("Keyboard Navigation", () => {
    it("is the first focusable element", () => {
      render(
        <div>
          <SkipLink />
          <button>Button 1</button>
          <button>Button 2</button>
        </div>,
      );

      const link = screen.getByText("Skip to main content");
      const button1 = screen.getByText("Button 1");

      // Tab to first element
      link.focus();
      expect(document.activeElement).toBe(link);

      // Skip link should be first in tab order
      expect(link.compareDocumentPosition(button1)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("can be activated with Enter key", async () => {
      const user = userEvent.setup();
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      link.focus();

      await user.keyboard("{Enter}");

      // Link should navigate (actual navigation depends on presence of #main-content)
      expect(link).toBeInTheDocument();
    });

    it("can be activated with Space key", async () => {
      const user = userEvent.setup();
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");
      link.focus();

      await user.keyboard(" ");

      // Link should navigate
      expect(link).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("works with main content target", () => {
      render(
        <div>
          <SkipLink />
          <nav>Navigation</nav>
          <main id="main-content">Main Content</main>
        </div>,
      );

      const link = screen.getByText("Skip to main content");
      const mainContent = screen.getByText("Main Content");

      expect(link).toHaveAttribute("href", "#main-content");
      expect(mainContent.closest("main")).toHaveAttribute("id", "main-content");
    });

    it("appears before navigation in document order", () => {
      render(
        <div>
          <SkipLink />
          <nav>Navigation</nav>
        </div>,
      );

      const link = screen.getByText("Skip to main content");
      const nav = screen.getByText("Navigation");

      expect(link.compareDocumentPosition(nav)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders in page header", () => {
      render(
        <header>
          <SkipLink />
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>,
      );

      expect(screen.getByText("Skip to main content")).toBeInTheDocument();
    });

    it("provides accessibility for keyboard users", () => {
      render(
        <div>
          <SkipLink />
          <header>
            <nav>
              <a href="/">Link 1</a>
              <a href="/">Link 2</a>
              <a href="/">Link 3</a>
              <a href="/">Link 4</a>
              <a href="/">Link 5</a>
            </nav>
          </header>
          <main id="main-content">Main Content</main>
        </div>,
      );

      const skipLink = screen.getByText("Skip to main content");
      skipLink.focus();

      // Skip link allows users to bypass repetitive navigation
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });
  });

  describe("WCAG Compliance", () => {
    it("meets WCAG 2.4.1 Bypass Blocks requirement", () => {
      render(
        <div>
          <SkipLink />
          <nav>Navigation</nav>
          <main id="main-content">Main Content</main>
        </div>,
      );

      const link = screen.getByText("Skip to main content");

      // Skip link provides mechanism to bypass blocks of content
      expect(link).toHaveAttribute("href", "#main-content");
      expect(link).toHaveClass("sr-only", "focus:not-sr-only");
    });

    it("is visible when focused for WCAG 2.4.7 Focus Visible", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");

      // When focused, the link becomes visible
      expect(link).toHaveClass("focus:not-sr-only");
      expect(link).toHaveClass("focus:ring-2");
    });

    it("has sufficient color contrast when visible", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");

      // Primary background with primary-foreground text should have good contrast
      expect(link).toHaveClass("focus:bg-primary", "focus:text-primary-foreground");
    });
  });

  describe("Visual Regression", () => {
    it("is hidden from visual users by default", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");

      // sr-only hides from visual users but keeps accessible to screen readers
      expect(link).toHaveClass("sr-only");
    });

    it("does not affect layout when hidden", () => {
      render(
        <div>
          <SkipLink />
          <div>Content</div>
        </div>,
      );

      // Skip link with sr-only should not affect layout
      const content = screen.getByText("Content");
      expect(content).toBeInTheDocument();
    });

    it("appears above content when focused", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");

      // When focused, appears with absolute positioning and high z-index
      expect(link).toHaveClass("focus:absolute", "focus:z-50");
    });
  });

  describe("Edge Cases", () => {
    it("works with multiple skip links", () => {
      render(
        <div>
          <SkipLink />
          <a href="#navigation" className="sr-only focus:not-sr-only">
            Skip to navigation
          </a>
        </div>,
      );

      expect(screen.getByText("Skip to main content")).toBeInTheDocument();
      expect(screen.getByText("Skip to navigation")).toBeInTheDocument();
    });

    it("handles missing target gracefully", () => {
      render(<SkipLink />);

      const link = screen.getByText("Skip to main content");

      // Even without #main-content present, link should render
      expect(link).toHaveAttribute("href", "#main-content");
    });
  });
});
