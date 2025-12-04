/**
 * Tabs Component Tests
 *
 * Tests shadcn/ui Tabs primitive with context-based system
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";

describe("Tabs", () => {
  describe("Basic Rendering", () => {
    it("renders tabs container", () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders all tab triggers", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tab 2" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tab 3" })).toBeInTheDocument();
    });

    it("renders tab content", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
    });
  });

  describe("TabsList", () => {
    it("renders as tab list role", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tabsList = screen.getByTestId("tabs-list");
      expect(tabsList).toHaveClass(
        "inline-flex",
        "h-10",
        "items-center",
        "justify-center",
        "rounded-md",
        "bg-muted",
        "p-1",
        "text-muted-foreground",
      );
    });

    it("supports custom className", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tabsList = screen.getByRole("tablist");
      expect(tabsList).toHaveClass("custom-tabs-list");
    });
  });

  describe("TabsTrigger", () => {
    it("renders as tab role", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const trigger = screen.getByRole("tab", { name: "Tab 1" });
      expect(trigger).toHaveClass(
        "inline-flex",
        "items-center",
        "justify-center",
        "whitespace-nowrap",
        "rounded-sm",
        "px-3",
        "py-1.5",
        "text-sm",
        "font-medium",
      );
    });

    it("applies active state styles when selected", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const activeTab = screen.getByRole("tab", { name: "Tab 1" });
      expect(activeTab).toHaveAttribute("data-state", "active");
    });

    it("applies inactive state styles when not selected", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const inactiveTab = screen.getByRole("tab", { name: "Tab 2" });
      expect(inactiveTab).toHaveAttribute("data-state", "inactive");
    });

    it("supports custom className", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger">
              Tab 1
            </TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const trigger = screen.getByRole("tab", { name: "Tab 1" });
      expect(trigger).toHaveClass("custom-trigger");
    });

    it("can be disabled", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Tab 2
            </TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const disabledTab = screen.getByRole("tab", { name: "Tab 2" });
      expect(disabledTab).toBeDisabled();
    });
  });

  describe("TabsContent", () => {
    it("renders as tabpanel role", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" data-testid="content">
            Content 1
          </TabsContent>
        </Tabs>,
      );

      const content = screen.getByTestId("content");
      expect(content).toHaveClass(
        "mt-2",
        "ring-offset-background",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      );
    });

    it("shows content for active tab", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 1")).toBeVisible();
    });

    it("hides content for inactive tab", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("supports custom className", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">
            Content 1
          </TabsContent>
        </Tabs>,
      );

      const content = screen.getByRole("tabpanel");
      expect(content).toHaveClass("custom-content");
    });
  });

  describe("Tab Switching", () => {
    it("switches to clicked tab", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 1")).toBeVisible();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Tab 2" }));

      expect(screen.getByText("Content 2")).toBeVisible();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });

    it("updates aria-selected when switching tabs", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });

      expect(tab1).toHaveAttribute("aria-selected", "true");
      expect(tab2).toHaveAttribute("aria-selected", "false");

      await user.click(tab2);

      expect(tab1).toHaveAttribute("aria-selected", "false");
      expect(tab2).toHaveAttribute("aria-selected", "true");
    });

    it("updates data-state when switching tabs", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });

      expect(tab1).toHaveAttribute("data-state", "active");
      expect(tab2).toHaveAttribute("data-state", "inactive");

      await user.click(tab2);

      expect(tab1).toHaveAttribute("data-state", "inactive");
      expect(tab2).toHaveAttribute("data-state", "active");
    });

    it("does not switch to disabled tab", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Tab 2
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      await user.click(screen.getByRole("tab", { name: "Tab 2" }));

      expect(screen.getByText("Content 1")).toBeVisible();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      const { rerender } = render(
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 1")).toBeVisible();

      await user.click(screen.getByRole("tab", { name: "Tab 2" }));

      expect(onValueChange).toHaveBeenCalledWith("tab2");

      rerender(
        <Tabs value="tab2" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 2")).toBeVisible();
    });

    it("calls onValueChange when tab is clicked", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <Tabs defaultValue="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      await user.click(screen.getByRole("tab", { name: "Tab 2" }));

      expect(onValueChange).toHaveBeenCalledWith("tab2");
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultValue", () => {
      render(
        <Tabs defaultValue="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Content 2")).toBeVisible();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });

    it("allows switching tabs when uncontrolled", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      await user.click(screen.getByRole("tab", { name: "Tab 2" }));

      expect(screen.getByText("Content 2")).toBeVisible();
    });
  });

  describe("Keyboard Navigation", () => {
    it("focuses first tab with Tab key", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      await user.tab();

      expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveFocus();
    });

    it.skip("navigates between tabs with arrow keys", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      const tab3 = screen.getByRole("tab", { name: "Tab 3" });

      tab1.focus();

      await user.keyboard("{ArrowRight}");
      expect(tab2).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(tab3).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      expect(tab2).toHaveFocus();
    });

    it.skip("wraps focus with arrow keys", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });

      tab2.focus();

      await user.keyboard("{ArrowRight}");
      expect(tab1).toHaveFocus();
    });

    it("activates focused tab with Enter", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      tab2.focus();

      await user.keyboard("{Enter}");

      expect(screen.getByText("Content 2")).toBeVisible();
    });

    it("activates focused tab with Space", async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      tab2.focus();

      await user.keyboard(" ");

      expect(screen.getByText("Content 2")).toBeVisible();
    });
  });

  describe("Accessibility", () => {
    it("has correct ARIA attributes", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      const tabList = screen.getByRole("tablist");
      const tab = screen.getByRole("tab", { name: "Tab 1" });
      const tabPanel = screen.getByRole("tabpanel");

      expect(tabList).toBeInTheDocument();
      expect(tab).toHaveAttribute("aria-selected", "true");
      expect(tabPanel).toBeInTheDocument();
    });

    it("links tabs and panels with aria-controls", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      const tab = screen.getByRole("tab", { name: "Tab 1" });
      const tabPanel = screen.getByRole("tabpanel");

      const controlsId = tab.getAttribute("aria-controls");
      expect(tabPanel).toHaveAttribute("id", controlsId);
    });

    it("sets aria-labelledby on tab panels", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>,
      );

      const tab = screen.getByRole("tab", { name: "Tab 1" });
      const tabPanel = screen.getByRole("tabpanel");

      const tabId = tab.getAttribute("id");
      expect(tabPanel).toHaveAttribute("aria-labelledby", tabId);
    });

    it("supports orientation attribute", () => {
      render(
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const tabList = screen.getByRole("tablist");
      expect(tabList).toHaveAttribute("aria-orientation", "vertical");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Tabs root", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Tabs ref={ref} defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to TabsList", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Tabs defaultValue="tab1">
          <TabsList ref={ref}>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to TabsTrigger", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger ref={ref} value="tab1">
              Tab 1
            </TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("forwards ref to TabsContent", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent ref={ref} value="tab1">
            Content 1
          </TabsContent>
        </Tabs>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Display Names", () => {
    it("Tabs has correct display name", () => {
      expect(Tabs.displayName).toBe("Tabs");
    });

    it("TabsList has correct display name", () => {
      expect(TabsList.displayName).toBe("TabsList");
    });

    it("TabsTrigger has correct display name", () => {
      expect(TabsTrigger.displayName).toBe("TabsTrigger");
    });

    it("TabsContent has correct display name", () => {
      expect(TabsContent.displayName).toBe("TabsContent");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders settings tabs", () => {
      render(
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <h2>General Settings</h2>
          </TabsContent>
          <TabsContent value="security">
            <h2>Security Settings</h2>
          </TabsContent>
          <TabsContent value="notifications">
            <h2>Notification Settings</h2>
          </TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("General Settings")).toBeVisible();
    });

    it("renders dashboard tabs", () => {
      render(
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div>Overview Dashboard</div>
          </TabsContent>
          <TabsContent value="analytics">
            <div>Analytics Dashboard</div>
          </TabsContent>
          <TabsContent value="reports">
            <div>Reports Dashboard</div>
          </TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Overview Dashboard")).toBeVisible();
    });

    it("renders code editor tabs", () => {
      render(
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            <div>Preview content</div>
          </TabsContent>
          <TabsContent value="code">
            <pre>Code content</pre>
          </TabsContent>
        </Tabs>,
      );

      expect(screen.getByText("Preview content")).toBeVisible();
    });

    it("renders tabs with disabled options", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Available</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Coming Soon
            </TabsTrigger>
          </TabsList>
        </Tabs>,
      );

      const disabledTab = screen.getByRole("tab", { name: "Coming Soon" });
      expect(disabledTab).toBeDisabled();
    });

    it("renders vertical tabs", () => {
      render(
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList className="flex-col">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      );

      const tabList = screen.getByRole("tablist");
      expect(tabList).toHaveAttribute("aria-orientation", "vertical");
    });
  });

  describe("Multiple Tabs Instances", () => {
    it("supports multiple independent tabs on same page", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Tabs defaultValue="tab1-a">
            <TabsList>
              <TabsTrigger value="tab1-a">Tab 1A</TabsTrigger>
              <TabsTrigger value="tab2-a">Tab 2A</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1-a">Content 1A</TabsContent>
            <TabsContent value="tab2-a">Content 2A</TabsContent>
          </Tabs>

          <Tabs defaultValue="tab1-b">
            <TabsList>
              <TabsTrigger value="tab1-b">Tab 1B</TabsTrigger>
              <TabsTrigger value="tab2-b">Tab 2B</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1-b">Content 1B</TabsContent>
            <TabsContent value="tab2-b">Content 2B</TabsContent>
          </Tabs>
        </div>,
      );

      expect(screen.getByText("Content 1A")).toBeVisible();
      expect(screen.getByText("Content 1B")).toBeVisible();

      await user.click(screen.getByRole("tab", { name: "Tab 2A" }));

      expect(screen.getByText("Content 2A")).toBeVisible();
      expect(screen.getByText("Content 1B")).toBeVisible();
    });
  });
});
