/**
 * Page Header Component Tests
 *
 * Tests PageHeader, PageHeader.Actions, PageHeader.Stat, and PageHeader.Breadcrumb components
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, Plus, Users, Activity } from "lucide-react";
import React from "react";

import { Button } from "../button";
import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  describe("Basic Rendering", () => {
    it("renders page header with title", () => {
      render(<PageHeader title="Dashboard" />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders with description", () => {
      render(<PageHeader title="Dashboard" description="Overview of your account" />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Overview of your account")).toBeInTheDocument();
    });

    it("renders without description", () => {
      render(<PageHeader title="Dashboard" />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders with icon", () => {
      const { container } = render(<PageHeader title="Settings" icon={Settings} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-primary");
    });

    it("renders without icon", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      const icon = container.querySelector("svg");
      expect(icon).not.toBeInTheDocument();
    });

    it("icon is aria-hidden", () => {
      const { container } = render(<PageHeader title="Settings" icon={Settings} />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Actions", () => {
    it("renders without actions", () => {
      render(<PageHeader title="Dashboard" />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders with actions", () => {
      render(
        <PageHeader
          title="Users"
          actions={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          }
        />,
      );

      expect(screen.getByText("Add User")).toBeInTheDocument();
    });

    it("renders multiple actions", () => {
      render(
        <PageHeader
          title="Users"
          actions={
            <>
              <Button variant="outline">Export</Button>
              <Button>Add User</Button>
            </>
          }
        />,
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("Add User")).toBeInTheDocument();
    });

    it("actions are clickable", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(<PageHeader title="Users" actions={<Button onClick={onClick}>Add User</Button>} />);

      await user.click(screen.getByText("Add User"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Children", () => {
    it("renders without children", () => {
      render(<PageHeader title="Dashboard" />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders custom children", () => {
      render(
        <PageHeader title="Dashboard">
          <div>Custom content below header</div>
        </PageHeader>,
      );

      expect(screen.getByText("Custom content below header")).toBeInTheDocument();
    });

    it("renders children below title and description", () => {
      render(
        <PageHeader title="Dashboard" description="Overview">
          <div>Additional content</div>
        </PageHeader>,
      );

      const content = screen.getByText("Additional content");
      expect(content).toBeInTheDocument();
    });
  });

  describe("Border", () => {
    it("does not show border by default", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      const header = container.firstChild;
      expect(header).not.toHaveClass("border-b");
    });

    it("shows border when showBorder is true", () => {
      const { container } = render(<PageHeader title="Dashboard" showBorder={true} />);

      const header = container.firstChild;
      expect(header).toHaveClass("border-b", "border-border");
    });

    it("adds padding when border shown", () => {
      const { container } = render(<PageHeader title="Dashboard" showBorder={true} />);

      const header = container.firstChild;
      expect(header).toHaveClass("pb-6");
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(<PageHeader title="Dashboard" className="custom-header" />);

      const header = container.firstChild;
      expect(header).toHaveClass("custom-header");
    });

    it("title has correct styling", () => {
      render(<PageHeader title="Dashboard" />);

      const title = screen.getByText("Dashboard");
      expect(title).toHaveClass("text-3xl", "font-bold", "text-foreground");
    });

    it("title truncates long text", () => {
      render(<PageHeader title="Very Long Dashboard Title That Should Truncate" />);

      const title = screen.getByText("Very Long Dashboard Title That Should Truncate");
      expect(title).toHaveClass("truncate");
    });

    it("description has muted foreground", () => {
      render(<PageHeader title="Dashboard" description="Overview" />);

      const description = screen.getByText("Overview");
      expect(description).toHaveClass("text-muted-foreground");
    });

    it("has responsive layout", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      const layout = container.querySelector(".flex.flex-col.sm\\:flex-row");
      expect(layout).toBeInTheDocument();
    });

    it("icon has primary color", () => {
      const { container } = render(<PageHeader title="Settings" icon={Settings} />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-primary");
    });

    it("has margin bottom", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      const header = container.firstChild;
      expect(header).toHaveClass("mb-6");
    });
  });

  describe("Layout", () => {
    it("renders flex layout", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      const layout = container.querySelector(".flex");
      expect(layout).toBeInTheDocument();
    });

    it("actions are aligned to right on large screens", () => {
      const { container } = render(
        <PageHeader title="Users" actions={<Button>Add User</Button>} />,
      );

      const layout = container.querySelector(".sm\\:justify-between");
      expect(layout).toBeInTheDocument();
    });
  });
});

describe("PageHeader.Actions", () => {
  describe("Basic Rendering", () => {
    it("renders action wrapper", () => {
      render(
        <PageHeader.Actions>
          <Button>Action 1</Button>
          <Button>Action 2</Button>
        </PageHeader.Actions>,
      );

      expect(screen.getByText("Action 1")).toBeInTheDocument();
      expect(screen.getByText("Action 2")).toBeInTheDocument();
    });

    it("applies flex layout", () => {
      const { container } = render(
        <PageHeader.Actions>
          <Button>Action</Button>
        </PageHeader.Actions>,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("flex", "items-center", "gap-2");
    });

    it("allows wrapping on small screens", () => {
      const { container } = render(
        <PageHeader.Actions>
          <Button>Action</Button>
        </PageHeader.Actions>,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("flex-wrap");
    });

    it("applies custom className", () => {
      const { container } = render(
        <PageHeader.Actions className="custom-actions">
          <Button>Action</Button>
        </PageHeader.Actions>,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("custom-actions");
    });
  });

  describe("Integration with PageHeader", () => {
    it("works with PageHeader actions prop", () => {
      render(
        <PageHeader
          title="Users"
          actions={
            <PageHeader.Actions>
              <Button variant="outline">Export</Button>
              <Button>Add User</Button>
            </PageHeader.Actions>
          }
        />,
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("Add User")).toBeInTheDocument();
    });
  });
});

describe("PageHeader.Stat", () => {
  describe("Basic Rendering", () => {
    it("renders stat with label and value", () => {
      render(<PageHeader.Stat label="Total Users" value={42} />);

      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("renders string value", () => {
      render(<PageHeader.Stat label="Status" value="Active" />);

      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders number value", () => {
      render(<PageHeader.Stat label="Count" value={1234} />);

      expect(screen.getByText("1234")).toBeInTheDocument();
    });

    it("renders with icon", () => {
      const { container } = render(<PageHeader.Stat label="Users" value={42} icon={Users} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("renders without icon", () => {
      const { container } = render(<PageHeader.Stat label="Users" value={42} />);

      const icon = container.querySelector("svg");
      expect(icon).not.toBeInTheDocument();
    });

    it("icon is aria-hidden", () => {
      const { container } = render(<PageHeader.Stat label="Users" value={42} icon={Users} />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <PageHeader.Stat label="Users" value={42} className="custom-stat" />,
      );

      const stat = container.firstChild;
      expect(stat).toHaveClass("custom-stat");
    });

    it("has background accent", () => {
      const { container } = render(<PageHeader.Stat label="Users" value={42} />);

      const stat = container.firstChild;
      expect(stat).toHaveClass("bg-accent");
    });

    it("label has muted foreground", () => {
      render(<PageHeader.Stat label="Total Users" value={42} />);

      const label = screen.getByText("Total Users");
      expect(label).toHaveClass("text-muted-foreground");
    });

    it("value is semibold", () => {
      render(<PageHeader.Stat label="Users" value={42} />);

      const value = screen.getByText("42");
      expect(value).toHaveClass("font-semibold");
    });
  });

  describe("Integration with PageHeader", () => {
    it("renders stats in PageHeader children", () => {
      render(
        <PageHeader title="Dashboard">
          <div className="flex gap-4">
            <PageHeader.Stat label="Total Users" value={150} icon={Users} />
            <PageHeader.Stat label="Active" value={120} icon={Activity} />
          </div>
        </PageHeader>,
      );

      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
    });
  });
});

describe("PageHeader.Breadcrumb", () => {
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Users", href: "/users" },
    { label: "Profile" },
  ];

  describe("Basic Rendering", () => {
    it("renders breadcrumb navigation", () => {
      render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });

    it("has nav with aria-label", () => {
      const { container } = render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const nav = container.querySelector("nav");
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
    });

    it("renders links for items with href", () => {
      render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const homeLink = screen.getByText("Home");
      expect(homeLink.tagName).toBe("A");
      expect(homeLink).toHaveAttribute("href", "/");

      const usersLink = screen.getByText("Users");
      expect(usersLink.tagName).toBe("A");
      expect(usersLink).toHaveAttribute("href", "/users");
    });

    it("renders span for current page (no href)", () => {
      render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const profile = screen.getByText("Profile");
      expect(profile.tagName).toBe("SPAN");
      expect(profile).not.toHaveAttribute("href");
    });

    it("renders separators between items", () => {
      const { container } = render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      // Should have 2 separators for 3 items (between items)
      const slashSeparators = Array.from(separators).filter((el) => el.textContent === "/");
      expect(slashSeparators.length).toBeGreaterThan(0);
    });

    it("separators are aria-hidden", () => {
      const { container } = render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const separator = container.querySelector('.text-muted-foreground[aria-hidden="true"]');
      expect(separator).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <PageHeader.Breadcrumb items={breadcrumbItems} className="custom-breadcrumb" />,
      );

      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("custom-breadcrumb");
    });

    it("links have hover state", () => {
      render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const homeLink = screen.getByText("Home");
      expect(homeLink).toHaveClass("hover:text-foreground");
    });

    it("current page has font-medium", () => {
      render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const profile = screen.getByText("Profile");
      expect(profile).toHaveClass("font-medium");
    });

    it("has text-sm size", () => {
      const { container } = render(<PageHeader.Breadcrumb items={breadcrumbItems} />);

      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("text-sm");
    });
  });

  describe("Integration with PageHeader", () => {
    it("renders breadcrumb in PageHeader children", () => {
      render(
        <PageHeader title="User Profile">
          <PageHeader.Breadcrumb items={breadcrumbItems} />
        </PageHeader>,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("renders single item breadcrumb", () => {
      render(<PageHeader.Breadcrumb items={[{ label: "Home" }]} />);

      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("renders empty items array", () => {
      const { container } = render(<PageHeader.Breadcrumb items={[]} />);

      const nav = container.querySelector("nav");
      expect(nav).toBeInTheDocument();
    });
  });
});

describe("Real-World Usage Patterns", () => {
  it("renders complete dashboard header", () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Overview of your account activity"
        icon={Activity}
        showBorder={true}
      >
        <div className="flex gap-4 mt-4">
          <PageHeader.Stat label="Total Users" value={1250} icon={Users} />
          <PageHeader.Stat label="Active Sessions" value={42} icon={Activity} />
        </div>
      </PageHeader>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview of your account activity")).toBeInTheDocument();
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1250")).toBeInTheDocument();
  });

  it("renders users page header with actions", async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();

    render(
      <PageHeader
        title="Users"
        description="Manage user accounts"
        icon={Users}
        actions={
          <PageHeader.Actions>
            <Button variant="outline">Export</Button>
            <Button onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </PageHeader.Actions>
        }
      />,
    );

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Manage user accounts")).toBeInTheDocument();

    await user.click(screen.getByText("Add User"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("renders page with breadcrumbs and actions", () => {
    const breadcrumbs = [
      { label: "Home", href: "/" },
      { label: "Settings", href: "/settings" },
      { label: "Profile" },
    ];

    render(
      <PageHeader
        title="Profile Settings"
        icon={Settings}
        actions={
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </Button>
        }
      >
        <PageHeader.Breadcrumb items={breadcrumbs} />
      </PageHeader>,
    );

    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Advanced Settings")).toBeInTheDocument();
  });
});
