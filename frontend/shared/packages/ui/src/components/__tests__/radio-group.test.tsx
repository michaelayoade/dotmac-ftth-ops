/**
 * RadioGroup Component Tests
 *
 * Tests shadcn/ui RadioGroup component
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { RadioGroup, RadioGroupItem } from "../radio-group";

describe("RadioGroup", () => {
  describe("Basic Rendering", () => {
    it("renders radio group container", () => {
      const { container } = render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(
        <RadioGroup data-testid="radio-group">
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const group = screen.getByTestId("radio-group");
      expect(group.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(
        <RadioGroup data-testid="radio-group">
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const group = screen.getByTestId("radio-group");
      expect(group).toHaveClass("grid", "gap-2");
    });

    it("renders with custom className", () => {
      render(
        <RadioGroup className="custom-group" data-testid="radio-group">
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const group = screen.getByTestId("radio-group");
      expect(group).toHaveClass("custom-group");
    });
  });

  describe("RadioGroupItem", () => {
    it("renders radio input", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      expect(radio).toBeInTheDocument();
    });

    it("renders as input with type radio", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      expect(radio).toHaveAttribute("type", "radio");
    });

    it("applies base styles", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" data-testid="radio" />
        </RadioGroup>,
      );

      const radio = screen.getByTestId("radio");
      expect(radio).toHaveClass(
        "h-4",
        "w-4",
        "rounded-full",
        "border",
        "border-border",
        "text-sky-500",
        "focus:ring-sky-500",
      );
    });

    it("supports custom className", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" className="custom-radio" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      expect(radio).toHaveClass("custom-radio");
    });

    it("has value attribute", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test-value" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      expect(radio).toHaveAttribute("value", "test-value");
    });
  });

  describe("Multiple Items", () => {
    it("renders multiple radio items", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
          <RadioGroupItem value="option3" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
    });

    it("assigns same name to all radio items", () => {
      render(
        <RadioGroup name="test-group">
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio).toHaveAttribute("name", "test-group");
      });
    });

    it("uses default name when not provided", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        const nameAttribute = radio.getAttribute("name");
        expect(nameAttribute).toBeTruthy();
        expect(nameAttribute).toMatch(/^radio-group-/);
      });
    });
  });

  describe("Selection", () => {
    it("selects radio on click", async () => {
      const user = userEvent.setup();

      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);

      await user.click(radios[0]);

      expect(radios[0].checked).toBe(true);
    });

    it("deselects other radios when one is selected", async () => {
      const user = userEvent.setup();

      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];

      await user.click(radios[0]);
      expect(radios[0].checked).toBe(true);
      expect(radios[1].checked).toBe(false);

      await user.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it("calls onValueChange when selection changes", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(
        <RadioGroup onValueChange={handleChange}>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      await user.click(radios[0]);

      expect(handleChange).toHaveBeenCalledWith("option1");
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      const { rerender } = render(
        <RadioGroup value="option1" onValueChange={onValueChange}>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(true);
      expect(radios[1].checked).toBe(false);

      await user.click(radios[1]);
      expect(onValueChange).toHaveBeenCalledWith("option2");

      rerender(
        <RadioGroup value="option2" onValueChange={onValueChange}>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it("uses value prop when provided", () => {
      render(
        <RadioGroup value="option2">
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultValue", () => {
      render(
        <RadioGroup defaultValue="option2">
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it("allows changing selection when uncontrolled", async () => {
      const user = userEvent.setup();

      render(
        <RadioGroup defaultValue="option1">
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(true);

      await user.click(radios[1]);

      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe("Disabled State", () => {
    it("can disable individual radio item", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" disabled />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
    });

    it("does not allow selecting disabled item", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(
        <RadioGroup onValueChange={handleChange}>
          <RadioGroupItem value="option1" disabled />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      await user.click(radio);

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has role='radio' for each item", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(2);
    });

    it("supports aria-label on radio items", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" aria-label="First option" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio", { name: "First option" });
      expect(radio).toBeInTheDocument();
    });

    it("is focusable", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      radio.focus();

      expect(document.activeElement).toBe(radio);
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();

      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      radios[0].focus();

      await user.keyboard(" ");
      expect(radios[0].checked).toBe(true);

      radios[1].focus();
      await user.keyboard(" ");
      expect(radios[1].checked).toBe(true);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to RadioGroup container", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <RadioGroup ref={ref}>
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to RadioGroupItem", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(
        <RadioGroup>
          <RadioGroupItem ref={ref} value="option1" />
        </RadioGroup>,
      );

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe("radio");
    });
  });

  describe("Display Names", () => {
    it("RadioGroup has correct display name", () => {
      expect(RadioGroup.displayName).toBe("RadioGroup");
    });

    it("RadioGroupItem has correct display name", () => {
      expect(RadioGroupItem.displayName).toBe("RadioGroupItem");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" id="my-radio" />
        </RadioGroup>,
      );

      const radio = screen.getByRole("radio");
      expect(radio).toHaveAttribute("id", "my-radio");
    });

    it("forwards data attributes", () => {
      render(
        <RadioGroup data-testid="group" data-custom="value">
          <RadioGroupItem value="option1" data-testid="radio" data-item="value" />
        </RadioGroup>,
      );

      const group = screen.getByTestId("group");
      const radio = screen.getByTestId("radio");

      expect(group).toHaveAttribute("data-custom", "value");
      expect(radio).toHaveAttribute("data-item", "value");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders radio group with labels", () => {
      render(
        <RadioGroup>
          <div>
            <RadioGroupItem value="option1" id="opt1" />
            <label htmlFor="opt1">Option 1</label>
          </div>
          <div>
            <RadioGroupItem value="option2" id="opt2" />
            <label htmlFor="opt2">Option 2</label>
          </div>
        </RadioGroup>,
      );

      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getAllByRole("radio")).toHaveLength(2);
    });

    it("renders form with radio group", async () => {
      const user = userEvent.setup();
      const handleSubmit = jest.fn((e) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <RadioGroup name="size">
            <RadioGroupItem value="small" />
            <RadioGroupItem value="medium" />
            <RadioGroupItem value="large" />
          </RadioGroup>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole("button"));
      expect(handleSubmit).toHaveBeenCalled();
    });

    it("renders radio group with descriptions", () => {
      render(
        <RadioGroup>
          <div>
            <div>
              <RadioGroupItem value="free" id="free" />
              <label htmlFor="free">Free</label>
            </div>
            <p className="text-sm text-muted-foreground">Best for personal use</p>
          </div>
          <div>
            <div>
              <RadioGroupItem value="pro" id="pro" />
              <label htmlFor="pro">Pro</label>
            </div>
            <p className="text-sm text-muted-foreground">Best for teams</p>
          </div>
        </RadioGroup>,
      );

      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Best for personal use")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Best for teams")).toBeInTheDocument();
    });

    it("renders settings panel with radio groups", () => {
      render(
        <div className="space-y-4">
          <div>
            <h3>Theme</h3>
            <RadioGroup defaultValue="light">
              <RadioGroupItem value="light" id="light" />
              <label htmlFor="light">Light</label>
              <RadioGroupItem value="dark" id="dark" />
              <label htmlFor="dark">Dark</label>
            </RadioGroup>
          </div>
        </div>,
      );

      expect(screen.getByText("Theme")).toBeInTheDocument();
      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[0].checked).toBe(true);
    });

    it("renders disabled options", () => {
      render(
        <RadioGroup>
          <div>
            <RadioGroupItem value="available" id="available" />
            <label htmlFor="available">Available</label>
          </div>
          <div>
            <RadioGroupItem value="unavailable" id="unavailable" disabled />
            <label htmlFor="unavailable" className="opacity-50">
              Coming Soon
            </label>
          </div>
        </RadioGroup>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("handles no items gracefully", () => {
      const { container } = render(<RadioGroup />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("handles mixed children types", () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" />
          <span>Some text</span>
          <RadioGroupItem value="option2" />
        </RadioGroup>,
      );

      expect(screen.getAllByRole("radio")).toHaveLength(2);
      expect(screen.getByText("Some text")).toBeInTheDocument();
    });

    it("maintains selection when items are reordered", () => {
      const { rerender } = render(
        <RadioGroup value="option2">
          <RadioGroupItem value="option1" />
          <RadioGroupItem value="option2" />
          <RadioGroupItem value="option3" />
        </RadioGroup>,
      );

      let radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[1].checked).toBe(true);

      rerender(
        <RadioGroup value="option2">
          <RadioGroupItem value="option3" />
          <RadioGroupItem value="option2" />
          <RadioGroupItem value="option1" />
        </RadioGroup>,
      );

      radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios[1].checked).toBe(true);
    });
  });
});
