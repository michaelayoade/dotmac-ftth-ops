/**
 * Select Component Tests
 *
 * Tests shadcn/ui Select component built on Radix UI
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "../select";

describe("Select", () => {
  const renderBasicSelect = () => {
    return render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
          <SelectItem value="option3">Option 3</SelectItem>
        </SelectContent>
      </Select>,
    );
  };

  describe("Basic Rendering", () => {
    it("renders select trigger", () => {
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeInTheDocument();
    });

    it("renders placeholder text", () => {
      renderBasicSelect();

      expect(screen.getByText("Select option")).toBeInTheDocument();
    });

    it("does not show content initially", () => {
      renderBasicSelect();

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("SelectTrigger", () => {
    it("renders as button element", () => {
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("type", "button");
    });

    it("applies base styles", () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveClass(
        "flex",
        "h-10",
        "w-full",
        "items-center",
        "justify-between",
        "rounded-md",
        "border",
        "border-input",
        "bg-background",
        "px-3",
        "py-2",
        "text-sm",
      );
    });

    it("supports custom className", () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveClass("custom-trigger");
    });

    it("renders chevron icon", () => {
      const { container } = renderBasicSelect();

      const icon = container.querySelector(".h-4.w-4.opacity-50");
      expect(icon).toBeInTheDocument();
    });

    it("can be disabled", () => {
      render(
        <Select>
          <SelectTrigger disabled>
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(
        <Select>
          <SelectTrigger disabled data-testid="trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-50");
    });
  });

  describe("SelectValue", () => {
    it("renders placeholder when no value selected", () => {
      renderBasicSelect();

      expect(screen.getByText("Select option")).toBeInTheDocument();
    });

    it("renders selected value", () => {
      render(
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">First Option</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("First Option")).toBeInTheDocument();
    });
  });

  describe("Opening and Closing", () => {
    it("opens content when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });
    });

    it("closes content when clicking outside", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("closes content when escape key is pressed", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("SelectItem", () => {
    it("renders select items", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
        expect(screen.getByText("Option 3")).toBeInTheDocument();
      });
    });

    it("applies base styles to items", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test" data-testid="item">
              Test
            </SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const item = screen.getByTestId("item");
        expect(item).toHaveClass(
          "relative",
          "flex",
          "w-full",
          "cursor-default",
          "select-none",
          "items-center",
          "rounded-sm",
          "py-1.5",
          "pl-8",
          "pr-2",
          "text-sm",
        );
      });
    });

    it("supports custom className on items", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test" className="custom-item">
              Test
            </SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Test")).toHaveClass("custom-item");
      });
    });

    it("can be disabled", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled" disabled>
              Disabled
            </SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const disabledItem = screen.getByText("Disabled");
        expect(disabledItem).toHaveAttribute("data-disabled");
      });
    });
  });

  describe("Selection", () => {
    it("selects item on click", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 1"));

      expect(onValueChange).toHaveBeenCalledWith("option1");
    });

    it("displays selected value in trigger", async () => {
      const user = userEvent.setup();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Selected Option</SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Selected Option")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Selected Option"));

      await waitFor(() => {
        expect(screen.getByText("Selected Option")).toBeInTheDocument();
      });
    });

    it("shows check indicator for selected item", async () => {
      const user = userEvent.setup();

      render(
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        // Check icon should be present for selected item
        const selectedItem = screen.getByText("Option 1").closest("[role='option']");
        expect(selectedItem).toHaveAttribute("data-state", "checked");
      });
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      const { rerender } = render(
        <Select value="option1" onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("Option 1")).toBeInTheDocument();

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 2"));
      expect(onValueChange).toHaveBeenCalledWith("option2");

      rerender(
        <Select value="option2" onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultValue", () => {
      render(
        <Select defaultValue="option2">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });
  });

  describe("SelectGroup and SelectLabel", () => {
    it("renders grouped items with labels", async () => {
      const user = userEvent.setup();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Fruits")).toBeInTheDocument();
        expect(screen.getByText("Vegetables")).toBeInTheDocument();
        expect(screen.getByText("Apple")).toBeInTheDocument();
        expect(screen.getByText("Carrot")).toBeInTheDocument();
      });
    });

    it("applies label styles", async () => {
      const user = userEvent.setup();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel data-testid="label">Group Label</SelectLabel>
              <SelectItem value="item">Item</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const label = screen.getByTestId("label");
        expect(label).toHaveClass("py-1.5", "pl-8", "pr-2", "text-sm", "font-semibold");
      });
    });
  });

  describe("SelectSeparator", () => {
    it("renders separator between groups", async () => {
      const user = userEvent.setup();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item1">Item 1</SelectItem>
            <SelectSeparator data-testid="separator" />
            <SelectItem value="item2">Item 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const separator = screen.getByTestId("separator");
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass("h-px", "bg-muted");
      });
    });
  });

  describe("Accessibility", () => {
    it("has correct ARIA attributes on trigger", () => {
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("updates aria-expanded when opened", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("is keyboard navigable", async () => {
      const user = userEvent.setup();
      renderBasicSelect();

      const trigger = screen.getByRole("combobox");
      trigger.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("supports aria-label on trigger", () => {
      render(
        <Select>
          <SelectTrigger aria-label="Choose option">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test">Test</SelectItem>
          </SelectContent>
        </Select>,
      );

      const trigger = screen.getByRole("combobox", { name: "Choose option" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to SelectTrigger", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <Select>
          <SelectTrigger ref={ref}>
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("forwards ref to SelectItem", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem ref={ref} value="test">
              Test
            </SelectItem>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
      });
    });
  });

  describe("Display Names", () => {
    it("SelectTrigger has correct display name", () => {
      expect(SelectTrigger.displayName).toBe("Trigger");
    });

    it("SelectLabel has correct display name", () => {
      expect(SelectLabel.displayName).toBe("Label");
    });

    it("SelectItem has correct display name", () => {
      expect(SelectItem.displayName).toBe("Item");
    });

    it("SelectSeparator has correct display name", () => {
      expect(SelectSeparator.displayName).toBe("Separator");
    });

    it("SelectScrollUpButton has correct display name", () => {
      expect(SelectScrollUpButton.displayName).toBe("ScrollUpButton");
    });

    it("SelectScrollDownButton has correct display name", () => {
      expect(SelectScrollDownButton.displayName).toBe("ScrollDownButton");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders country selector", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <label htmlFor="country">Country</label>
          <Select>
            <SelectTrigger id="country">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>,
      );

      expect(screen.getByText("Country")).toBeInTheDocument();
      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("United States")).toBeInTheDocument();
      });
    });

    it("renders form with select", async () => {
      const user = userEvent.setup();
      const handleSubmit = jest.fn((e) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <Select name="priority">
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole("button", { name: "Submit" }));
      expect(handleSubmit).toHaveBeenCalled();
    });

    it("renders multi-group select", async () => {
      const user = userEvent.setup();

      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>North America</SelectLabel>
              <SelectItem value="est">Eastern Time</SelectItem>
              <SelectItem value="cst">Central Time</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Europe</SelectLabel>
              <SelectItem value="gmt">GMT</SelectItem>
              <SelectItem value="cet">CET</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("North America")).toBeInTheDocument();
        expect(screen.getByText("Europe")).toBeInTheDocument();
      });
    });
  });
});
