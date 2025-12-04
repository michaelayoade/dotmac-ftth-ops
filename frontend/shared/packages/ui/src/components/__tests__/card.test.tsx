/**
 * Card Component Tests
 *
 * Tests shadcn/ui Card primitive with composition and variants
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";

describe("Card", () => {
  describe("Basic Rendering", () => {
    it("renders card with content", () => {
      render(<Card>Card content</Card>);

      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("renders as div element", () => {
      const { container } = render(<Card>Content</Card>);

      const card = container.firstChild;
      expect(card?.nodeName).toBe("DIV");
    });

    it("applies base styles", () => {
      const { container } = render(<Card>Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("rounded-lg", "border", "transition-colors");
    });

    it("renders with custom className", () => {
      const { container } = render(<Card className="custom-class">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("custom-class");
    });
  });

  describe("Variants", () => {
    it("renders default variant", () => {
      const { container } = render(<Card variant="default">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("border-border", "bg-card", "text-card-foreground");
    });

    it("renders elevated variant with shadow", () => {
      const { container } = render(<Card variant="elevated">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("border-border", "bg-card", "shadow-lg");
    });

    it("renders outline variant", () => {
      const { container } = render(<Card variant="outline">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("border-2", "border-border", "bg-transparent");
    });

    it("renders ghost variant with transparent style", () => {
      const { container } = render(<Card variant="ghost">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("border-transparent", "bg-transparent");
    });

    it("defaults to default variant when not specified", () => {
      const { container } = render(<Card>Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-card");
    });
  });

  describe("CardHeader", () => {
    it("renders card header", () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>,
      );

      expect(screen.getByText("Header content")).toBeInTheDocument();
    });

    it("applies header styles", () => {
      render(
        <Card>
          <CardHeader data-testid="header">Content</CardHeader>
        </Card>,
      );

      const header = screen.getByTestId("header");
      expect(header).toHaveClass("flex", "flex-col", "space-y-1.5", "p-6");
    });

    it("supports custom className", () => {
      render(
        <Card>
          <CardHeader className="custom-header">Content</CardHeader>
        </Card>,
      );

      const header = screen.getByText("Content");
      expect(header).toHaveClass("custom-header");
    });
  });

  describe("CardTitle", () => {
    it("renders card title", () => {
      render(
        <Card>
          <CardTitle>Card Title</CardTitle>
        </Card>,
      );

      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });

    it("renders as h3 element", () => {
      render(
        <Card>
          <CardTitle>Title</CardTitle>
        </Card>,
      );

      const title = screen.getByText("Title");
      expect(title.tagName).toBe("H3");
    });

    it("applies title styles", () => {
      render(
        <Card>
          <CardTitle>Title</CardTitle>
        </Card>,
      );

      const title = screen.getByText("Title");
      expect(title).toHaveClass("text-2xl", "font-semibold", "leading-none", "tracking-tight");
    });

    it("supports custom className", () => {
      render(
        <Card>
          <CardTitle className="custom-title">Title</CardTitle>
        </Card>,
      );

      const title = screen.getByText("Title");
      expect(title).toHaveClass("custom-title");
    });
  });

  describe("CardDescription", () => {
    it("renders card description", () => {
      render(
        <Card>
          <CardDescription>Card description text</CardDescription>
        </Card>,
      );

      expect(screen.getByText("Card description text")).toBeInTheDocument();
    });

    it("renders as p element", () => {
      render(
        <Card>
          <CardDescription>Description</CardDescription>
        </Card>,
      );

      const description = screen.getByText("Description");
      expect(description.tagName).toBe("P");
    });

    it("applies description styles", () => {
      render(
        <Card>
          <CardDescription>Description</CardDescription>
        </Card>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("supports custom className", () => {
      render(
        <Card>
          <CardDescription className="custom-desc">Description</CardDescription>
        </Card>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("custom-desc");
    });
  });

  describe("CardContent", () => {
    it("renders card content", () => {
      render(
        <Card>
          <CardContent>Main content</CardContent>
        </Card>,
      );

      expect(screen.getByText("Main content")).toBeInTheDocument();
    });

    it("applies content styles", () => {
      render(
        <Card>
          <CardContent data-testid="content">Content</CardContent>
        </Card>,
      );

      const content = screen.getByTestId("content");
      expect(content).toHaveClass("p-6", "pt-0");
    });

    it("supports custom className", () => {
      render(
        <Card>
          <CardContent className="custom-content">Content</CardContent>
        </Card>,
      );

      const content = screen.getByText("Content");
      expect(content).toHaveClass("custom-content");
    });
  });

  describe("CardFooter", () => {
    it("renders card footer", () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>,
      );

      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("applies footer styles", () => {
      render(
        <Card>
          <CardFooter data-testid="footer">Content</CardFooter>
        </Card>,
      );

      const footer = screen.getByTestId("footer");
      expect(footer).toHaveClass("flex", "items-center", "p-6", "pt-0");
    });

    it("supports custom className", () => {
      render(
        <Card>
          <CardFooter className="custom-footer">Content</CardFooter>
        </Card>,
      );

      const footer = screen.getByText("Content");
      expect(footer).toHaveClass("custom-footer");
    });
  });

  describe("Composition", () => {
    it("renders complete card with all components", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>,
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });

    it("maintains correct component hierarchy", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>,
      );

      const title = screen.getByText("Title");
      const description = screen.getByText("Description");
      const content = screen.getByText("Content");

      expect(title.parentElement).toContainElement(description);
      expect(content).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Card", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Card ref={ref}>Content</Card>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CardHeader", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Card>
          <CardHeader ref={ref}>Content</CardHeader>
        </Card>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CardTitle", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <Card>
          <CardTitle ref={ref}>Title</CardTitle>
        </Card>,
      );

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });

    it("forwards ref to CardDescription", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <Card>
          <CardDescription ref={ref}>Description</CardDescription>
        </Card>,
      );

      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });

    it("forwards ref to CardContent", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Card>
          <CardContent ref={ref}>Content</CardContent>
        </Card>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CardFooter", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Card>
          <CardFooter ref={ref}>Footer</CardFooter>
        </Card>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes to Card", () => {
      render(
        <Card data-testid="custom-card" data-custom="value">
          Content
        </Card>,
      );

      const card = screen.getByTestId("custom-card");
      expect(card).toHaveAttribute("data-custom", "value");
    });

    it("supports id attribute", () => {
      const { container } = render(<Card id="my-card">Content</Card>);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute("id", "my-card");
    });

    it("supports onClick handler", () => {
      const handleClick = jest.fn();

      const { container } = render(<Card onClick={handleClick}>Content</Card>);

      const card = container.firstChild as HTMLElement;
      card.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Display Names", () => {
    it("Card has correct display name", () => {
      expect(Card.displayName).toBe("Card");
    });

    it("CardHeader has correct display name", () => {
      expect(CardHeader.displayName).toBe("CardHeader");
    });

    it("CardTitle has correct display name", () => {
      expect(CardTitle.displayName).toBe("CardTitle");
    });

    it("CardDescription has correct display name", () => {
      expect(CardDescription.displayName).toBe("CardDescription");
    });

    it("CardContent has correct display name", () => {
      expect(CardContent.displayName).toBe("CardContent");
    });

    it("CardFooter has correct display name", () => {
      expect(CardFooter.displayName).toBe("CardFooter");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders metric card", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$45,231.89</div>
          </CardContent>
        </Card>,
      );

      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      expect(screen.getByText("$45,231.89")).toBeInTheDocument();
    });

    it("renders form card with footer actions", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Enter your details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form>
              <input placeholder="Email" />
            </form>
          </CardContent>
          <CardFooter>
            <button>Cancel</button>
            <button>Submit</button>
          </CardFooter>
        </Card>,
      );

      expect(screen.getByText("Create Account")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    });

    it("renders notification card", () => {
      render(
        <Card variant="outline">
          <CardHeader>
            <CardTitle>Notification</CardTitle>
          </CardHeader>
          <CardContent>You have a new message</CardContent>
        </Card>,
      );

      expect(screen.getByText("Notification")).toBeInTheDocument();
    });

    it("renders elevated card for emphasis", () => {
      const { container } = render(
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Featured</CardTitle>
          </CardHeader>
          <CardContent>Premium content</CardContent>
        </Card>,
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("shadow-lg");
    });
  });
});
