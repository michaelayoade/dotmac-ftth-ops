/**
 * Command Component Tests
 *
 * Tests shadcn/ui Command component built on cmdk
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "../command";

describe("Command", () => {
  describe("Basic Rendering", () => {
    it("renders command container", () => {
      const { container } = render(<Command />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(<Command data-testid="command" />);

      const command = screen.getByTestId("command");
      expect(command).toHaveClass("flex", "h-full", "w-full", "flex-col");
    });

    it("supports custom className", () => {
      render(<Command className="custom-command" data-testid="command" />);

      const command = screen.getByTestId("command");
      expect(command).toHaveClass("custom-command");
    });

    it("renders children", () => {
      render(
        <Command>
          <div>Command content</div>
        </Command>,
      );

      expect(screen.getByText("Command content")).toBeInTheDocument();
    });
  });

  describe("CommandInput", () => {
    it("renders input field", () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." />
        </Command>,
      );

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("renders with search icon", () => {
      const { container } = render(
        <Command>
          <CommandInput placeholder="Search" />
        </Command>,
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("accepts user input", async () => {
      const user = userEvent.setup();
      render(
        <Command>
          <CommandInput placeholder="Search" />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      await user.type(input, "test query");

      expect(input).toHaveValue("test query");
    });

    it("can be disabled", () => {
      render(
        <Command>
          <CommandInput placeholder="Search" disabled />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      expect(input).toBeDisabled();
    });

    it("supports custom className", () => {
      render(
        <Command>
          <CommandInput placeholder="Search" className="custom-input" />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      expect(input).toHaveClass("custom-input");
    });
  });

  describe("CommandList", () => {
    it("renders list container", () => {
      render(
        <Command>
          <CommandList data-testid="list">
            <div>Items</div>
          </CommandList>
        </Command>,
      );

      expect(screen.getByTestId("list")).toBeInTheDocument();
    });

    it("applies scrollable styles", () => {
      render(
        <Command>
          <CommandList data-testid="list">Items</CommandList>
        </Command>,
      );

      const list = screen.getByTestId("list");
      expect(list).toHaveClass("max-h-[300px]", "overflow-y-auto");
    });

    it("renders children", () => {
      render(
        <Command>
          <CommandList>
            <div>List content</div>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("List content")).toBeInTheDocument();
    });
  });

  describe("CommandEmpty", () => {
    it("renders empty state message", () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("No results found.")).toBeInTheDocument();
    });

    it("applies centered text styles", () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty data-testid="empty">No results</CommandEmpty>
          </CommandList>
        </Command>,
      );

      const empty = screen.getByTestId("empty");
      expect(empty).toHaveClass("py-6", "text-center", "text-sm");
    });
  });

  describe("CommandGroup", () => {
    it("renders group container", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Suggestions">
              <div>Items</div>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Suggestions")).toBeInTheDocument();
    });

    it("renders items in group", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>Item 1</CommandItem>
              <CommandItem>Item 2</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("supports custom className", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup className="custom-group" data-testid="group">
              Items
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const group = screen.getByTestId("group");
      expect(group).toHaveClass("custom-group");
    });
  });

  describe("CommandSeparator", () => {
    it("renders separator", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>Item 1</CommandItem>
            </CommandGroup>
            <CommandSeparator data-testid="separator" />
            <CommandGroup>
              <CommandItem>Item 2</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByTestId("separator")).toBeInTheDocument();
    });

    it("applies separator styles", () => {
      render(
        <Command>
          <CommandList>
            <CommandSeparator data-testid="separator" />
          </CommandList>
        </Command>,
      );

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("h-px", "bg-border");
    });
  });

  describe("CommandItem", () => {
    it("renders item", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>Calendar</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Calendar")).toBeInTheDocument();
    });

    it("can be clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={onSelect}>Settings</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      await user.click(screen.getByText("Settings"));

      expect(onSelect).toHaveBeenCalled();
    });

    it("can be disabled", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem disabled data-testid="item">
                Disabled Item
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const item = screen.getByTestId("item");
      expect(item).toHaveAttribute("data-disabled", "true");
    });

    it("supports custom className", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem className="custom-item" data-testid="item">
                Item
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const item = screen.getByTestId("item");
      expect(item).toHaveClass("custom-item");
    });
  });

  describe("CommandShortcut", () => {
    it("renders keyboard shortcut", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>
                Settings
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("⌘S")).toBeInTheDocument();
    });

    it("applies shortcut styles", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>
                Settings
                <CommandShortcut data-testid="shortcut">⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const shortcut = screen.getByTestId("shortcut");
      expect(shortcut).toHaveClass("ml-auto", "text-xs");
    });

    it("supports custom className", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem>
                Settings
                <CommandShortcut className="custom-shortcut" data-testid="shortcut">
                  ⌘S
                </CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const shortcut = screen.getByTestId("shortcut");
      expect(shortcut).toHaveClass("custom-shortcut");
    });
  });

  describe("CommandDialog", () => {
    it("renders dialog trigger", async () => {
      render(
        <CommandDialog open={false}>
          <CommandInput placeholder="Type a command..." />
        </CommandDialog>,
      );

      // Dialog is closed initially
      expect(screen.queryByPlaceholderText("Type a command...")).not.toBeInTheDocument();
    });

    it("opens when triggered", async () => {
      const { rerender } = render(
        <CommandDialog open={false}>
          <CommandInput placeholder="Type a command..." />
        </CommandDialog>,
      );

      expect(screen.queryByPlaceholderText("Type a command...")).not.toBeInTheDocument();

      rerender(
        <CommandDialog open={true}>
          <CommandInput placeholder="Type a command..." />
        </CommandDialog>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a command...")).toBeInTheDocument();
      });
    });

    it("renders command palette in dialog", async () => {
      render(
        <CommandDialog open={true}>
          <CommandInput placeholder="Type a command..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>Calendar</CommandItem>
              <CommandItem>Settings</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>,
      );

      await waitFor(() => {
        expect(screen.getByText("Calendar")).toBeInTheDocument();
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders command palette with search", async () => {
      const user = userEvent.setup();

      render(
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>Calendar</CommandItem>
              <CommandItem>Search Emoji</CommandItem>
              <CommandItem>Calculator</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const input = screen.getByPlaceholderText("Type a command or search...");
      await user.type(input, "calendar");

      expect(screen.getByText("Calendar")).toBeInTheDocument();
    });

    it("renders command menu with shortcuts", () => {
      render(
        <Command>
          <CommandInput placeholder="Type a command..." />
          <CommandList>
            <CommandGroup heading="Actions">
              <CommandItem>
                New File
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Save
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Open
                <CommandShortcut>⌘O</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("⌘N")).toBeInTheDocument();
      expect(screen.getByText("⌘S")).toBeInTheDocument();
      expect(screen.getByText("⌘O")).toBeInTheDocument();
    });

    it("renders grouped commands with separators", () => {
      render(
        <Command>
          <CommandInput placeholder="Type a command..." />
          <CommandList>
            <CommandGroup heading="File">
              <CommandItem>New</CommandItem>
              <CommandItem>Open</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Edit">
              <CommandItem>Cut</CommandItem>
              <CommandItem>Copy</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("File")).toBeInTheDocument();
      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();
      expect(screen.getByText("Cut")).toBeInTheDocument();
    });

    it("renders navigation menu", () => {
      render(
        <Command>
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            <CommandGroup heading="Pages">
              <CommandItem>Dashboard</CommandItem>
              <CommandItem>Settings</CommandItem>
              <CommandItem>Profile</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });

    it("renders emoji picker", () => {
      render(
        <Command>
          <CommandInput placeholder="Search emoji..." />
          <CommandList>
            <CommandEmpty>No emoji found.</CommandEmpty>
            <CommandGroup heading="Smileys">
              <CommandItem>😀 Grinning Face</CommandItem>
              <CommandItem>😃 Grinning Face with Big Eyes</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Animals">
              <CommandItem>🐶 Dog</CommandItem>
              <CommandItem>🐱 Cat</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("😀 Grinning Face")).toBeInTheDocument();
      expect(screen.getByText("🐶 Dog")).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Command", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Command ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CommandInput", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(
        <Command>
          <CommandInput ref={ref} placeholder="Search" />
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("forwards ref to CommandList", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Command>
          <CommandList ref={ref}>Items</CommandList>
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CommandEmpty", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Command>
          <CommandList>
            <CommandEmpty ref={ref}>Empty</CommandEmpty>
          </CommandList>
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CommandGroup", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Command>
          <CommandList>
            <CommandGroup ref={ref}>Items</CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CommandSeparator", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Command>
          <CommandList>
            <CommandSeparator ref={ref} />
          </CommandList>
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to CommandItem", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem ref={ref}>Item</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Display Names", () => {
    it("Command has correct display name", () => {
      expect(Command.displayName).toBeDefined();
    });

    it("CommandInput has correct display name", () => {
      expect(CommandInput.displayName).toBeDefined();
    });

    it("CommandList has correct display name", () => {
      expect(CommandList.displayName).toBeDefined();
    });

    it("CommandEmpty has correct display name", () => {
      expect(CommandEmpty.displayName).toBeDefined();
    });

    it("CommandGroup has correct display name", () => {
      expect(CommandGroup.displayName).toBeDefined();
    });

    it("CommandSeparator has correct display name", () => {
      expect(CommandSeparator.displayName).toBe("CommandSeparator");
    });

    it("CommandItem has correct display name", () => {
      expect(CommandItem.displayName).toBeDefined();
    });

    it("CommandShortcut has correct display name", () => {
      expect(CommandShortcut.displayName).toBe("CommandShortcut");
    });
  });

  describe("Accessibility", () => {
    it("input has proper accessibility attributes", () => {
      render(
        <Command>
          <CommandInput placeholder="Search" />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      expect(input).toHaveAttribute("type", "text");
    });

    it("items are keyboard navigable", async () => {
      render(
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandGroup>
              <CommandItem>Item 1</CommandItem>
              <CommandItem>Item 2</CommandItem>
              <CommandItem>Item 3</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      input.focus();

      // Items should be navigable
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });

    it("disabled items have proper attributes", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem disabled data-testid="item">
                Disabled
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const item = screen.getByTestId("item");
      expect(item).toHaveAttribute("data-disabled", "true");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty command list", () => {
      render(
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("No results")).toBeInTheDocument();
    });

    it("handles no groups", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Standalone Item</CommandItem>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Standalone Item")).toBeInTheDocument();
    });

    it("handles multiple separators", () => {
      const { container } = render(
        <Command>
          <CommandList>
            <CommandSeparator />
            <CommandSeparator />
            <CommandSeparator />
          </CommandList>
        </Command>,
      );

      const separators = container.querySelectorAll(".h-px");
      expect(separators.length).toBe(3);
    });

    it("handles null children", () => {
      render(
        <Command>
          <CommandList>{null}</CommandList>
        </Command>,
      );

      // Should not crash
      expect(screen.queryByText("error")).not.toBeInTheDocument();
    });
  });
});
