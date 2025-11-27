/**
 * Portal Card Component Tests
 *
 * Tests portal-aware card with compound components
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardDescription,
  PortalCardContent,
  PortalCardFooter,
} from "../portal-card";

// Mock the usePortalTheme hook
const mockUsePortalTheme = jest.fn();
jest.mock("../../lib/design-system/portal-themes", () => ({
  usePortalTheme: () => mockUsePortalTheme(),
}));

describe("PortalCard", () => {
  beforeEach(() => {
    // Default mock theme
    mockUsePortalTheme.mockReturnValue({
      theme: {
        animations: {
          duration: 200,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          hoverScale: 1.05,
          activeScale: 0.95,
        },
        spacing: {
          componentGap: "1.5rem",
        },
        fontSize: {
          sm: ["0.875rem", { lineHeight: "1.25rem" }],
          lg: ["1.125rem", { lineHeight: "1.75rem" }],
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders card element", () => {
      render(<PortalCard>Card Content</PortalCard>);

      expect(screen.getByText("Card Content")).toBeInTheDocument();
    });

    it("renders as div element", () => {
      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.querySelector("div");
      expect(card).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("rounded-lg");
    });

    it("has correct display name", () => {
      expect(PortalCard.displayName).toBe("PortalCard");
    });

    it("applies animation styles from theme", () => {
      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild as HTMLElement;
      expect(card.style.transitionDuration).toBe("200ms");
      expect(card.style.transitionTimingFunction).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });
  });

  describe("Variant Styles", () => {
    it("renders default variant", () => {
      const { container } = render(<PortalCard variant="default">Default Card</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("bg-card", "text-card-foreground", "border", "shadow-sm");
    });

    it("renders elevated variant", () => {
      const { container } = render(<PortalCard variant="elevated">Elevated Card</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("bg-card", "text-card-foreground", "shadow-lg");
    });

    it("renders outlined variant", () => {
      const { container } = render(<PortalCard variant="outlined">Outlined Card</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("bg-transparent", "border-2", "border-portal-primary/20");
    });

    it("renders flat variant", () => {
      const { container } = render(<PortalCard variant="flat">Flat Card</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("bg-card", "text-card-foreground");
      expect(card).not.toHaveClass("shadow-sm", "shadow-lg", "border");
    });

    it("defaults to default variant when not specified", () => {
      const { container } = render(<PortalCard>Default Card</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("bg-card", "border", "shadow-sm");
    });
  });

  describe("Hoverable Prop", () => {
    it("does not apply hover styles by default", () => {
      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).not.toHaveClass("hover:shadow-md");
    });

    it("applies hover styles when hoverable is true", () => {
      const { container } = render(<PortalCard hoverable>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("transition-all", "hover:shadow-md");
    });

    it("does not apply hover styles when hoverable is false", () => {
      const { container } = render(<PortalCard hoverable={false}>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).not.toHaveClass("hover:shadow-md");
    });
  });

  describe("Interactive Prop", () => {
    it("does not apply interactive styles by default", () => {
      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).not.toHaveClass("cursor-pointer");
    });

    it("applies interactive styles when interactive is true", () => {
      const { container } = render(<PortalCard interactive>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("cursor-pointer", "transition-all", "hover:shadow-md");
    });

    it("applies active scale when interactive is true", () => {
      const { container } = render(<PortalCard interactive>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("active:scale-[0.99]");
    });

    it("does not apply interactive styles when interactive is false", () => {
      const { container } = render(<PortalCard interactive={false}>Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(<PortalCard className="custom-card">Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("custom-card");
    });

    it("merges custom className with base classes", () => {
      const { container } = render(<PortalCard className="custom-card">Card Content</PortalCard>);

      const card = container.firstChild;
      expect(card).toHaveClass("custom-card", "rounded-lg", "bg-card");
    });
  });

  describe("HTML Attributes", () => {
    it("supports onClick handler", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      const { container } = render(
        <PortalCard interactive onClick={onClick}>
          Card Content
        </PortalCard>,
      );

      const card = container.firstChild as HTMLElement;
      await user.click(card);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("supports data attributes", () => {
      render(<PortalCard data-testid="test-card">Card Content</PortalCard>);

      const card = screen.getByTestId("test-card");
      expect(card).toBeInTheDocument();
    });

    it("supports aria attributes", () => {
      render(<PortalCard aria-label="Product card">Card Content</PortalCard>);

      const card = screen.getByLabelText("Product card");
      expect(card).toBeInTheDocument();
    });

    it("supports role attribute", () => {
      render(<PortalCard role="article">Card Content</PortalCard>);

      expect(screen.getByRole("article")).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to card element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<PortalCard ref={ref}>Card Content</PortalCard>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("ref can be used to access card element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<PortalCard ref={ref}>Card Content</PortalCard>);

      expect(ref.current?.textContent).toBe("Card Content");
    });
  });

  describe("Combined Props", () => {
    it("renders elevated hoverable card", () => {
      const { container } = render(
        <PortalCard variant="elevated" hoverable>
          Card Content
        </PortalCard>,
      );

      const card = container.firstChild;
      expect(card).toHaveClass("shadow-lg", "hover:shadow-md");
    });

    it("renders outlined interactive card", () => {
      const { container } = render(
        <PortalCard variant="outlined" interactive>
          Card Content
        </PortalCard>,
      );

      const card = container.firstChild;
      expect(card).toHaveClass("border-2", "border-portal-primary/20", "cursor-pointer");
    });

    it("renders flat hoverable interactive card", () => {
      const { container } = render(
        <PortalCard variant="flat" hoverable interactive>
          Card Content
        </PortalCard>,
      );

      const card = container.firstChild;
      expect(card).toHaveClass("bg-card", "cursor-pointer", "hover:shadow-md");
    });
  });

  describe("Different Portal Themes", () => {
    it("applies different animation duration", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 300,
            easing: "ease-in-out",
          },
          spacing: { componentGap: "1.5rem" },
          fontSize: {
            sm: ["0.875rem", { lineHeight: "1.25rem" }],
            lg: ["1.125rem", { lineHeight: "1.75rem" }],
          },
        },
      });

      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild as HTMLElement;
      expect(card.style.transitionDuration).toBe("300ms");
    });

    it("applies different animation easing", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 200,
            easing: "ease-out",
          },
          spacing: { componentGap: "1.5rem" },
          fontSize: {
            sm: ["0.875rem", { lineHeight: "1.25rem" }],
            lg: ["1.125rem", { lineHeight: "1.75rem" }],
          },
        },
      });

      const { container } = render(<PortalCard>Card Content</PortalCard>);

      const card = container.firstChild as HTMLElement;
      expect(card.style.transitionTimingFunction).toBe("ease-out");
    });
  });
});

describe("PortalCardHeader", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        spacing: {
          componentGap: "1.5rem",
        },
      },
    });
  });

  describe("Basic Rendering", () => {
    it("renders header element", () => {
      render(<PortalCardHeader>Header Content</PortalCardHeader>);

      expect(screen.getByText("Header Content")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(<PortalCardHeader>Header Content</PortalCardHeader>);

      const header = container.firstChild;
      expect(header).toHaveClass("flex", "flex-col", "space-y-1.5");
    });

    it("has correct display name", () => {
      expect(PortalCardHeader.displayName).toBe("PortalCardHeader");
    });

    it("applies portal spacing from theme", () => {
      const { container } = render(<PortalCardHeader>Header Content</PortalCardHeader>);

      const header = container.firstChild as HTMLElement;
      expect(header.style.padding).toBe("1.5rem");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <PortalCardHeader className="custom-header">Header Content</PortalCardHeader>,
      );

      const header = container.firstChild;
      expect(header).toHaveClass("custom-header");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to header element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<PortalCardHeader ref={ref}>Header Content</PortalCardHeader>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe("PortalCardTitle", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        fontSize: {
          lg: ["1.125rem", { lineHeight: "1.75rem" }],
        },
      },
    });
  });

  describe("Basic Rendering", () => {
    it("renders title element", () => {
      render(<PortalCardTitle>Card Title</PortalCardTitle>);

      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });

    it("renders as h3 element", () => {
      const { container } = render(<PortalCardTitle>Card Title</PortalCardTitle>);

      const title = container.querySelector("h3");
      expect(title).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(<PortalCardTitle>Card Title</PortalCardTitle>);

      const title = container.querySelector("h3");
      expect(title).toHaveClass("font-semibold", "leading-none", "tracking-tight");
    });

    it("has correct display name", () => {
      expect(PortalCardTitle.displayName).toBe("PortalCardTitle");
    });

    it("applies portal fontSize from theme", () => {
      const { container } = render(<PortalCardTitle>Card Title</PortalCardTitle>);

      const title = container.querySelector("h3") as HTMLElement;
      expect(title.style.fontSize).toBe("1.125rem");
      expect(title.style.lineHeight).toBe("1.75rem");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <PortalCardTitle className="custom-title">Card Title</PortalCardTitle>,
      );

      const title = container.querySelector("h3");
      expect(title).toHaveClass("custom-title");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to title element", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(<PortalCardTitle ref={ref}>Card Title</PortalCardTitle>);

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });
});

describe("PortalCardDescription", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        fontSize: {
          sm: ["0.875rem", { lineHeight: "1.25rem" }],
        },
      },
    });
  });

  describe("Basic Rendering", () => {
    it("renders description element", () => {
      render(<PortalCardDescription>Card description text</PortalCardDescription>);

      expect(screen.getByText("Card description text")).toBeInTheDocument();
    });

    it("renders as p element", () => {
      const { container } = render(
        <PortalCardDescription>Card description text</PortalCardDescription>,
      );

      const description = container.querySelector("p");
      expect(description).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(
        <PortalCardDescription>Card description text</PortalCardDescription>,
      );

      const description = container.querySelector("p");
      expect(description).toHaveClass("text-muted-foreground");
    });

    it("has correct display name", () => {
      expect(PortalCardDescription.displayName).toBe("PortalCardDescription");
    });

    it("applies portal fontSize from theme", () => {
      const { container } = render(
        <PortalCardDescription>Card description text</PortalCardDescription>,
      );

      const description = container.querySelector("p") as HTMLElement;
      expect(description.style.fontSize).toBe("0.875rem");
      expect(description.style.lineHeight).toBe("1.25rem");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <PortalCardDescription className="custom-description">
          Card description text
        </PortalCardDescription>,
      );

      const description = container.querySelector("p");
      expect(description).toHaveClass("custom-description");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to description element", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(<PortalCardDescription ref={ref}>Card description text</PortalCardDescription>);

      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });
});

describe("PortalCardContent", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        spacing: {
          componentGap: "1.5rem",
        },
      },
    });
  });

  describe("Basic Rendering", () => {
    it("renders content element", () => {
      render(<PortalCardContent>Card content</PortalCardContent>);

      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("has correct display name", () => {
      expect(PortalCardContent.displayName).toBe("PortalCardContent");
    });

    it("applies portal spacing from theme", () => {
      const { container } = render(<PortalCardContent>Card content</PortalCardContent>);

      const content = container.firstChild as HTMLElement;
      // Padding is set to 1.5rem, then paddingTop is overridden to 0
      expect(content.style.paddingTop).toBe("0px");
      expect(content.style.paddingRight).toBe("1.5rem");
      expect(content.style.paddingBottom).toBe("1.5rem");
      expect(content.style.paddingLeft).toBe("1.5rem");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <PortalCardContent className="custom-content">Card content</PortalCardContent>,
      );

      const content = container.firstChild;
      expect(content).toHaveClass("custom-content");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to content element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<PortalCardContent ref={ref}>Card content</PortalCardContent>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe("PortalCardFooter", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        spacing: {
          componentGap: "1.5rem",
        },
      },
    });
  });

  describe("Basic Rendering", () => {
    it("renders footer element", () => {
      render(<PortalCardFooter>Footer content</PortalCardFooter>);

      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(<PortalCardFooter>Footer content</PortalCardFooter>);

      const footer = container.firstChild;
      expect(footer).toHaveClass("flex", "items-center");
    });

    it("has correct display name", () => {
      expect(PortalCardFooter.displayName).toBe("PortalCardFooter");
    });

    it("applies portal spacing from theme", () => {
      const { container } = render(<PortalCardFooter>Footer content</PortalCardFooter>);

      const footer = container.firstChild as HTMLElement;
      // Padding is set to 1.5rem, then paddingTop is overridden to 0
      expect(footer.style.paddingTop).toBe("0px");
      expect(footer.style.paddingRight).toBe("1.5rem");
      expect(footer.style.paddingBottom).toBe("1.5rem");
      expect(footer.style.paddingLeft).toBe("1.5rem");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <PortalCardFooter className="custom-footer">Footer content</PortalCardFooter>,
      );

      const footer = container.firstChild;
      expect(footer).toHaveClass("custom-footer");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to footer element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<PortalCardFooter ref={ref}>Footer content</PortalCardFooter>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe("PortalCard Compound Component", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        animations: {
          duration: 200,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        },
        spacing: {
          componentGap: "1.5rem",
        },
        fontSize: {
          sm: ["0.875rem", { lineHeight: "1.25rem" }],
          lg: ["1.125rem", { lineHeight: "1.75rem" }],
        },
      },
    });
  });

  describe("Full Card Composition", () => {
    it("renders complete card with all components", () => {
      render(
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle>Product Title</PortalCardTitle>
            <PortalCardDescription>Product description goes here</PortalCardDescription>
          </PortalCardHeader>
          <PortalCardContent>Main content area</PortalCardContent>
          <PortalCardFooter>Footer actions</PortalCardFooter>
        </PortalCard>,
      );

      expect(screen.getByText("Product Title")).toBeInTheDocument();
      expect(screen.getByText("Product description goes here")).toBeInTheDocument();
      expect(screen.getByText("Main content area")).toBeInTheDocument();
      expect(screen.getByText("Footer actions")).toBeInTheDocument();
    });

    it("renders interactive card with all components", () => {
      const onClick = jest.fn();

      const { container } = render(
        <PortalCard interactive onClick={onClick}>
          <PortalCardHeader>
            <PortalCardTitle>Clickable Card</PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>Click anywhere on the card</PortalCardContent>
        </PortalCard>,
      );

      const card = container.firstChild;
      expect(card).toHaveClass("cursor-pointer");
    });

    it("renders elevated hoverable card", () => {
      const { container } = render(
        <PortalCard variant="elevated" hoverable>
          <PortalCardHeader>
            <PortalCardTitle>Elevated Card</PortalCardTitle>
          </PortalCardHeader>
        </PortalCard>,
      );

      const card = container.firstChild;
      expect(card).toHaveClass("shadow-lg", "hover:shadow-md");
    });

    it("can render partial components", () => {
      render(
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle>Title Only</PortalCardTitle>
          </PortalCardHeader>
        </PortalCard>,
      );

      expect(screen.getByText("Title Only")).toBeInTheDocument();
      expect(screen.queryByText("Footer")).not.toBeInTheDocument();
    });
  });
});
