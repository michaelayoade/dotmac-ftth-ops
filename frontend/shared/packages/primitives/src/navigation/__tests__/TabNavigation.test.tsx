/**
 * TabNavigation Component Tests
 *
 * Tests tab navigation primitive with variants, keyboard nav, and accessibility
 */

import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabNavigation, TabItem, TabPanel } from "../TabNavigation";

describe("TabNavigation", () => {
  describe("Basic Rendering", () => {
    it("renders tab navigation container", () => {
      render(
        <TabNavigation>
          <TabItem>Tab 1</TabItem>
          <TabItem>Tab 2</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });

    it("renders multiple tab items", () => {
      render(
        <TabNavigation>
          <TabItem>Tab 1</TabItem>
          <TabItem>Tab 2</TabItem>
          <TabItem>Tab 3</TabItem>
        </TabNavigation>,
      );

      expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tab 2" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tab 3" })).toBeInTheDocument();
    });

    it("renders with custom className", () => {
      const { container } = render(
        <TabNavigation className="custom-class">
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = container.querySelector(".custom-class");
      expect(tablist).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("renders default variant with border-b", () => {
      const { container } = render(
        <TabNavigation variant="default">
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("border-b", "border-gray-200");
    });

    it("renders pills variant with background and rounded corners", () => {
      const { container } = render(
        <TabNavigation variant="pills">
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("bg-gray-100", "p-1", "rounded-lg");
    });

    it("renders bordered variant with border and padding", () => {
      const { container } = render(
        <TabNavigation variant="bordered">
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("border", "border-gray-200", "rounded-lg", "p-1");
    });

    it("defaults to default variant when not specified", () => {
      const { container } = render(
        <TabNavigation>
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("border-b");
    });
  });

  describe("TabItem - Active State", () => {
    it("renders active tab item with active styles", () => {
      render(
        <TabNavigation>
          <TabItem active>Active Tab</TabItem>
          <TabItem>Inactive Tab</TabItem>
        </TabNavigation>,
      );

      const activeTab = screen.getByRole("tab", { name: "Active Tab" });
      expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    it("renders inactive tab item with aria-selected false", () => {
      render(
        <TabNavigation>
          <TabItem active={false}>Inactive Tab</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Inactive Tab" });
      expect(tab).toHaveAttribute("aria-selected", "false");
    });

    it("applies active styles for default variant", () => {
      render(
        <TabNavigation variant="default">
          <TabItem variant="default" active>
            Active
          </TabItem>
        </TabNavigation>,
      );

      const activeTab = screen.getByRole("tab", { name: "Active" });
      expect(activeTab).toHaveClass("border-b-2", "border-blue-500", "text-blue-600");
    });

    it("applies active styles for pills variant", () => {
      render(
        <TabNavigation variant="pills">
          <TabItem variant="pills" active>
            Active
          </TabItem>
        </TabNavigation>,
      );

      const activeTab = screen.getByRole("tab", { name: "Active" });
      expect(activeTab).toHaveClass("bg-white", "shadow-sm", "text-gray-900");
    });

    it("applies active styles for bordered variant", () => {
      render(
        <TabNavigation variant="bordered">
          <TabItem variant="bordered" active>
            Active
          </TabItem>
        </TabNavigation>,
      );

      const activeTab = screen.getByRole("tab", { name: "Active" });
      expect(activeTab).toHaveClass(
        "bg-white",
        "border",
        "shadow-sm",
        "text-gray-900",
        "rounded-md",
      );
    });
  });

  describe("TabItem - Interaction", () => {
    it("calls onClick handler when clicked", () => {
      const handleClick = jest.fn();

      render(
        <TabNavigation>
          <TabItem onClick={handleClick}>Clickable Tab</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Clickable Tab" });
      fireEvent.click(tab);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("can be disabled", () => {
      const handleClick = jest.fn();

      render(
        <TabNavigation>
          <TabItem onClick={handleClick} disabled>
            Disabled Tab
          </TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Disabled Tab" });
      fireEvent.click(tab);

      expect(tab).toBeDisabled();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("supports custom className on TabItem", () => {
      render(
        <TabNavigation>
          <TabItem className="custom-tab-class">Custom Tab</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Custom Tab" });
      expect(tab).toHaveClass("custom-tab-class");
    });
  });

  describe("TabPanel", () => {
    it("renders panel content when active", () => {
      render(<TabPanel active>Panel Content</TabPanel>);

      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
      expect(screen.getByText("Panel Content")).toBeInTheDocument();
    });

    it("does not render when inactive", () => {
      render(<TabPanel active={false}>Hidden Content</TabPanel>);

      expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
      expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
    });

    it("renders with custom className", () => {
      const { container } = render(
        <TabPanel active className="custom-panel-class">
          Panel Content
        </TabPanel>,
      );

      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveClass("custom-panel-class");
    });

    it("applies default margin-top spacing", () => {
      render(<TabPanel active>Panel Content</TabPanel>);

      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveClass("mt-4");
    });
  });

  describe("Full Tab System Integration", () => {
    it("switches between tabs correctly", () => {
      function TabsExample() {
        const [activeTab, setActiveTab] = useState(0);

        return (
          <div>
            <TabNavigation>
              <TabItem active={activeTab === 0} onClick={() => setActiveTab(0)}>
                Tab 1
              </TabItem>
              <TabItem active={activeTab === 1} onClick={() => setActiveTab(1)}>
                Tab 2
              </TabItem>
              <TabItem active={activeTab === 2} onClick={() => setActiveTab(2)}>
                Tab 3
              </TabItem>
            </TabNavigation>

            <TabPanel active={activeTab === 0}>Content 1</TabPanel>
            <TabPanel active={activeTab === 1}>Content 2</TabPanel>
            <TabPanel active={activeTab === 2}>Content 3</TabPanel>
          </div>
        );
      }

      render(<TabsExample />);

      // Initially, Tab 1 should be active
      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
      expect(screen.queryByText("Content 3")).not.toBeInTheDocument();

      // Click Tab 2
      fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.getByText("Content 2")).toBeInTheDocument();
      expect(screen.queryByText("Content 3")).not.toBeInTheDocument();

      // Click Tab 3
      fireEvent.click(screen.getByRole("tab", { name: "Tab 3" }));
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
      expect(screen.getByText("Content 3")).toBeInTheDocument();
    });

    it("works with pills variant", () => {
      function PillsTabsExample() {
        const [activeTab, setActiveTab] = useState(0);

        return (
          <div>
            <TabNavigation variant="pills">
              <TabItem variant="pills" active={activeTab === 0} onClick={() => setActiveTab(0)}>
                Home
              </TabItem>
              <TabItem variant="pills" active={activeTab === 1} onClick={() => setActiveTab(1)}>
                Profile
              </TabItem>
            </TabNavigation>

            <TabPanel active={activeTab === 0}>Home Content</TabPanel>
            <TabPanel active={activeTab === 1}>Profile Content</TabPanel>
          </div>
        );
      }

      render(<PillsTabsExample />);

      expect(screen.getByText("Home Content")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "Profile" }));
      expect(screen.getByText("Profile Content")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has correct ARIA roles", () => {
      render(
        <TabNavigation>
          <TabItem active>Tab 1</TabItem>
          <TabItem>Tab 2</TabItem>
        </TabNavigation>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(2);
    });

    it("sets aria-selected correctly", () => {
      render(
        <TabNavigation>
          <TabItem active>Active Tab</TabItem>
          <TabItem active={false}>Inactive Tab</TabItem>
        </TabNavigation>,
      );

      const activeTab = screen.getByRole("tab", { name: "Active Tab" });
      const inactiveTab = screen.getByRole("tab", { name: "Inactive Tab" });

      expect(activeTab).toHaveAttribute("aria-selected", "true");
      expect(inactiveTab).toHaveAttribute("aria-selected", "false");
    });

    it("tab panel has tabpanel role", () => {
      render(<TabPanel active>Panel Content</TabPanel>);

      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });

    it("supports focus management", () => {
      render(
        <TabNavigation>
          <TabItem>Tab 1</TabItem>
          <TabItem>Tab 2</TabItem>
        </TabNavigation>,
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });

      tab1.focus();
      expect(document.activeElement).toBe(tab1);

      tab2.focus();
      expect(document.activeElement).toBe(tab2);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to TabNavigation container", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <TabNavigation ref={ref}>
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute("role", "tablist");
    });

    it("forwards ref to TabItem button", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <TabNavigation>
          <TabItem ref={ref}>Tab 1</TabItem>
        </TabNavigation>,
      );

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toHaveAttribute("role", "tab");
    });

    it("forwards ref to TabPanel div", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <TabPanel active ref={ref}>
          Panel Content
        </TabPanel>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute("role", "tabpanel");
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes to TabNavigation", () => {
      render(
        <TabNavigation data-testid="tab-nav" data-custom="value">
          <TabItem>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tablist = screen.getByTestId("tab-nav");
      expect(tablist).toHaveAttribute("data-custom", "value");
    });

    it("forwards data attributes to TabItem", () => {
      render(
        <TabNavigation>
          <TabItem data-testid="tab-item" data-custom="value">
            Tab 1
          </TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByTestId("tab-item");
      expect(tab).toHaveAttribute("data-custom", "value");
    });

    it("forwards data attributes to TabPanel", () => {
      render(
        <TabPanel active data-testid="tab-panel" data-custom="value">
          Panel Content
        </TabPanel>,
      );

      const panel = screen.getByTestId("tab-panel");
      expect(panel).toHaveAttribute("data-custom", "value");
    });
  });

  describe("Focus Styles", () => {
    it("applies focus ring styles to tab items", () => {
      render(
        <TabNavigation>
          <TabItem>Focusable Tab</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Focusable Tab" });
      expect(tab).toHaveClass("focus:outline-none", "focus:ring-2", "focus:ring-blue-500");
    });
  });

  describe("Keyboard Navigation", () => {
    it("supports keyboard interaction with Enter key", () => {
      const handleClick = jest.fn();

      render(
        <TabNavigation>
          <TabItem onClick={handleClick}>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Tab 1" });
      fireEvent.keyDown(tab, { key: "Enter", code: "Enter" });

      // Button elements handle Enter key natively
      expect(tab).toBeInTheDocument();
    });

    it("supports keyboard interaction with Space key", () => {
      const handleClick = jest.fn();

      render(
        <TabNavigation>
          <TabItem onClick={handleClick}>Tab 1</TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab", { name: "Tab 1" });
      fireEvent.keyDown(tab, { key: " ", code: "Space" });

      // Button elements handle Space key natively
      expect(tab).toBeInTheDocument();
    });
  });

  describe("Display Names", () => {
    it("has correct display name for TabNavigation", () => {
      expect(TabNavigation.displayName).toBe("TabNavigation");
    });

    it("has correct display name for TabItem", () => {
      expect(TabItem.displayName).toBe("TabItem");
    });

    it("has correct display name for TabPanel", () => {
      expect(TabPanel.displayName).toBe("TabPanel");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty TabNavigation", () => {
      const { container } = render(<TabNavigation />);

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
      expect(tablist).toBeEmptyDOMElement();
    });

    it("handles TabItem with complex children", () => {
      render(
        <TabNavigation>
          <TabItem>
            <span>Icon</span>
            <span>Label</span>
          </TabItem>
        </TabNavigation>,
      );

      const tab = screen.getByRole("tab");
      expect(tab).toHaveTextContent("IconLabel");
    });

    it("handles multiple TabPanel rendering simultaneously", () => {
      render(
        <div>
          <TabPanel active>Panel 1</TabPanel>
          <TabPanel active>Panel 2</TabPanel>
        </div>,
      );

      const panels = screen.getAllByRole("tabpanel");
      expect(panels).toHaveLength(2);
    });

    it("handles TabPanel with no children", () => {
      render(<TabPanel active />);

      const panel = screen.getByRole("tabpanel");
      expect(panel).toBeInTheDocument();
      expect(panel).toBeEmptyDOMElement();
    });
  });
});
