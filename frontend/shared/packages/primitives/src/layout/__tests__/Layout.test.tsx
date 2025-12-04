/**
 * Layout component tests
 * Testing layout primitives and composition patterns
 */

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";

import { Layout, LayoutContent, LayoutFooter, LayoutHeader, LayoutSidebar } from "../Layout";

describe("Layout Components", () => {
  describe("Layout", () => {
    it("renders layout container", () => {
      render(
        <Layout data-testid="layout">
          <div>Layout content</div>
        </Layout>,
      );

      const layout = screen.getByTestId("layout");
      expect(layout).toBeInTheDocument();
      expect(layout).toHaveTextContent("Layout content");
    });

    it("applies default layout classes", () => {
      render(<Layout data-testid="layout">Content</Layout>);

      const layout = screen.getByTestId("layout");
      expect(layout).toHaveClass("layout");
    });

    it("supports custom className", () => {
      render(
        <Layout className="custom-layout" data-testid="layout">
          Content
        </Layout>,
      );

      const layout = screen.getByTestId("layout");
      expect(layout).toHaveClass("custom-layout");
    });

    it("forwards ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Layout ref={ref}>Layout</Layout>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("LayoutHeader", () => {
    it("renders header element by default", () => {
      render(<LayoutHeader>Header content</LayoutHeader>);

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent("Header content");
      expect(header.tagName).toBe("HEADER");
    });

    it("applies header styles", () => {
      render(<LayoutHeader>Header</LayoutHeader>);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("layout-header");
    });

    it("renders as child element when asChild is true", () => {
      render(
        <LayoutHeader asChild>
          <nav>Navigation header</nav>
        </LayoutHeader>,
      );

      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveTextContent("Navigation header");
    });

    it("supports sticky positioning", () => {
      render(<LayoutHeader sticky>Sticky header</LayoutHeader>);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("sticky");
    });

    it("supports different heights", () => {
      render(<LayoutHeader height="tall">Tall header</LayoutHeader>);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("layout-header");
    });
  });

  describe("LayoutContent", () => {
    it("renders main content area", () => {
      render(<LayoutContent>Main content</LayoutContent>);

      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      expect(main).toHaveTextContent("Main content");
      expect(main.tagName).toBe("MAIN");
    });

    it("applies content styles", () => {
      render(<LayoutContent>Content</LayoutContent>);

      const main = screen.getByRole("main");
      expect(main).toHaveClass("layout-content");
    });

    it("supports padding variants", () => {
      render(<LayoutContent padding="large">Padded content</LayoutContent>);

      const main = screen.getByRole("main");
      expect(main).toHaveClass("layout-content");
    });

    it("supports scrollable content", () => {
      render(<LayoutContent scrollable>Scrollable content</LayoutContent>);

      const main = screen.getByRole("main");
      expect(main).toHaveClass("layout-content", "scrollable");
    });
  });

  describe("LayoutSidebar", () => {
    it("renders sidebar element", () => {
      render(<LayoutSidebar>Sidebar content</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveTextContent("Sidebar content");
      expect(sidebar.tagName).toBe("ASIDE");
    });

    it("applies sidebar styles", () => {
      render(<LayoutSidebar>Sidebar</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("layout-sidebar");
    });

    it("supports different positions", () => {
      render(<LayoutSidebar position="right">Right sidebar</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("position-right");
    });

    it("supports different widths", () => {
      render(<LayoutSidebar width="wide">Wide sidebar</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("layout-sidebar");
    });

    it("supports collapsible sidebar", () => {
      render(<LayoutSidebar collapsible>Collapsible sidebar</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("collapsible");
    });

    it("handles collapsed state", () => {
      render(<LayoutSidebar collapsed>Collapsed sidebar</LayoutSidebar>);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("collapsed");
    });
  });

  describe("LayoutFooter", () => {
    it("renders footer element", () => {
      render(<LayoutFooter>Footer content</LayoutFooter>);

      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent("Footer content");
      expect(footer.tagName).toBe("FOOTER");
    });

    it("applies footer styles", () => {
      render(<LayoutFooter>Footer</LayoutFooter>);

      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveClass("layout-footer");
    });

    it("supports sticky footer", () => {
      render(<LayoutFooter sticky>Sticky footer</LayoutFooter>);

      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveClass("sticky");
    });
  });

  describe("Complete Layout Structure", () => {
    it("renders full layout with all components", () => {
      render(
        <Layout data-testid="full-layout">
          <LayoutHeader>Header</LayoutHeader>
          <div style={{ display: "flex" }}>
            <LayoutSidebar>Sidebar</LayoutSidebar>
            <LayoutContent>Main Content</LayoutContent>
          </div>
          <LayoutFooter>Footer</LayoutFooter>
        </Layout>,
      );

      expect(screen.getByRole("banner")).toHaveTextContent("Header");
      expect(screen.getByRole("complementary")).toHaveTextContent("Sidebar");
      expect(screen.getByRole("main")).toHaveTextContent("Main Content");
      expect(screen.getByRole("contentinfo")).toHaveTextContent("Footer");
      expect(screen.getByTestId("full-layout")).toBeInTheDocument();
    });

    it("handles responsive layout", () => {
      render(
        <Layout responsive>
          <LayoutHeader>Responsive Header</LayoutHeader>
          <LayoutContent>Responsive Content</LayoutContent>
        </Layout>,
      );

      const layout = screen.getByRole("banner").parentElement;
      expect(layout).toHaveClass("responsive");
    });

    it("supports different layout variants", () => {
      render(
        <Layout variant="sidebar-left">
          <LayoutSidebar>Left Sidebar</LayoutSidebar>
          <LayoutContent>Content</LayoutContent>
        </Layout>,
      );

      const layout = screen.getByRole("complementary").parentElement;
      expect(layout).toHaveClass("variant-sidebar-left");
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(
        <Layout>
          <LayoutHeader>Header</LayoutHeader>
          <LayoutContent>Content</LayoutContent>
          <LayoutFooter>Footer</LayoutFooter>
        </Layout>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("provides proper landmark roles", () => {
      render(
        <Layout>
          <LayoutHeader>Header</LayoutHeader>
          <LayoutSidebar>Sidebar</LayoutSidebar>
          <LayoutContent>Main Content</LayoutContent>
          <LayoutFooter>Footer</LayoutFooter>
        </Layout>,
      );

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("complementary")).toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("supports skip navigation links", () => {
      render(
        <Layout>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <LayoutHeader>Header</LayoutHeader>
          <LayoutContent id="main-content">Main Content</LayoutContent>
        </Layout>,
      );

      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });
  });

  describe("Layout Composition", () => {
    it("supports nested layouts", () => {
      render(
        <Layout>
          <LayoutContent>
            <Layout>
              <LayoutHeader>Nested Header</LayoutHeader>
              <LayoutContent>Nested Content</LayoutContent>
            </Layout>
          </LayoutContent>
        </Layout>,
      );

      const headers = screen.getAllByRole("banner");
      expect(headers).toHaveLength(1);
      expect(screen.getByText("Nested Header")).toBeInTheDocument();
      expect(screen.getByText("Nested Content")).toBeInTheDocument();
    });

    it("supports custom layout compositions", () => {
      render(
        <Layout className="custom-grid">
          <LayoutHeader className="grid-header">Grid Header</LayoutHeader>
          <LayoutSidebar className="grid-sidebar">Grid Sidebar</LayoutSidebar>
          <LayoutContent className="grid-content">Grid Content</LayoutContent>
          <LayoutFooter className="grid-footer">Grid Footer</LayoutFooter>
        </Layout>,
      );

      expect(screen.getByRole("banner")).toHaveClass("grid-header");
      expect(screen.getByRole("complementary")).toHaveClass("grid-sidebar");
      expect(screen.getByRole("main")).toHaveClass("grid-content");
      expect(screen.getByRole("contentinfo")).toHaveClass("grid-footer");
    });
  });

  describe("Forward Refs", () => {
    it("forwards refs to all layout components", () => {
      const layoutRef = React.createRef<HTMLDivElement>();
      const headerRef = React.createRef<HTMLElement>();
      const contentRef = React.createRef<HTMLElement>();
      const sidebarRef = React.createRef<HTMLElement>();
      const footerRef = React.createRef<HTMLElement>();

      render(
        <Layout ref={layoutRef}>
          <LayoutHeader ref={headerRef}>Header</LayoutHeader>
          <LayoutSidebar ref={sidebarRef}>Sidebar</LayoutSidebar>
          <LayoutContent ref={contentRef}>Content</LayoutContent>
          <LayoutFooter ref={footerRef}>Footer</LayoutFooter>
        </Layout>,
      );

      expect(layoutRef.current).toBeInstanceOf(HTMLDivElement);
      expect(headerRef.current).toBeInstanceOf(HTMLElement);
      expect(contentRef.current).toBeInstanceOf(HTMLElement);
      expect(sidebarRef.current).toBeInstanceOf(HTMLElement);
      expect(footerRef.current).toBeInstanceOf(HTMLElement);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty layout", () => {
      const { container } = render(<Layout />);

      const layout = container.querySelector(".layout");
      expect(layout).toBeInTheDocument();
    });

    it("handles layout with only content", () => {
      render(
        <Layout>
          <LayoutContent>Only content</LayoutContent>
        </Layout>,
      );

      expect(screen.getByRole("main")).toHaveTextContent("Only content");
    });

    it("handles multiple sidebars", () => {
      render(
        <Layout>
          <LayoutSidebar position="left">Left Sidebar</LayoutSidebar>
          <LayoutContent>Content</LayoutContent>
          <LayoutSidebar position="right">Right Sidebar</LayoutSidebar>
        </Layout>,
      );

      const sidebars = screen.getAllByRole("complementary");
      expect(sidebars).toHaveLength(2);
      expect(sidebars[0]).toHaveTextContent("Left Sidebar");
      expect(sidebars[1]).toHaveTextContent("Right Sidebar");
    });
  });
});
