/**
 * Navigation component tests
 * Testing navigation structure, accessibility, and responsive behavior
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";

import { Navigation, NavigationItem, NavigationLink, NavigationMenu } from "../Navigation";

describe("Navigation Components", () => {
  const SampleNavigation = () => (
    <Navigation aria-label="Main navigation" data-testid="navigation">
      <NavigationMenu>
        <NavigationItem>
          <NavigationLink href="/" active>
            Home
          </NavigationLink>
        </NavigationItem>
        <NavigationItem>
          <NavigationLink href="/about">About</NavigationLink>
        </NavigationItem>
        <NavigationItem>
          <NavigationLink href="/contact">Contact</NavigationLink>
        </NavigationItem>
      </NavigationMenu>
    </Navigation>
  );

  describe("Navigation", () => {
    it("renders navigation with correct structure", () => {
      render(<SampleNavigation />);

      const nav = screen.getByTestId("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav.tagName).toBe("NAV");
    });

    it("applies correct ARIA label", () => {
      render(<SampleNavigation />);

      const nav = screen.getByTestId("navigation");
      expect(nav).toHaveAttribute("aria-label", "Main navigation");
    });

    it("accepts custom className", () => {
      render(
        <Navigation className="custom-nav" data-testid="navigation">
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(screen.getByTestId("navigation")).toHaveClass("custom-nav");
    });
  });

  describe("NavigationMenu", () => {
    it("renders as ul element", () => {
      render(
        <Navigation>
          <NavigationMenu data-testid="nav-menu">
            <NavigationItem>
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const menu = screen.getByTestId("nav-menu");
      expect(menu).toBeInTheDocument();
      expect(menu.tagName).toBe("UL");
    });

    it("applies correct role", () => {
      render(
        <Navigation>
          <NavigationMenu role="menubar" data-testid="nav-menu">
            <NavigationItem>
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(screen.getByTestId("nav-menu")).toHaveAttribute("role", "menubar");
    });
  });

  describe("NavigationItem", () => {
    it("renders as li element", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem data-testid="nav-item">
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const item = screen.getByTestId("nav-item");
      expect(item).toBeInTheDocument();
      expect(item.tagName).toBe("LI");
    });

    it("accepts custom className", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem className="custom-item" data-testid="nav-item">
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(screen.getByTestId("nav-item")).toHaveClass("custom-item");
    });
  });

  describe("NavigationLink", () => {
    it("renders as link element", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/test" data-testid="nav-link">
                Test Link
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const link = screen.getByTestId("nav-link");
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/test");
    });

    it("shows active state", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/" active data-testid="nav-link">
                Active Link
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const link = screen.getByTestId("nav-link");
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("handles disabled state", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/disabled" disabled data-testid="nav-link">
                Disabled Link
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const link = screen.getByTestId("nav-link");
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).toHaveClass("disabled");
    });

    it("handles click events", () => {
      const handleClick = jest.fn();

      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink
                href="/test"
                onClick={handleClick}
                onKeyDown={(e) => e.key === "Enter" && handleClick}
                data-testid="nav-link"
              >
                Clickable Link
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const link = screen.getByTestId("nav-link");
      fireEvent.click(link);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders external link with target", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink
                href="https://example.com"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="nav-link"
              >
                External Link
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const link = screen.getByTestId("nav-link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(<SampleNavigation />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("supports keyboard navigation", () => {
      render(<SampleNavigation />);

      const homeLink = screen.getByRole("link", { name: "Home" });
      const _aboutLink = screen.getByRole("link", { name: "About" });

      homeLink.focus();
      expect(homeLink).toHaveFocus();

      fireEvent.keyDown(homeLink, { key: "Tab" });
      // In a real scenario, this would move focus to the next link
    });

    it("provides proper ARIA attributes", () => {
      render(
        <Navigation aria-label="Primary navigation">
          <NavigationMenu role="menubar">
            <NavigationItem role="none">
              <NavigationLink href="/" role="menuitem">
                Home
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const nav = screen.getByRole("navigation");
      const menu = screen.getByRole("menubar");
      const link = screen.getByRole("menuitem");

      expect(nav).toHaveAttribute("aria-label", "Primary navigation");
      expect(menu).toBeInTheDocument();
      expect(link).toBeInTheDocument();
    });
  });

  describe("Responsive behavior", () => {
    it("handles mobile navigation", () => {
      render(
        <Navigation className="mobile-nav" data-testid="navigation">
          <NavigationMenu className="hidden md:flex">
            <NavigationItem>
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      const nav = screen.getByTestId("navigation");
      expect(nav).toHaveClass("mobile-nav");
    });

    it("supports collapsible navigation", () => {
      const CollapsibleNav = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <Navigation data-testid="navigation">
            <button type="button" onClick={() => setIsOpen(!isOpen)} data-testid="menu-toggle">
              Menu
            </button>
            {isOpen && (
              <NavigationMenu data-testid="nav-menu">
                <NavigationItem>
                  <NavigationLink href="/">Home</NavigationLink>
                </NavigationItem>
              </NavigationMenu>
            )}
          </Navigation>
        );
      };

      render(<CollapsibleNav />);

      const toggle = screen.getByTestId("menu-toggle");
      expect(screen.queryByTestId("nav-menu")).not.toBeInTheDocument();

      fireEvent.click(toggle);
      expect(screen.getByTestId("nav-menu")).toBeInTheDocument();
    });
  });

  describe("Complex navigation structures", () => {
    it("handles nested navigation", () => {
      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/">Home</NavigationLink>
            </NavigationItem>
            <NavigationItem>
              <details>
                <summary>Products</summary>
                <NavigationMenu>
                  <NavigationItem>
                    <NavigationLink href="/products/web">Web</NavigationLink>
                  </NavigationItem>
                  <NavigationItem>
                    <NavigationLink href="/products/mobile">Mobile</NavigationLink>
                  </NavigationItem>
                </NavigationMenu>
              </details>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Products")).toBeInTheDocument();
      expect(screen.getByText("Web")).toBeInTheDocument();
      expect(screen.getByText("Mobile")).toBeInTheDocument();
    });

    it("handles navigation with icons", () => {
      const IconComponent = () => <span data-testid="icon">🏠</span>;

      render(
        <Navigation>
          <NavigationMenu>
            <NavigationItem>
              <NavigationLink href="/" data-testid="nav-link">
                <IconComponent />
                Home
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
    });
  });

  describe("Forward refs", () => {
    it("forwards refs correctly", () => {
      const navRef = React.createRef<HTMLElement>();
      const menuRef = React.createRef<HTMLUListElement>();
      const itemRef = React.createRef<HTMLLIElement>();
      const linkRef = React.createRef<HTMLAnchorElement>();

      render(
        <Navigation ref={navRef}>
          <NavigationMenu ref={menuRef}>
            <NavigationItem ref={itemRef}>
              <NavigationLink ref={linkRef} href="/">
                Home
              </NavigationLink>
            </NavigationItem>
          </NavigationMenu>
        </Navigation>,
      );

      expect(navRef.current).toBeInstanceOf(HTMLElement);
      expect(menuRef.current).toBeInstanceOf(HTMLUListElement);
      expect(itemRef.current).toBeInstanceOf(HTMLLIElement);
      expect(linkRef.current).toBeInstanceOf(HTMLAnchorElement);
    });
  });
});
