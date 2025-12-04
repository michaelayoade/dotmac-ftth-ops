/**
 * Avatar Component Tests
 *
 * Tests shadcn/ui Avatar component with image and fallback
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Avatar, AvatarImage, AvatarFallback } from "../avatar";

describe("Avatar", () => {
  describe("Basic Rendering", () => {
    it("renders avatar container", () => {
      const { container } = render(<Avatar />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(<Avatar data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(<Avatar data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass(
        "relative",
        "flex",
        "h-10",
        "w-10",
        "shrink-0",
        "overflow-hidden",
        "rounded-full",
      );
    });

    it("renders with custom className", () => {
      render(<Avatar className="custom-avatar" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("custom-avatar");
    });
  });

  describe("AvatarImage", () => {
    it("renders image element", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image).toBeInTheDocument();
    });

    it("renders as img element", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image.tagName).toBe("IMG");
    });

    it("has src attribute", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "/avatar.jpg");
    });

    it("has alt attribute", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="John Doe" />
        </Avatar>,
      );

      const image = screen.getByRole("img", { name: "John Doe" });
      expect(image).toBeInTheDocument();
    });

    it("defaults to empty alt when not provided", () => {
      const { container } = render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" />
        </Avatar>,
      );

      const image = container.querySelector("img");
      expect(image).toHaveAttribute("alt", "");
    });

    it("applies base styles", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" data-testid="avatar-image" />
        </Avatar>,
      );

      const image = screen.getByTestId("avatar-image");
      expect(image).toHaveClass("aspect-square", "h-full", "w-full");
    });

    it("supports custom className", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" className="custom-image" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image).toHaveClass("custom-image");
    });
  });

  describe("AvatarFallback", () => {
    it("renders fallback element", () => {
      render(
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(
        <Avatar>
          <AvatarFallback data-testid="fallback">JD</AvatarFallback>
        </Avatar>,
      );

      const fallback = screen.getByTestId("fallback");
      expect(fallback.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(
        <Avatar>
          <AvatarFallback data-testid="fallback">JD</AvatarFallback>
        </Avatar>,
      );

      const fallback = screen.getByTestId("fallback");
      expect(fallback).toHaveClass(
        "flex",
        "h-full",
        "w-full",
        "items-center",
        "justify-center",
        "rounded-full",
        "bg-muted",
      );
    });

    it("supports custom className", () => {
      render(
        <Avatar>
          <AvatarFallback className="custom-fallback">JD</AvatarFallback>
        </Avatar>,
      );

      const fallback = screen.getByText("JD");
      expect(fallback).toHaveClass("custom-fallback");
    });

    it("renders text content", () => {
      render(
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("AB")).toBeInTheDocument();
    });

    it("renders icon content", () => {
      render(
        <Avatar>
          <AvatarFallback>
            <svg data-testid="user-icon" />
          </AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    });
  });

  describe("Composition", () => {
    it("renders with both image and fallback", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("renders image inside avatar container", () => {
      render(
        <Avatar data-testid="avatar">
          <AvatarImage src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      const avatar = screen.getByTestId("avatar");
      const image = screen.getByRole("img");

      expect(avatar).toContainElement(image);
    });

    it("renders fallback inside avatar container", () => {
      render(
        <Avatar data-testid="avatar">
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>,
      );

      const avatar = screen.getByTestId("avatar");
      const fallback = screen.getByText("JD");

      expect(avatar).toContainElement(fallback);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Avatar container", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Avatar ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to AvatarImage", () => {
      const ref = React.createRef<HTMLImageElement>();

      render(
        <Avatar>
          <AvatarImage ref={ref} src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      expect(ref.current).toBeInstanceOf(HTMLImageElement);
    });

    it("forwards ref to AvatarFallback", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Avatar>
          <AvatarFallback ref={ref}>JD</AvatarFallback>
        </Avatar>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Display Names", () => {
    it("Avatar has correct display name", () => {
      expect(Avatar.displayName).toBe("Avatar");
    });

    it("AvatarImage has correct display name", () => {
      expect(AvatarImage.displayName).toBe("AvatarImage");
    });

    it("AvatarFallback has correct display name", () => {
      expect(AvatarFallback.displayName).toBe("AvatarFallback");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute on Avatar", () => {
      const { container } = render(<Avatar id="my-avatar" />);

      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveAttribute("id", "my-avatar");
    });

    it("forwards data attributes to Avatar", () => {
      render(<Avatar data-testid="custom-avatar" data-custom="value" />);

      const avatar = screen.getByTestId("custom-avatar");
      expect(avatar).toHaveAttribute("data-custom", "value");
    });

    it("supports loading attribute on AvatarImage", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" loading="lazy" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("loading", "lazy");
    });

    it("supports srcSet on AvatarImage", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" srcSet="/avatar-2x.jpg 2x, /avatar-3x.jpg 3x" alt="User" />
        </Avatar>,
      );

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("srcSet");
    });
  });

  describe("Size Variants", () => {
    it("renders small avatar", () => {
      render(<Avatar className="h-8 w-8" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("h-8", "w-8");
    });

    it("renders medium avatar (default)", () => {
      render(<Avatar data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("h-10", "w-10");
    });

    it("renders large avatar", () => {
      render(<Avatar className="h-16 w-16" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("h-16", "w-16");
    });

    it("renders extra large avatar", () => {
      render(<Avatar className="h-24 w-24" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("h-24", "w-24");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user profile avatar with image", () => {
      render(
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src="/john-doe.jpg" alt="John Doe" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <h3>John Doe</h3>
            <p className="text-sm text-muted-foreground">john@example.com</p>
          </div>
        </div>,
      );

      expect(screen.getByRole("img", { name: "John Doe" })).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("renders avatar with initials fallback", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="Jane Smith" />
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("JS")).toBeInTheDocument();
    });

    it("renders avatar with icon fallback", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
          <AvatarFallback>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              data-testid="user-icon"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
            </svg>
          </AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    });

    it("renders comment author avatar", () => {
      render(
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/commenter.jpg" alt="Commenter" />
            <AvatarFallback>CA</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">Commenter Name</p>
            <p className="text-sm text-muted-foreground">Great article!</p>
          </div>
        </div>,
      );

      expect(screen.getByText("Commenter Name")).toBeInTheDocument();
      expect(screen.getByText("Great article!")).toBeInTheDocument();
    });

    it("renders avatar group", () => {
      render(
        <div className="flex -space-x-2">
          <Avatar className="border-2 border-background">
            <AvatarImage src="/user1.jpg" alt="User 1" />
            <AvatarFallback>U1</AvatarFallback>
          </Avatar>
          <Avatar className="border-2 border-background">
            <AvatarImage src="/user2.jpg" alt="User 2" />
            <AvatarFallback>U2</AvatarFallback>
          </Avatar>
          <Avatar className="border-2 border-background">
            <AvatarImage src="/user3.jpg" alt="User 3" />
            <AvatarFallback>U3</AvatarFallback>
          </Avatar>
        </div>,
      );

      expect(screen.getByRole("img", { name: "User 1" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "User 2" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "User 3" })).toBeInTheDocument();
    });

    it("renders navigation menu avatar", () => {
      render(
        <nav>
          <button className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/current-user.jpg" alt="Current User" />
              <AvatarFallback>CU</AvatarFallback>
            </Avatar>
            <span>Account</span>
          </button>
        </nav>,
      );

      expect(screen.getByText("Account")).toBeInTheDocument();
    });

    it("renders message list avatars", () => {
      render(
        <div className="space-y-4">
          <div className="flex gap-3">
            <Avatar>
              <AvatarImage src="/sender1.jpg" alt="Sender 1" />
              <AvatarFallback>S1</AvatarFallback>
            </Avatar>
            <div>Message 1</div>
          </div>
          <div className="flex gap-3">
            <Avatar>
              <AvatarImage src="/sender2.jpg" alt="Sender 2" />
              <AvatarFallback>S2</AvatarFallback>
            </Avatar>
            <div>Message 2</div>
          </div>
        </div>,
      );

      expect(screen.getByText("Message 1")).toBeInTheDocument();
      expect(screen.getByText("Message 2")).toBeInTheDocument();
    });
  });

  describe("Styling Variations", () => {
    it("renders with custom background color on fallback", () => {
      render(
        <Avatar>
          <AvatarFallback className="bg-blue-500 text-white" data-testid="fallback">
            AB
          </AvatarFallback>
        </Avatar>,
      );

      const fallback = screen.getByTestId("fallback");
      expect(fallback).toHaveClass("bg-blue-500", "text-white");
    });

    it("renders with custom border", () => {
      render(<Avatar className="border-2 border-primary" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("border-2", "border-primary");
    });

    it("renders with shadow", () => {
      render(<Avatar className="shadow-lg" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("shadow-lg");
    });

    it("renders square avatar", () => {
      render(<Avatar className="rounded-md" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("rounded-md");
    });
  });

  describe("Accessibility", () => {
    it("image has alt text", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User avatar" />
        </Avatar>,
      );

      const image = screen.getByRole("img", { name: "User avatar" });
      expect(image).toBeInTheDocument();
    });

    it("supports aria-label on Avatar", () => {
      render(<Avatar aria-label="User profile picture" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveAttribute("aria-label", "User profile picture");
    });

    it("fallback is accessible", () => {
      render(
        <Avatar>
          <AvatarFallback aria-label="User initials">JD</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("renders empty avatar", () => {
      const { container } = render(<Avatar />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders with only fallback", () => {
      render(
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>,
      );

      expect(screen.getByText("AB")).toBeInTheDocument();
    });

    it("renders with only image", () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.jpg" alt="User" />
        </Avatar>,
      );

      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("handles broken image src gracefully", () => {
      render(
        <Avatar>
          <AvatarImage src="/nonexistent.jpg" alt="User" />
          <AvatarFallback>FB</AvatarFallback>
        </Avatar>,
      );

      // Both should render, browser will handle image error
      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(screen.getByText("FB")).toBeInTheDocument();
    });

    it("maintains styling with custom className", () => {
      render(<Avatar className="custom-class" data-testid="avatar" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("custom-class", "rounded-full", "overflow-hidden");
    });
  });
});
