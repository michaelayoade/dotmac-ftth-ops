/**
 * Comprehensive Tests for Card Component
 *
 * Tests accessibility, security, performance, and functionality
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  userEvent,
} from "@dotmac/testing";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../Card";

const CARD_PERFORMANCE_BUDGET_MS = 80;
const CARD_COMPLEX_BUDGET_MS = 120;

describe("Card Component", () => {
  // Basic functionality tests
  describe("Basic Functionality", () => {
    it("renders correctly with default props", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("custom-class");
    });

    it("renders as child component when asChild is true", () => {
      render(
        <Card asChild>
          <article data-testid="article-card">Content</article>
        </Card>,
      );

      const article = screen.getByTestId("article-card");
      expect(article.tagName).toBe("ARTICLE");
      expect(article).toHaveTextContent("Content");
    });
  });

  // Variant tests
  describe("Variants", () => {
    it("applies default variant styling", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("border-border");
    });

    it("applies outline variant styling", () => {
      const { container } = render(<Card variant="outline">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("bg-background");
    });

    it("applies filled variant styling", () => {
      const { container } = render(<Card variant="filled">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("bg-muted");
    });

    it("applies elevated variant styling", () => {
      const { container } = render(<Card variant="elevated">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("shadow-lg");
    });

    it("applies ghost variant styling", () => {
      const { container } = render(<Card variant="ghost">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("border-transparent", "bg-transparent", "shadow-none");
    });
  });

  // Padding tests
  describe("Padding", () => {
    it("applies default padding", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("p-6");
    });

    it("applies small padding", () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("p-3");
    });

    it("applies large padding", () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("p-8");
    });

    it("applies no padding", () => {
      const { container } = render(<Card padding="none">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass("p-0");
    });
  });

  // Interactive behavior tests
  describe("Interactive Behavior", () => {
    it("becomes interactive when interactive prop is true", () => {
      const handleClick = jest.fn();
      const { container } = render(
        <Card interactive onClick={handleClick}>
          Interactive card
        </Card>,
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("cursor-pointer");
      expect(card).toHaveAttribute("tabindex", "0");
      expect(card).toHaveAttribute("role", "button");
    });

    it("handles click events when interactive", async () => {
      const handleClick = jest.fn();
      const { user } = render(
        <Card interactive onClick={handleClick}>
          Click me
        </Card>,
      );

      const card = screen.getByText("Click me");
      await user.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("handles keyboard navigation when interactive", () => {
      const handleClick = jest.fn();
      render(
        <Card interactive onClick={handleClick}>
          Interactive card
        </Card>,
      );

      const card = screen.getByText("Interactive card");

      // Test Enter key
      fireEvent.keyDown(card, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Test Space key
      fireEvent.keyDown(card, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("does not interfere with regular keydown events when interactive", () => {
      const handleClick = jest.fn();
      const handleKeyDown = jest.fn();
      render(
        <Card interactive onClick={handleClick} onKeyDown={handleKeyDown}>
          Interactive card
        </Card>,
      );

      const card = screen.getByText("Interactive card");
      fireEvent.keyDown(card, { key: "Escape" });

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // Loading state tests
  describe("Loading State", () => {
    it("shows loading component when loading", () => {
      const LoadingComponent = () => <div data-testid="loading">Loading...</div>;
      render(
        <Card isLoading loadingComponent={<LoadingComponent />}>
          Original content
        </Card>,
      );

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.queryByText("Original content")).not.toBeInTheDocument();
    });

    it("shows loading overlay when showLoadingOverlay is true", () => {
      const { container } = render(
        <Card isLoading showLoadingOverlay>
          Content
        </Card>,
      );

      const overlay = container.querySelector(".absolute.inset-0");
      const spinner = container.querySelector(".animate-spin");

      expect(overlay).toBeInTheDocument();
      expect(spinner).toBeInTheDocument();
    });
  });
});

describe("Card Sub-components", () => {
  describe("CardHeader", () => {
    it("renders correctly", () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText("Header content")).toBeInTheDocument();
    });

    it("applies padding variants", () => {
      const { container } = render(<CardHeader padding="sm">Header</CardHeader>);
      const header = container.firstChild;
      expect(header).toHaveClass("p-3");
    });
  });

  describe("CardTitle", () => {
    it("renders with default heading level", () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByRole("heading", { level: 3 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("Title");
    });

    it("renders with custom heading level", () => {
      render(<CardTitle level={1}>Main Title</CardTitle>);
      const title = screen.getByRole("heading", { level: 1 });
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe("H1");
    });

    it("applies title styling", () => {
      render(<CardTitle>Styled Title</CardTitle>);
      const title = screen.getByRole("heading");
      expect(title).toHaveClass("text-2xl", "font-semibold", "leading-none", "tracking-tight");
    });
  });

  describe("CardDescription", () => {
    it("renders correctly", () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText("Description text")).toBeInTheDocument();
    });

    it("applies description styling", () => {
      render(<CardDescription>Styled description</CardDescription>);
      const description = screen.getByText("Styled description");
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });
  });

  describe("CardContent", () => {
    it("renders correctly", () => {
      render(<CardContent>Content area</CardContent>);
      expect(screen.getByText("Content area")).toBeInTheDocument();
    });

    it("applies content padding", () => {
      const { container } = render(<CardContent padding="lg">Large padding content</CardContent>);
      const content = container.firstChild;
      expect(content).toHaveClass("p-8", "pt-0");
    });
  });

  describe("CardFooter", () => {
    it("renders correctly", () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("applies footer styling", () => {
      render(<CardFooter>Footer</CardFooter>);
      const footer = screen.getByText("Footer");
      expect(footer).toHaveClass("flex", "items-center");
    });
  });
});

describe("Card Composition", () => {
  it("renders complete card composition", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>Main card content goes here.</CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "Card Title" })).toBeInTheDocument();
    expect(screen.getByText("Card description")).toBeInTheDocument();
    expect(screen.getByText("Main card content goes here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});

// Security tests
describe("Card Security", () => {
  it("passes security validation", async () => {
    const result = await renderSecurity(
      <Card>
        <CardHeader>
          <CardTitle>Safe Title</CardTitle>
          <CardDescription>Safe description</CardDescription>
        </CardHeader>
        <CardContent>Safe content</CardContent>
      </Card>,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("does not render dangerous content", async () => {
    // This test ensures the Card component itself doesn't introduce security vulnerabilities
    const result = await renderSecurity(
      <Card interactive onClick={() => {}}>
        Normal card content
      </Card>,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });
});

// Accessibility tests
describe("Card Accessibility", () => {
  it("is accessible by default", async () => {
    await renderA11y(
      <Card>
        <CardHeader>
          <CardTitle>Accessible Title</CardTitle>
          <CardDescription>Accessible description</CardDescription>
        </CardHeader>
        <CardContent>Accessible content</CardContent>
      </Card>,
    );
  });

  it("is accessible when interactive", async () => {
    await renderA11y(
      <Card interactive aria-label="Interactive card">
        Card content
      </Card>,
    );
  });

  it("has proper heading hierarchy", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle level={2}>Section Title</CardTitle>
        </CardHeader>
        <CardContent>
          <CardTitle level={3}>Subsection Title</CardTitle>
        </CardContent>
      </Card>,
    );

    const mainTitle = screen.getByRole("heading", { level: 2 });
    const subTitle = screen.getByRole("heading", { level: 3 });

    expect(mainTitle).toBeInTheDocument();
    expect(subTitle).toBeInTheDocument();
  });

  it("is keyboard navigable when interactive", () => {
    render(
      <Card interactive aria-label="Interactive card">
        Focusable card
      </Card>,
    );

    const card = screen.getByLabelText("Interactive card");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});

// Performance tests
describe("Card Performance", () => {
  it("renders within performance threshold", () => {
    const result = renderPerformance(
      <Card>
        <CardHeader>
          <CardTitle>Performance Test</CardTitle>
          <CardDescription>Testing render performance</CardDescription>
        </CardHeader>
        <CardContent>Card content</CardContent>
      </Card>,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(CARD_PERFORMANCE_BUDGET_MS);
  });

  it("handles complex content efficiently", () => {
    const ComplexContent = () => (
      <>
        {Array.from({ length: 50 }, (_, i) => (
          <p key={i}>Complex content item {i}</p>
        ))}
      </>
    );

    const result = renderPerformance(
      <Card>
        <CardContent>
          <ComplexContent />
        </CardContent>
      </Card>,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(CARD_COMPLEX_BUDGET_MS); // Allow more time for complex content
  });
});

// Comprehensive test
describe("Card Comprehensive Testing", () => {
  it("passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <Card interactive aria-label="Complete card example">
        <CardHeader>
          <CardTitle>Complete Card</CardTitle>
          <CardDescription>This card tests all functionality</CardDescription>
        </CardHeader>
        <CardContent>Complete card content with all features tested.</CardContent>
        <CardFooter>
          <button>Complete</button>
        </CardFooter>
      </Card>,
    );

    // All tests should pass
    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(CARD_PERFORMANCE_BUDGET_MS);
    expect(result.container).toHaveValidMarkup();
  });
});
