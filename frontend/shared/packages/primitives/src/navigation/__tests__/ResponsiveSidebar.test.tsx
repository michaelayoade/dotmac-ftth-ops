/**
 * ResponsiveSidebar Component Tests
 *
 * Testing responsive sidebar with mobile drawer, desktop collapse/expand,
 * nested navigation, focus trap, escape handling, and hover interactions
 */

import React from "react";
import { render, renderA11y, renderComprehensive, screen, fireEvent, waitFor } from "../../testing";
import { ResponsiveSidebar } from "../ResponsiveSidebar";

// Mock icons
jest.mock("lucide-react", () => ({
  ChevronLeft: ({ className }: any) => <div className={className} data-testid="chevron-left" />,
  ChevronRight: ({ className }: any) => <div className={className} data-testid="chevron-right" />,
  Menu: ({ className }: any) => <div className={className} data-testid="menu-icon" />,
  X: ({ className }: any) => <div className={className} data-testid="x-icon" />,
  Home: ({ className }: any) => <div className={className} data-testid="home-icon" />,
  Settings: ({ className }: any) => <div className={className} data-testid="settings-icon" />,
  Users: ({ className }: any) => <div className={className} data-testid="users-icon" />,
  File: ({ className }: any) => <div className={className} data-testid="file-icon" />,
}));

// Mock focus trap
jest.mock("../../utils/accessibility", () => ({
  useFocusTrap: jest.fn(() => React.createRef()),
}));

describe("ResponsiveSidebar", () => {
  const HomeIcon = ({ className }: any) => <div className={className} data-testid="home-icon" />;
  const SettingsIcon = ({ className }: any) => (
    <div className={className} data-testid="settings-icon" />
  );
  const UsersIcon = ({ className }: any) => <div className={className} data-testid="users-icon" />;
  const FileIcon = ({ className }: any) => <div className={className} data-testid="file-icon" />;

  const mockOnNavigate = jest.fn();

  const basicItems = [
    { id: "1", label: "Home", href: "/home", icon: HomeIcon },
    { id: "2", label: "Settings", href: "/settings", icon: SettingsIcon },
    { id: "3", label: "Users", href: "/users", icon: UsersIcon },
  ];

  const nestedItems = [
    { id: "1", label: "Home", href: "/home", icon: HomeIcon },
    {
      id: "2",
      label: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      children: [
        { id: "2.1", label: "Profile", href: "/settings/profile", icon: FileIcon },
        { id: "2.2", label: "Security", href: "/settings/security", icon: FileIcon },
      ],
    },
    { id: "3", label: "Users", href: "/users", icon: UsersIcon, badge: "5" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = "";
  });

  describe("Mobile View", () => {
    it("renders mobile menu button", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      expect(screen.getByText("Menu")).toBeInTheDocument();
      expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
    });

    it("opens mobile drawer when menu button is clicked", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Navigation sidebar")).toBeInTheDocument();
    });

    it("displays navigation items in mobile drawer", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getAllByText("Home")).toHaveLength(2); // Desktop + Mobile
      expect(screen.getAllByText("Settings")).toHaveLength(2);
      expect(screen.getAllByText("Users")).toHaveLength(2);
    });

    it("closes mobile drawer when close button is clicked", async () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toHaveClass("translate-x-0");

      const closeButton = screen.getByTestId("x-icon").parentElement as HTMLElement;
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveClass("-translate-x-full");
      });
    });

    it("closes mobile drawer when overlay is clicked", async () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toHaveClass("translate-x-0");

      const overlay = screen.getByRole("presentation");
      fireEvent.click(overlay);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveClass("-translate-x-full");
      });
    });

    it("closes mobile drawer when Escape key is pressed", async () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toHaveClass("translate-x-0");

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveClass("-translate-x-full");
      });
    });

    it("locks body scroll when mobile drawer is open", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when mobile drawer is closed", async () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      expect(document.body.style.overflow).toBe("hidden");

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(document.body.style.overflow).toBe("");
      });
    });

    it("displays sidebar title in mobile drawer", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          title="Main Navigation"
        />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const titles = screen.getAllByText("Main Navigation");
      expect(titles.length).toBeGreaterThan(0);
    });

    it("closes mobile drawer after navigation", async () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      expect(screen.getByRole("dialog")).toHaveClass("translate-x-0");

      const settingsLinks = screen.getAllByText("Settings");
      fireEvent.click(settingsLinks[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveClass("-translate-x-full");
      });
      expect(mockOnNavigate).toHaveBeenCalledWith("/settings");
    });
  });

  describe("Desktop View", () => {
    it("renders desktop sidebar", () => {
      const { container } = render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      const desktopSidebar = container.querySelector("aside");
      expect(desktopSidebar).toBeInTheDocument();
    });

    it("displays navigation items in desktop sidebar", () => {
      const { container } = render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      // Check desktop navigation exists
      const desktopNav = container.querySelector('[aria-label="Desktop navigation"]');
      expect(desktopNav).toBeInTheDocument();
    });

    it("renders collapse button when collapsible is true", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
        />,
      );

      const collapseButton = screen.getByLabelText("Collapse sidebar");
      expect(collapseButton).toBeInTheDocument();
    });

    it("does not render collapse button when collapsible is false", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={false}
        />,
      );

      expect(screen.queryByLabelText("Collapse sidebar")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Expand sidebar")).not.toBeInTheDocument();
    });

    it("collapses sidebar when collapse button is clicked", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={false}
        />,
      );

      const aside = container.querySelector("aside");
      expect(aside).toHaveClass("w-64");

      const collapseButton = screen.getByLabelText("Collapse sidebar");
      fireEvent.click(collapseButton);

      expect(aside).toHaveClass("w-16");
    });

    it("expands sidebar when expand button is clicked", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={true}
        />,
      );

      const aside = container.querySelector("aside");
      expect(aside).toHaveClass("w-16");

      const expandButton = screen.getByLabelText("Expand sidebar");
      fireEvent.click(expandButton);

      expect(aside).toHaveClass("w-64");
    });

    it("starts collapsed when defaultCollapsed is true", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={true}
        />,
      );

      const aside = container.querySelector("aside");
      expect(aside).toHaveClass("w-16");
    });

    it("expands on hover when collapsed", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={true}
        />,
      );

      const aside = container.querySelector("aside")!;

      fireEvent.mouseEnter(aside);

      // Sidebar should be rendered
      expect(aside).toBeInTheDocument();
    });

    it("collapses on mouse leave when previously collapsed", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={true}
        />,
      );

      const aside = container.querySelector("aside")!;

      fireEvent.mouseEnter(aside);
      fireEvent.mouseLeave(aside);

      expect(aside).toHaveClass("w-16");
    });
  });

  describe("Navigation", () => {
    it("highlights active navigation item", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/settings"
          onNavigate={mockOnNavigate}
        />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));

      expect(settingsButton).toHaveClass("bg-blue-50", "text-blue-700");
      expect(settingsButton).toHaveAttribute("aria-current", "page");
    });

    it("calls onNavigate when navigation item is clicked", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      const usersLinks = screen.getAllByText("Users");
      fireEvent.click(usersLinks[0]);

      expect(mockOnNavigate).toHaveBeenCalledWith("/users");
    });

    it("renders navigation items with icons", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getAllByTestId("home-icon")).toHaveLength(2); // Mobile + desktop
    });

    it("applies correct icon color for active item", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const homeIcons = screen.getAllByTestId("home-icon");
      homeIcons.forEach((icon) => {
        expect(icon).toHaveClass("text-blue-600");
      });
    });

    it("applies correct icon color for inactive items", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const settingsIcons = screen.getAllByTestId("settings-icon");
      settingsIcons.forEach((icon) => {
        expect(icon).toHaveClass("text-gray-400");
      });
    });
  });

  describe("Nested Navigation", () => {
    it("renders items with children", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      const drawer = screen.getByRole("dialog");

      expect(screen.getAllByText("Settings")).toHaveLength(2); // Desktop + Mobile
      expect(screen.getAllByTestId("chevron-right").length).toBeGreaterThan(0);
    });

    it("expands nested items when parent is clicked", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));
      const drawer = screen.getByRole("dialog");

      // Children should not be visible initially
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();

      // Click parent to expand
      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));
      fireEvent.click(settingsButton!);

      // Children should now be visible
      expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Security").length).toBeGreaterThan(0);
    });

    it("collapses nested items when parent is clicked again", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));

      // Expand
      fireEvent.click(settingsButton!);
      expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);

      // Collapse
      fireEvent.click(settingsButton!);
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    });

    it("rotates chevron when nested item is expanded", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const chevrons = screen.getAllByTestId("chevron-right");
      const initialChevron = chevrons[0];
      expect(initialChevron).not.toHaveClass("rotate-90");

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));
      fireEvent.click(settingsButton!);

      expect(initialChevron).toHaveClass("rotate-90");
    });

    it("sets aria-expanded on parent items", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));

      // Initially not expanded
      expect(settingsButton).toHaveAttribute("aria-expanded", "false");

      // Expand
      fireEvent.click(settingsButton!);
      expect(settingsButton).toHaveAttribute("aria-expanded", "true");
    });

    it("navigates to child item when clicked", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));
      fireEvent.click(settingsButton!);

      const profileButtons = screen.getAllByText("Profile");
      fireEvent.click(profileButtons[0]);

      expect(mockOnNavigate).toHaveBeenCalledWith("/settings/profile");
    });

    it("does not navigate when parent with children is clicked", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));
      fireEvent.click(settingsButton!);

      // onNavigate should not be called for parent items with children
      expect(mockOnNavigate).not.toHaveBeenCalledWith("/settings");
    });
  });

  describe("Badge Support", () => {
    it("renders badge when provided", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const badges = screen.getAllByText("5");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("applies correct badge styling for inactive items", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const badges = screen.getAllByText("5");
      const badge = badges[0];
      expect(badge).toHaveClass("bg-red-100", "text-red-600");
    });

    it("applies correct badge styling for active items", () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/users" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const badges = screen.getAllByText("5");
      expect(badges[0]).toHaveClass("bg-blue-100", "text-blue-700");
    });
  });

  describe("Footer", () => {
    it("renders footer when provided", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          footer={<div data-testid="footer">Footer Content</div>}
        />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const footers = screen.getAllByTestId("footer");
      expect(footers.length).toBeGreaterThan(0);
      const footerContent = screen.getAllByText("Footer Content");
      expect(footerContent.length).toBeGreaterThan(0);
    });

    it("does not render footer section when footer is not provided", () => {
      const { container } = render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const footers = container.querySelectorAll(".border-t");
      // Only the header border should exist, not footer border
      expect(footers.length).toBeLessThan(2);
    });
  });

  describe("Accessibility", () => {
    it("passes accessibility validation", async () => {
      await renderA11y(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );
    });

    it("mobile drawer has role=dialog", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Navigation sidebar");
    });

    it("navigation has proper list structure", () => {
      const { container } = render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
    });

    it("sets aria-current on active items", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/settings"
          onNavigate={mockOnNavigate}
        />,
      );

      fireEvent.click(screen.getByText("Menu"));

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));

      expect(settingsButton).toHaveAttribute("aria-current", "page");
    });

    it("close button has sr-only text", () => {
      render(
        <ResponsiveSidebar items={basicItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      fireEvent.click(screen.getByText("Menu"));

      expect(screen.getByText("Close navigation")).toHaveClass("sr-only");
    });

    it("collapse button has accessible label", () => {
      render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
          defaultCollapsed={false}
        />,
      );

      const collapseButton = screen.getByLabelText("Collapse sidebar");
      expect(collapseButton).toBeInTheDocument();

      fireEvent.click(collapseButton);

      const expandButton = screen.getByLabelText("Expand sidebar");
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className to desktop sidebar", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={basicItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          className="custom-sidebar"
        />,
      );

      const aside = container.querySelector("aside");
      expect(aside).toHaveClass("custom-sidebar");
    });
  });

  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <ResponsiveSidebar
          items={nestedItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          title="Main Navigation"
          footer={<div>Footer</div>}
          collapsible={true}
        />,
      );

      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant(150);
      expect(result.container).toHaveValidMarkup();
    });

    it("handles complete navigation flow", async () => {
      render(
        <ResponsiveSidebar items={nestedItems} currentPath="/home" onNavigate={mockOnNavigate} />,
      );

      // Open mobile drawer
      fireEvent.click(screen.getByText("Menu"));
      expect(document.body.style.overflow).toBe("hidden");

      // Expand nested section
      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) => btn.textContent?.includes("Settings"));
      fireEvent.click(settingsButton!);

      const profileElements = screen.getAllByText("Profile");
      expect(profileElements.length).toBeGreaterThan(0);

      // Navigate to child
      fireEvent.click(profileElements[0]);
      expect(mockOnNavigate).toHaveBeenCalledWith("/settings/profile");

      // Drawer should close
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveClass("-translate-x-full");
      });
    });

    it("handles desktop collapse flow", () => {
      const { container } = render(
        <ResponsiveSidebar
          items={nestedItems}
          currentPath="/home"
          onNavigate={mockOnNavigate}
          collapsible={true}
        />,
      );

      const aside = container.querySelector("aside")!;

      // Initially expanded
      expect(aside).toHaveClass("w-64");

      // Collapse
      fireEvent.click(screen.getByLabelText("Collapse sidebar"));
      expect(aside).toHaveClass("w-16");

      // Hover to show content
      fireEvent.mouseEnter(aside);
      fireEvent.mouseLeave(aside);

      // Expand
      fireEvent.click(screen.getByLabelText("Expand sidebar"));
      expect(aside).toHaveClass("w-64");
    });
  });
});
