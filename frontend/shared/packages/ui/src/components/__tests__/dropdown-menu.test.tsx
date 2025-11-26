/**
 * DropdownMenu Component Tests
 *
 * Tests shadcn/ui DropdownMenu component built on Radix UI
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "../dropdown-menu";

describe("DropdownMenu", () => {
  const renderBasicMenu = () => {
    return render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
          <DropdownMenuItem>Item 3</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
  };

  describe("Basic Rendering", () => {
    it("renders trigger button", () => {
      renderBasicMenu();

      expect(screen.getByText("Open Menu")).toBeInTheDocument();
    });

    it("does not show content initially", () => {
      renderBasicMenu();

      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
    });

    it("trigger is a button element", () => {
      renderBasicMenu();

      const trigger = screen.getByText("Open Menu");
      expect(trigger).toHaveAttribute("type", "button");
    });
  });

  describe("Opening and Closing", () => {
    it("opens menu when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });
    });

    it("closes menu when clicking outside", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));
      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });

    it("closes menu when escape key is pressed", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));
      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });

    it("closes menu when item is clicked", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));
      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Item 1"));

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });
  });

  describe("DropdownMenuItem", () => {
    it("renders menu items", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
        expect(screen.getByText("Item 2")).toBeInTheDocument();
        expect(screen.getByText("Item 3")).toBeInTheDocument();
      });
    });

    it("calls onSelect when item is clicked", async () => {
      const user = userEvent.setup();
      const handleSelect = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={handleSelect}>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Item")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Item"));

      expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it("can be disabled", async () => {
      const user = userEvent.setup();
      const handleSelect = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem disabled onSelect={handleSelect}>
              Disabled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Disabled")).toBeInTheDocument();
      });

      const disabledItem = screen.getByText("Disabled");
      expect(disabledItem).toHaveAttribute("data-disabled");

      await user.click(disabledItem);
      expect(handleSelect).not.toHaveBeenCalled();
    });

    it("supports inset prop for alignment", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset data-testid="inset-item">
              Inset Item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        const item = screen.getByTestId("inset-item");
        expect(item).toHaveClass("pl-8");
      });
    });
  });

  describe("DropdownMenuCheckboxItem", () => {
    it("renders checkbox items", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={false}>Option 1</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={true}>Option 2</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });
    });

    it("toggles checkbox state", async () => {
      const user = userEvent.setup();
      const handleCheckedChange = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={handleCheckedChange}>
              Option
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Option")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option"));

      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("shows check indicator when checked", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>Checked</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const checkedItem = screen.getByText("Checked").closest("[role='menuitemcheckbox']");
        expect(checkedItem).toHaveAttribute("data-state", "checked");
      });
    });
  });

  describe("DropdownMenuRadioGroup and RadioItem", () => {
    it("renders radio group with items", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });
    });

    it("selects radio item", async () => {
      const user = userEvent.setup();
      const handleValueChange = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1" onValueChange={handleValueChange}>
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 2"));

      expect(handleValueChange).toHaveBeenCalledWith("option2");
    });

    it("shows indicator for selected radio item", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Selected</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const selectedItem = screen.getByText("Selected").closest("[role='menuitemradio']");
        expect(selectedItem).toHaveAttribute("data-state", "checked");
      });
    });
  });

  describe("DropdownMenuLabel", () => {
    it("renders label", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Actions")).toBeInTheDocument();
      });
    });

    it("supports inset prop", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel inset data-testid="label">
              Label
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const label = screen.getByTestId("label");
        expect(label).toHaveClass("pl-8");
      });
    });
  });

  describe("DropdownMenuSeparator", () => {
    it("renders separator", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator data-testid="separator" />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const separator = screen.getByTestId("separator");
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass("h-px", "bg-muted");
      });
    });
  });

  describe("DropdownMenuShortcut", () => {
    it("renders keyboard shortcut", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Save
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("⌘S")).toBeInTheDocument();
      });
    });

    it("applies shortcut styling", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Copy
              <DropdownMenuShortcut data-testid="shortcut">⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const shortcut = screen.getByTestId("shortcut");
        expect(shortcut).toHaveClass("ml-auto", "text-xs", "opacity-60");
      });
    });
  });

  describe("DropdownMenuSub", () => {
    it("renders submenu", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item 1</DropdownMenuItem>
                <DropdownMenuItem>Sub Item 2</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("More Options")).toBeInTheDocument();
      });
    });

    it("opens submenu on hover", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("More")).toBeInTheDocument();
      });

      await user.hover(screen.getByText("More"));

      await waitFor(() => {
        expect(screen.getByText("Sub Item")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("trigger has correct aria attributes", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      const trigger = screen.getByText("Open Menu");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("menu content has role='menu'", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("menu items have role='menuitem'", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      await user.click(screen.getByText("Open Menu"));

      await waitFor(() => {
        const items = screen.getAllByRole("menuitem");
        expect(items).toHaveLength(3);
      });
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      renderBasicMenu();

      const trigger = screen.getByText("Open Menu");
      trigger.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });
  });

  describe("Display Names", () => {
    it("DropdownMenuSubTrigger has correct display name", () => {
      expect(DropdownMenuSubTrigger.displayName).toBe("SubTrigger");
    });

    it("DropdownMenuSubContent has correct display name", () => {
      expect(DropdownMenuSubContent.displayName).toBe("SubContent");
    });

    it("DropdownMenuContent has correct display name", () => {
      expect(DropdownMenuContent.displayName).toBe("Content");
    });

    it("DropdownMenuItem has correct display name", () => {
      expect(DropdownMenuItem.displayName).toBe("Item");
    });

    it("DropdownMenuCheckboxItem has correct display name", () => {
      expect(DropdownMenuCheckboxItem.displayName).toBe("CheckboxItem");
    });

    it("DropdownMenuRadioItem has correct display name", () => {
      expect(DropdownMenuRadioItem.displayName).toBe("RadioItem");
    });

    it("DropdownMenuLabel has correct display name", () => {
      expect(DropdownMenuLabel.displayName).toBe("Label");
    });

    it("DropdownMenuSeparator has correct display name", () => {
      expect(DropdownMenuSeparator.displayName).toBe("Separator");
    });

    it("DropdownMenuShortcut has correct display name", () => {
      expect(DropdownMenuShortcut.displayName).toBe("DropdownMenuShortcut");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user account menu", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Account</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Account"));

      await waitFor(() => {
        expect(screen.getByText("My Account")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.getByText("Settings")).toBeInTheDocument();
        expect(screen.getByText("Logout")).toBeInTheDocument();
      });
    });

    it("renders actions menu with shortcuts", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              New File
              <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Save
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Actions"));

      await waitFor(() => {
        expect(screen.getByText("⌘N")).toBeInTheDocument();
        expect(screen.getByText("⌘S")).toBeInTheDocument();
      });
    });

    it("renders menu with checkboxes", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>View</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>Show Sidebar</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={false}>Show Toolbar</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("View"));

      await waitFor(() => {
        expect(screen.getByText("Show Sidebar")).toBeInTheDocument();
        expect(screen.getByText("Show Toolbar")).toBeInTheDocument();
      });
    });

    it("renders menu with radio group", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="date">
              <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Sort"));

      await waitFor(() => {
        expect(screen.getByText("Date")).toBeInTheDocument();
        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Size")).toBeInTheDocument();
      });
    });
  });
});
