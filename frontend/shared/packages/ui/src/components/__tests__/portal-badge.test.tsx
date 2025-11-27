/**
 * Portal Badge Component Tests
 *
 * Tests all portal badge variants with different portal types
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import {
  PortalBadge,
  PortalBadgeCompact,
  PortalUserTypeBadge,
  PortalIndicatorDot,
} from "../portal-badge";

// Mock the usePortalTheme hook
const mockUsePortalTheme = jest.fn();
jest.mock("../../lib/design-system/portal-themes", () => ({
  usePortalTheme: () => mockUsePortalTheme(),
  portalMetadata: {
    platformAdmin: {
      name: "Platform Administration",
      shortName: "Platform Admin",
      description: "Manage the entire multi-tenant platform",
      icon: "🏢",
      userType: "DotMac Staff",
    },
    platformResellers: {
      name: "Partner Portal",
      shortName: "Partners",
      description: "Channel partner management and commissions",
      icon: "🤝",
      userType: "Channel Partner",
    },
    platformTenants: {
      name: "Tenant Portal",
      shortName: "Tenant",
      description: "Manage your ISP business relationship",
      icon: "🏬",
      userType: "ISP Owner",
    },
    ispAdmin: {
      name: "ISP Operations",
      shortName: "ISP Admin",
      description: "Full ISP operations and network management",
      icon: "📡",
      userType: "ISP Staff",
    },
    ispReseller: {
      name: "Sales Portal",
      shortName: "Sales",
      description: "Generate referrals and track commissions",
      icon: "💰",
      userType: "Sales Agent",
    },
    ispCustomer: {
      name: "Customer Portal",
      shortName: "My Account",
      description: "Manage your internet service",
      icon: "🏠",
      userType: "Customer",
    },
  },
}));

describe("PortalBadge", () => {
  beforeEach(() => {
    // Default mock theme for platformAdmin
    mockUsePortalTheme.mockReturnValue({
      currentPortal: "platformAdmin",
      theme: {
        portal: "platformAdmin",
        metadata: {
          name: "Platform Administration",
          shortName: "Platform Admin",
          description: "Manage the entire multi-tenant platform",
          icon: "🏢",
          userType: "DotMac Staff",
        },
        colors: {
          primary: {
            500: "#3b82f6",
          },
        },
        cssVars: {},
      },
      setPortal: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders portal badge", () => {
      render(<PortalBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
    });

    it("displays portal name by default", () => {
      render(<PortalBadge />);

      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
    });

    it("displays portal icon by default", () => {
      render(<PortalBadge />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
    });

    it("has correct aria-label", () => {
      render(<PortalBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Current portal: Platform Administration");
    });

    it("applies base styles", () => {
      render(<PortalBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass(
        "inline-flex",
        "items-center",
        "rounded-full",
        "font-medium",
        "transition-colors",
      );
    });

    it("applies portal-primary color classes", () => {
      render(<PortalBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass(
        "bg-portal-primary/10",
        "text-portal-primary",
        "border-portal-primary/20",
      );
    });
  });

  describe("Size Variants", () => {
    it("renders small size", () => {
      render(<PortalBadge size="sm" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-2", "py-0.5", "text-xs", "gap-1");
    });

    it("renders medium size (default)", () => {
      render(<PortalBadge size="md" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-3", "py-1", "text-sm", "gap-1.5");
    });

    it("renders large size", () => {
      render(<PortalBadge size="lg" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-4", "py-1.5", "text-base", "gap-2");
    });

    it("defaults to medium size when not specified", () => {
      render(<PortalBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-3", "py-1", "text-sm");
    });
  });

  describe("Icon Display", () => {
    it("shows icon when showIcon is true (default)", () => {
      render(<PortalBadge showIcon={true} />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
    });

    it("hides icon when showIcon is false", () => {
      render(<PortalBadge showIcon={false} />);

      expect(screen.queryByText("🏢")).not.toBeInTheDocument();
    });

    it("shows icon by default when showIcon prop is omitted", () => {
      render(<PortalBadge />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
    });
  });

  describe("Name Display", () => {
    it("displays full name when shortName is false (default)", () => {
      render(<PortalBadge shortName={false} />);

      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
      expect(screen.queryByText("Platform Admin")).not.toBeInTheDocument();
    });

    it("displays short name when shortName is true", () => {
      render(<PortalBadge shortName={true} />);

      expect(screen.getByText("Platform Admin")).toBeInTheDocument();
      expect(screen.queryByText("Platform Administration")).not.toBeInTheDocument();
    });

    it("displays full name by default when shortName prop is omitted", () => {
      render(<PortalBadge />);

      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      render(<PortalBadge className="custom-badge-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-badge-class");
    });

    it("merges custom className with base classes", () => {
      render(<PortalBadge className="custom-badge-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-badge-class", "inline-flex", "rounded-full");
    });
  });

  describe("Different Portal Types", () => {
    it("renders platformAdmin portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Platform Administration",
            shortName: "Platform Admin",
            icon: "🏢",
            userType: "DotMac Staff",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
      expect(screen.getByText("🏢")).toBeInTheDocument();
    });

    it("renders platformResellers portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Partner Portal",
            shortName: "Partners",
            icon: "🤝",
            userType: "Channel Partner",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("Partner Portal")).toBeInTheDocument();
      expect(screen.getByText("🤝")).toBeInTheDocument();
    });

    it("renders platformTenants portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Tenant Portal",
            shortName: "Tenant",
            icon: "🏬",
            userType: "ISP Owner",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("Tenant Portal")).toBeInTheDocument();
      expect(screen.getByText("🏬")).toBeInTheDocument();
    });

    it("renders ispAdmin portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "ISP Operations",
            shortName: "ISP Admin",
            icon: "📡",
            userType: "ISP Staff",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("ISP Operations")).toBeInTheDocument();
      expect(screen.getByText("📡")).toBeInTheDocument();
    });

    it("renders ispReseller portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Sales Portal",
            shortName: "Sales",
            icon: "💰",
            userType: "Sales Agent",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("Sales Portal")).toBeInTheDocument();
      expect(screen.getByText("💰")).toBeInTheDocument();
    });

    it("renders ispCustomer portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Customer Portal",
            shortName: "My Account",
            icon: "🏠",
            userType: "Customer",
          },
        },
      });

      render(<PortalBadge />);

      expect(screen.getByText("Customer Portal")).toBeInTheDocument();
      expect(screen.getByText("🏠")).toBeInTheDocument();
    });
  });

  describe("Combined Props", () => {
    it("renders with icon and short name", () => {
      render(<PortalBadge showIcon={true} shortName={true} />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
      expect(screen.getByText("Platform Admin")).toBeInTheDocument();
    });

    it("renders without icon and with full name", () => {
      render(<PortalBadge showIcon={false} shortName={false} />);

      expect(screen.queryByText("🏢")).not.toBeInTheDocument();
      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
    });

    it("renders small size with short name and no icon", () => {
      render(<PortalBadge size="sm" shortName={true} showIcon={false} />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-2", "py-0.5", "text-xs");
      expect(screen.getByText("Platform Admin")).toBeInTheDocument();
      expect(screen.queryByText("🏢")).not.toBeInTheDocument();
    });

    it("renders large size with icon and full name", () => {
      render(<PortalBadge size="lg" showIcon={true} shortName={false} />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("px-4", "py-1.5", "text-base");
      expect(screen.getByText("🏢")).toBeInTheDocument();
      expect(screen.getByText("Platform Administration")).toBeInTheDocument();
    });
  });
});

describe("PortalBadgeCompact", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        metadata: {
          name: "Platform Administration",
          shortName: "Platform Admin",
          icon: "🏢",
          userType: "DotMac Staff",
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders compact badge", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
    });

    it("displays only icon", () => {
      render(<PortalBadgeCompact />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
    });

    it("does not display portal name", () => {
      render(<PortalBadgeCompact />);

      expect(screen.queryByText("Platform Administration")).not.toBeInTheDocument();
      expect(screen.queryByText("Platform Admin")).not.toBeInTheDocument();
    });

    it("has correct aria-label", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Current portal: Platform Administration");
    });

    it("has title attribute with portal name", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("title", "Platform Administration");
    });

    it("applies fixed size styles", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("w-8", "h-8", "rounded-full", "text-lg");
    });

    it("applies portal-primary color classes", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass(
        "bg-portal-primary/10",
        "text-portal-primary",
        "border-portal-primary/20",
      );
    });

    it("centers content", () => {
      render(<PortalBadgeCompact />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("inline-flex", "items-center", "justify-center");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      render(<PortalBadgeCompact className="custom-compact-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-compact-class");
    });

    it("merges custom className with base classes", () => {
      render(<PortalBadgeCompact className="custom-compact-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-compact-class", "w-8", "h-8", "rounded-full");
    });
  });

  describe("Different Portal Types", () => {
    it("displays icon for platformResellers portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Partner Portal",
            icon: "🤝",
          },
        },
      });

      render(<PortalBadgeCompact />);

      expect(screen.getByText("🤝")).toBeInTheDocument();
    });

    it("displays icon for ispCustomer portal", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            name: "Customer Portal",
            icon: "🏠",
          },
        },
      });

      render(<PortalBadgeCompact />);

      expect(screen.getByText("🏠")).toBeInTheDocument();
    });
  });
});

describe("PortalUserTypeBadge", () => {
  beforeEach(() => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        metadata: {
          name: "Platform Administration",
          icon: "🏢",
          userType: "DotMac Staff",
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders user type badge", () => {
      render(<PortalUserTypeBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
    });

    it("displays user type", () => {
      render(<PortalUserTypeBadge />);

      expect(screen.getByText("DotMac Staff")).toBeInTheDocument();
    });

    it("displays portal icon", () => {
      render(<PortalUserTypeBadge />);

      expect(screen.getByText("🏢")).toBeInTheDocument();
    });

    it("has correct aria-label", () => {
      render(<PortalUserTypeBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "User type: DotMac Staff");
    });

    it("applies base styles", () => {
      render(<PortalUserTypeBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass(
        "inline-flex",
        "items-center",
        "px-2.5",
        "py-1",
        "rounded-md",
        "text-xs",
        "font-medium",
      );
    });

    it("applies muted color scheme", () => {
      render(<PortalUserTypeBadge />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("bg-muted", "text-muted-foreground", "border-border");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      render(<PortalUserTypeBadge className="custom-user-type-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-user-type-class");
    });

    it("merges custom className with base classes", () => {
      render(<PortalUserTypeBadge className="custom-user-type-class" />);

      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("custom-user-type-class", "inline-flex", "rounded-md");
    });
  });

  describe("Different Portal Types", () => {
    it("displays Channel Partner user type", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            icon: "🤝",
            userType: "Channel Partner",
          },
        },
      });

      render(<PortalUserTypeBadge />);

      expect(screen.getByText("Channel Partner")).toBeInTheDocument();
      expect(screen.getByText("🤝")).toBeInTheDocument();
    });

    it("displays ISP Owner user type", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            icon: "🏬",
            userType: "ISP Owner",
          },
        },
      });

      render(<PortalUserTypeBadge />);

      expect(screen.getByText("ISP Owner")).toBeInTheDocument();
      expect(screen.getByText("🏬")).toBeInTheDocument();
    });

    it("displays ISP Staff user type", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            icon: "📡",
            userType: "ISP Staff",
          },
        },
      });

      render(<PortalUserTypeBadge />);

      expect(screen.getByText("ISP Staff")).toBeInTheDocument();
      expect(screen.getByText("📡")).toBeInTheDocument();
    });

    it("displays Sales Agent user type", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            icon: "💰",
            userType: "Sales Agent",
          },
        },
      });

      render(<PortalUserTypeBadge />);

      expect(screen.getByText("Sales Agent")).toBeInTheDocument();
      expect(screen.getByText("💰")).toBeInTheDocument();
    });

    it("displays Customer user type", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          metadata: {
            icon: "🏠",
            userType: "Customer",
          },
        },
      });

      render(<PortalUserTypeBadge />);

      expect(screen.getByText("Customer")).toBeInTheDocument();
      expect(screen.getByText("🏠")).toBeInTheDocument();
    });
  });
});

describe("PortalIndicatorDot", () => {
  describe("Basic Rendering", () => {
    it("renders indicator dot", () => {
      const { container } = render(<PortalIndicatorDot />);

      const dot = container.querySelector("span");
      expect(dot).toBeInTheDocument();
    });

    it("applies base styles", () => {
      const { container } = render(<PortalIndicatorDot />);

      const dot = container.querySelector("span");
      expect(dot).toHaveClass("inline-block", "w-2", "h-2", "rounded-full", "bg-portal-primary");
    });

    it("has aria-hidden attribute", () => {
      const { container } = render(<PortalIndicatorDot />);

      const dot = container.querySelector("span");
      expect(dot).toHaveAttribute("aria-hidden", "true");
    });

    it("is a decorative element", () => {
      render(<PortalIndicatorDot />);

      // Should not be accessible by role since it's decorative
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(<PortalIndicatorDot className="custom-dot-class" />);

      const dot = container.querySelector("span");
      expect(dot).toHaveClass("custom-dot-class");
    });

    it("merges custom className with base classes", () => {
      const { container } = render(<PortalIndicatorDot className="custom-dot-class" />);

      const dot = container.querySelector("span");
      expect(dot).toHaveClass("custom-dot-class", "w-2", "h-2", "rounded-full");
    });

    it("allows overriding size with custom classes", () => {
      const { container } = render(<PortalIndicatorDot className="w-3 h-3" />);

      const dot = container.querySelector("span");
      expect(dot).toHaveClass("w-3", "h-3");
    });

    it("allows overriding color with custom classes", () => {
      const { container } = render(<PortalIndicatorDot className="bg-red-500" />);

      const dot = container.querySelector("span");
      expect(dot).toHaveClass("bg-red-500");
    });
  });
});

describe("Portal Badge Integration", () => {
  it("all badge variants can be rendered together", () => {
    mockUsePortalTheme.mockReturnValue({
      theme: {
        metadata: {
          name: "ISP Operations",
          shortName: "ISP Admin",
          icon: "📡",
          userType: "ISP Staff",
        },
      },
    });

    const { container } = render(
      <div>
        <PortalBadge />
        <PortalBadgeCompact />
        <PortalUserTypeBadge />
        <PortalIndicatorDot />
      </div>,
    );

    // Verify all components render
    expect(screen.getByText("ISP Operations")).toBeInTheDocument();
    expect(screen.getByText("ISP Staff")).toBeInTheDocument();
    expect(screen.getAllByText("📡")).toHaveLength(3); // Regular + Compact + UserType
    const dots = container.querySelectorAll(".w-2.h-2");
    expect(dots).toHaveLength(1);
  });
});
