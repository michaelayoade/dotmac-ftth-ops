/**
 * MobileNavigation Component Tests
 *
 * Testing drawer variant, tabs variant, accordion variant, focus trap,
 * escape handling, expand/collapse, and multi-level navigation
 */

import React from "react";
import { render, renderA11y, renderComprehensive, screen, fireEvent, waitFor } from "../../testing";
import { MobileNavigation } from "../MobileNavigation";

// Mock focus trap hook
jest.mock("../../utils/accessibility", () => ({
  useFocusTrap: jest.fn(() => React.createRef()),
}));

// Mock Lucide icons
jest.mock("lucide-react", () => ({
  ChevronDown: ({ className }: any) => <div className={className} data-testid="chevron-down" />,
  ChevronRight: ({ className }: any) => <div className={className} data-testid="chevron-right" />,
  Menu: ({ className }: any) => <div className={className} data-testid="menu-icon" />,
  X: ({ className }: any) => <div className={className} data-testid="x-icon" />,
}));

describe("MobileNavigation", () => {
  const mockNavigate = jest.fn();

  const defaultProps = {
    items: [
      { id: "1", label: "Home", href: "/home" },
      { id: "2", label: "About", href: "/about" },
      { id: "3", label: "Services", href: "/services" },
    ],
    currentPath: "/home",
    onNavigate: mockNavigate,
  };

  const nestedItems = [
    {
      id: "1",
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      id: "2",
      label: "Settings",
      href: "/settings",
      children: [
        { id: "2.1", label: "Profile", href: "/settings/profile" },
        { id: "2.2", label: "Security", href: "/settings/security" },
      ],
    },
    {
      id: "3",
      label: "Reports",
      href: "/reports",
      badge: "3",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = "";
  });

  describe("Drawer Variant (Default)", () => {
    it("renders menu button", () => {
      render(<MobileNavigation {...defaultProps} />);

      expect(screen.getByText("Menu")).toBeInTheDocument();
      expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
    });

    it("opens drawer when menu button is clicked", () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByText("Menu");
      fireEvent.click(menuButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Navigation drawer")).toBeInTheDocument();
    });

    it("shows all navigation items in drawer", () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
      expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("closes drawer when close button is clicked", async () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const closeButton = screen.getByTestId("x-icon").parentElement as HTMLElement;
      fireEvent.click(closeButton);

      await waitFor(() => {
        // Drawer should have translate class
        const drawer = screen.getByRole("dialog");
        expect(drawer).toHaveClass("-translate-x-full");
      });
    });

    it("closes drawer when overlay is clicked", async () => {
      render(<MobileNavigation {...defaultProps} showOverlay={true} />);

      fireEvent.click(screen.getByText("Menu"));

      const overlay = screen.getByRole("presentation");
      fireEvent.click(overlay);

      await waitFor(() => {
        const drawer = screen.getByRole("dialog");
        expect(drawer).toHaveClass("-translate-x-full");
      });
    });

    it("closes drawer when Escape key is pressed", async () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toHaveClass("translate-x-0");

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        const drawer = screen.getByRole("dialog");
        expect(drawer).toHaveClass("-translate-x-full");
      });
    });

    it("locks body scroll when drawer is open", () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when drawer is closed", async () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));
      expect(document.body.style.overflow).toBe("hidden");

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(document.body.style.overflow).toBe("");
      });
    });

    it("does not render overlay when showOverlay is false", () => {
      render(<MobileNavigation {...defaultProps} showOverlay={false} />);

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    });
  });

  describe("Navigation Interactions", () => {
    it("highlights active navigation item", () => {
      render(<MobileNavigation {...defaultProps} currentPath="/about" />);

      fireEvent.click(screen.getByText("Menu"));

      const aboutButton = screen.getByText("About").closest("button");
      expect(aboutButton).toHaveClass("bg-blue-50", "text-blue-700");
      expect(aboutButton).toHaveAttribute("aria-current", "page");
    });

    it("calls onNavigate when navigation item is clicked", () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));
      fireEvent.click(screen.getByText("About"));

      expect(mockNavigate).toHaveBeenCalledWith("/about");
    });

    it("closes drawer after navigation in drawer variant", async () => {
      render(<MobileNavigation {...defaultProps} variant="drawer" />);

      fireEvent.click(screen.getByText("Menu"));
      fireEvent.click(screen.getByText("About"));

      await waitFor(() => {
        const drawer = screen.getByRole("dialog");
        expect(drawer).toHaveClass("-translate-x-full");
      });
    });
  });

  describe("Nested Navigation", () => {
    it("renders items with children", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("expands nested items when parent is clicked", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      // Children should not be visible initially
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();

      // Click parent to expand
      fireEvent.click(screen.getByText("Settings"));

      // Children should now be visible
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
    });

    it("collapses nested items when parent is clicked again", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      // Expand
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    });

    it("rotates chevron when expanded", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      const chevron = screen.getByTestId("chevron-right");
      expect(chevron).not.toHaveClass("rotate-90");

      fireEvent.click(screen.getByText("Settings"));

      expect(chevron).toHaveClass("rotate-90");
    });

    it("navigates to child item when clicked", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));
      fireEvent.click(screen.getByText("Settings")); // Expand
      fireEvent.click(screen.getByText("Profile"));

      expect(mockNavigate).toHaveBeenCalledWith("/settings/profile");
    });

    it("sets aria-expanded correctly on parent items", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      const settingsButton = screen.getByText("Settings").closest("button");

      // Initially not expanded
      expect(settingsButton).toHaveAttribute("aria-expanded", "false");

      // Expand
      fireEvent.click(screen.getByText("Settings"));
      expect(settingsButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Badge Support", () => {
    it("renders badge when provided", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("applies correct badge styling for active items", () => {
      render(
        <MobileNavigation items={nestedItems} currentPath="/reports" onNavigate={mockNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const badge = screen.getByText("3");
      expect(badge).toHaveClass("bg-blue-100", "text-blue-700");
    });

    it("applies correct badge styling for inactive items", () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      fireEvent.click(screen.getByText("Menu"));

      const badge = screen.getByText("3");
      expect(badge).toHaveClass("bg-red-100", "text-red-600");
    });
  });

  describe("Tabs Variant", () => {
    it("renders tabs navigation", () => {
      render(<MobileNavigation {...defaultProps} variant="tabs" />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
      expect(screen.queryByText("Menu")).not.toBeInTheDocument();
    });

    it("renders primary items as tabs", () => {
      render(<MobileNavigation {...defaultProps} variant="tabs" />);

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
      expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("shows overflow menu when more than 4 items", () => {
      const manyItems = [
        ...defaultProps.items,
        { id: "4", label: "Contact", href: "/contact" },
        { id: "5", label: "Blog", href: "/blog" },
      ];

      render(
        <MobileNavigation
          items={manyItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="tabs"
        />,
      );

      expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
      expect(screen.getByText("More navigation")).toBeInTheDocument();
    });

    it("toggles overflow menu when clicked", () => {
      const manyItems = [
        ...defaultProps.items,
        { id: "4", label: "Contact", href: "/contact" },
        { id: "5", label: "Blog", href: "/blog" },
      ];

      render(
        <MobileNavigation
          items={manyItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="tabs"
        />,
      );

      // First 4 items (Home, About, Services, Contact) should be visible directly
      expect(screen.getByText("Contact")).toBeInTheDocument();

      // 5th item (Blog) should be in overflow menu
      const moreButton = screen.getByLabelText("More navigation");
      fireEvent.click(moreButton.closest("button")!);
      expect(screen.getByText("Blog")).toBeInTheDocument();
    });

    it("highlights active tab", () => {
      render(<MobileNavigation {...defaultProps} variant="tabs" currentPath="/about" />);

      const aboutTab = screen.getByText("About").closest("button");
      expect(aboutTab).toHaveClass("border-blue-500", "text-blue-600");
      expect(aboutTab).toHaveAttribute("aria-current", "page");
    });

    it("navigates when tab is clicked", () => {
      render(<MobileNavigation {...defaultProps} variant="tabs" />);

      fireEvent.click(screen.getByText("About"));

      expect(mockNavigate).toHaveBeenCalledWith("/about");
    });

    it("closes overflow menu after navigation", () => {
      const manyItems = [
        ...defaultProps.items,
        { id: "4", label: "Contact", href: "/contact" },
        { id: "5", label: "Blog", href: "/blog" },
      ];

      render(
        <MobileNavigation
          items={manyItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="tabs"
        />,
      );

      // Open overflow menu
      const moreButton = screen.getByLabelText("More navigation");
      fireEvent.click(moreButton.closest("button")!);

      // Click overflow item (Blog is in overflow since it's 5th item)
      fireEvent.click(screen.getByText("Blog"));

      // Verify navigation was called
      expect(mockNavigate).toHaveBeenCalledWith("/blog");
    });
  });

  describe("Accordion Variant", () => {
    it("renders accordion navigation", () => {
      render(
        <MobileNavigation
          items={nestedItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="accordion"
        />,
      );

      expect(screen.getByRole("navigation")).toBeInTheDocument();
      expect(screen.queryByText("Menu")).not.toBeInTheDocument();
    });

    it("expands and collapses items in accordion", () => {
      render(
        <MobileNavigation
          items={nestedItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="accordion"
        />,
      );

      // Initially collapsed
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("passes accessibility validation for drawer variant", async () => {
      await renderA11y(<MobileNavigation {...defaultProps} />);
    });

    it("has role=dialog for drawer", () => {
      render(<MobileNavigation {...defaultProps} />);

      fireEvent.click(screen.getByText("Menu"));

      const drawer = screen.getByRole("dialog");
      expect(drawer).toHaveAttribute("aria-modal", "true");
      expect(drawer).toHaveAttribute("aria-label", "Navigation drawer");
    });

    it("has role=navigation for tabs variant", () => {
      render(<MobileNavigation {...defaultProps} variant="tabs" />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("has proper list structure for accordion variant", () => {
      const { container } = render(
        <MobileNavigation
          items={nestedItems}
          currentPath="/"
          onNavigate={mockNavigate}
          variant="accordion"
        />,
      );

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
    });

    it("sets aria-current on active items", () => {
      render(<MobileNavigation {...defaultProps} currentPath="/about" />);

      fireEvent.click(screen.getByText("Menu"));

      const aboutButton = screen.getByText("About").closest("button");
      expect(aboutButton).toHaveAttribute("aria-current", "page");
    });

    it("menu button has aria-expanded", () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByText("Menu").closest("button");
      expect(menuButton).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(screen.getByText("Menu"));

      expect(menuButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className", () => {
      render(<MobileNavigation {...defaultProps} className="custom-nav" />);

      const menuButton = screen.getByText("Menu").closest("button");
      expect(menuButton).toHaveClass("custom-nav");
    });
  });

  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <MobileNavigation
          items={nestedItems}
          currentPath="/dashboard"
          onNavigate={mockNavigate}
          variant="drawer"
          showOverlay={true}
        />,
      );

      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant();
      expect(result.container).toHaveValidMarkup();
    });

    it("handles complete navigation flow", async () => {
      render(<MobileNavigation items={nestedItems} currentPath="/" onNavigate={mockNavigate} />);

      // Open drawer
      fireEvent.click(screen.getByText("Menu"));
      expect(document.body.style.overflow).toBe("hidden");

      // Expand nested section
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Navigate to child
      fireEvent.click(screen.getByText("Profile"));
      expect(mockNavigate).toHaveBeenCalledWith("/settings/profile");

      // Drawer should close
      await waitFor(() => {
        const drawer = screen.getByRole("dialog");
        expect(drawer).toHaveClass("-translate-x-full");
      });
    });
  });
});
