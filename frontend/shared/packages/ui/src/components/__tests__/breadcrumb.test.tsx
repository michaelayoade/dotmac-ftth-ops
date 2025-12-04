/**
 * Breadcrumb Component Tests
 *
 * Tests shadcn/ui Breadcrumb navigation component
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Breadcrumb } from "../breadcrumb";

// Mock Next.js Link component
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe("Breadcrumb", () => {
  describe("Basic Rendering", () => {
    it("renders breadcrumb navigation", () => {
      render(<Breadcrumb items={[{ label: "Home" }]} />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("has aria-label='Breadcrumb'", () => {
      render(<Breadcrumb items={[{ label: "Home" }]} />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
    });

    it("renders as ordered list", () => {
      const { container } = render(<Breadcrumb items={[{ label: "Home" }]} />);

      const ol = container.querySelector("ol");
      expect(ol).toBeInTheDocument();
    });
  });

  describe("Single Item", () => {
    it("renders single breadcrumb item", () => {
      render(<Breadcrumb items={[{ label: "Home" }]} />);

      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("renders single item without link", () => {
      render(<Breadcrumb items={[{ label: "Current Page" }]} />);

      const item = screen.getByText("Current Page");
      expect(item.tagName).toBe("SPAN");
    });

    it("marks last item with aria-current='page'", () => {
      render(<Breadcrumb items={[{ label: "Page" }]} />);

      const item = screen.getByText("Page");
      expect(item).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Multiple Items", () => {
    it("renders multiple breadcrumb items", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "Category" },
          ]}
        />,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Products")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
    });

    it("renders links for items with href", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
          ]}
        />,
      );

      const homeLink = screen.getByText("Home");
      expect(homeLink.tagName).toBe("A");
      expect(homeLink).toHaveAttribute("href", "/");
    });

    it("renders last item as text without link", () => {
      render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Current" }]} />);

      const lastItem = screen.getByText("Current");
      expect(lastItem.tagName).toBe("SPAN");
    });

    it("renders separators between items", () => {
      const { container } = render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "Item" },
          ]}
        />,
      );

      // ChevronRight icons used as separators
      const separators = container.querySelectorAll('[aria-hidden="true"]');
      expect(separators.length).toBe(2); // Two separators for three items
    });

    it("does not render separator before first item", () => {
      render(<Breadcrumb items={[{ label: "First", href: "/" }, { label: "Second" }]} />);

      const firstItem = screen.getByText("First").closest("li");
      const separator = firstItem?.querySelector('[aria-hidden="true"]');
      expect(separator).not.toBeInTheDocument();
    });
  });

  describe("Current Page", () => {
    it("marks last item with aria-current='page'", () => {
      render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Current Page" }]} />);

      const currentPage = screen.getByText("Current Page");
      expect(currentPage).toHaveAttribute("aria-current", "page");
    });

    it("does not mark non-last items with aria-current", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "Current" },
          ]}
        />,
      );

      const homeLink = screen.getByText("Home");
      const productsLink = screen.getByText("Products");

      expect(homeLink).not.toHaveAttribute("aria-current");
      expect(productsLink).not.toHaveAttribute("aria-current");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders simple navigation breadcrumb", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Documentation", href: "/docs" },
            { label: "Getting Started" },
          ]}
        />,
      );

      expect(screen.getByText("Home")).toHaveAttribute("href", "/");
      expect(screen.getByText("Documentation")).toHaveAttribute("href", "/docs");
      expect(screen.getByText("Getting Started")).toHaveAttribute("aria-current", "page");
    });

    it("renders e-commerce breadcrumb", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Electronics", href: "/electronics" },
            { label: "Computers", href: "/electronics/computers" },
            { label: "Laptops" },
          ]}
        />,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Electronics")).toBeInTheDocument();
      expect(screen.getByText("Computers")).toBeInTheDocument();
      expect(screen.getByText("Laptops")).toBeInTheDocument();
    });

    it("renders dashboard breadcrumb", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Users", href: "/dashboard/users" },
            { label: "John Doe" },
          ]}
        />,
      );

      expect(screen.getByText("Dashboard")).toHaveAttribute("href", "/dashboard");
      expect(screen.getByText("Users")).toHaveAttribute("href", "/dashboard/users");
      expect(screen.getByText("John Doe")).toHaveAttribute("aria-current", "page");
    });

    it("renders file system breadcrumb", () => {
      render(
        <Breadcrumb
          items={[
            { label: "Root", href: "/" },
            { label: "Projects", href: "/projects" },
            { label: "MyApp", href: "/projects/myapp" },
            { label: "src", href: "/projects/myapp/src" },
            { label: "index.ts" },
          ]}
        />,
      );

      expect(screen.getByText("Root")).toBeInTheDocument();
      expect(screen.getByText("index.ts")).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Styling", () => {
    it("applies text styles to links", () => {
      render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Current" }]} />);

      const link = screen.getByRole("link", { name: "Home" });
      // Check that the link has styling classes
      expect(link.className).toContain("text-muted-foreground");
    });

    it("applies muted style to current page", () => {
      render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Current" }]} />);

      const current = screen.getByText("Current");
      expect(current).toHaveClass("text-muted-foreground");
    });
  });

  describe("Edge Cases", () => {
    it("renders empty array", () => {
      render(<Breadcrumb items={[]} />);

      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
    });

    it("handles item without href as text", () => {
      render(
        <Breadcrumb
          items={[{ label: "First", href: "/" }, { label: "Second" }, { label: "Third" }]}
        />,
      );

      // Second item has no href but is not last, so rendered as text
      const secondItem = screen.getByText("Second");
      expect(secondItem.tagName).toBe("SPAN");
      expect(secondItem).not.toHaveAttribute("href");
    });

    it("handles very long breadcrumb path", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        label: `Level ${i + 1}`,
        href: i < 9 ? `/level${i + 1}` : undefined,
      }));

      render(<Breadcrumb items={items} />);

      expect(screen.getByText("Level 1")).toBeInTheDocument();
      expect(screen.getByText("Level 10")).toBeInTheDocument();
    });

    it("handles special characters in labels", () => {
      render(
        <Breadcrumb
          items={[{ label: "Home & Garden", href: "/" }, { label: "Tools & Equipment" }]}
        />,
      );

      expect(screen.getByText("Home & Garden")).toBeInTheDocument();
      expect(screen.getByText("Tools & Equipment")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has semantic navigation landmark", () => {
      render(<Breadcrumb items={[{ label: "Home" }]} />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("uses ordered list for items", () => {
      const { container } = render(
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />,
      );

      const ol = container.querySelector("ol");
      expect(ol).toBeInTheDocument();
    });

    it("marks separators as decorative", () => {
      const { container } = render(
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />,
      );

      const separator = container.querySelector('[aria-hidden="true"]');
      expect(separator).toBeInTheDocument();
    });

    it("clearly identifies current page", () => {
      render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Current Page" }]} />);

      const current = screen.getByText("Current Page");
      expect(current).toHaveAttribute("aria-current", "page");
    });
  });
});
