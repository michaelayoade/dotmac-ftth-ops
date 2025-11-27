/**
 * Checkbox Component Tests
 *
 * Tests shadcn/ui Checkbox primitive
 */

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  describe("Basic Rendering", () => {
    it("renders checkbox input", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("renders as input element with type checkbox", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("type", "checkbox");
    });

    it("applies base styles", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("h-4", "w-4", "rounded", "border-border");
    });

    it("renders with custom className", () => {
      render(<Checkbox className="custom-class" />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("custom-class");
    });
  });

  describe("User Interaction", () => {
    it("can be checked", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(checkbox.checked).toBe(true);
    });

    it("can be unchecked", () => {
      render(<Checkbox defaultChecked />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it("calls onChange handler", () => {
      const handleChange = jest.fn();

      render(<Checkbox onChange={handleChange} />);

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("toggles checked state on click", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", () => {
      const { rerender } = render(<Checkbox checked={false} onChange={() => {}} />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      rerender(<Checkbox checked={true} onChange={() => {}} />);
      expect(checkbox.checked).toBe(true);
    });

    it("uses checked prop when provided", () => {
      render(<Checkbox checked={true} onChange={() => {}} />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultChecked", () => {
      render(<Checkbox defaultChecked />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("allows toggling when uncontrolled", () => {
      render(<Checkbox defaultChecked={false} />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe("Disabled State", () => {
    it("can be disabled", () => {
      render(<Checkbox disabled />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });

    it("does not call onChange when disabled", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(<Checkbox disabled onChange={handleChange} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it("cannot be toggled when disabled", async () => {
      const user = userEvent.setup();
      render(<Checkbox disabled />);

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      const initialChecked = checkbox.checked;

      await user.click(checkbox);

      expect(checkbox.checked).toBe(initialChecked);
    });
  });

  describe("Accessibility", () => {
    it("has focus styles", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("focus:ring-sky-500");
    });

    it("supports aria-label", () => {
      render(<Checkbox aria-label="Accept terms" />);

      const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
      expect(checkbox).toBeInTheDocument();
    });

    it("supports aria-labelledby", () => {
      render(
        <div>
          <span id="checkbox-label">Subscribe to newsletter</span>
          <Checkbox aria-labelledby="checkbox-label" />
        </div>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-labelledby", "checkbox-label");
    });

    it("supports aria-describedby", () => {
      render(
        <div>
          <Checkbox aria-describedby="checkbox-desc" />
          <span id="checkbox-desc">This is optional</span>
        </div>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-describedby", "checkbox-desc");
    });

    it("is focusable", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      checkbox.focus();

      expect(document.activeElement).toBe(checkbox);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to checkbox element", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(<Checkbox ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe("checkbox");
    });

    it("allows calling focus on ref", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(<Checkbox ref={ref} />);

      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe("HTML Attributes", () => {
    it("supports name attribute", () => {
      render(<Checkbox name="terms" />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("name", "terms");
    });

    it("supports id attribute", () => {
      render(<Checkbox id="my-checkbox" />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("id", "my-checkbox");
    });

    it("supports value attribute", () => {
      render(<Checkbox value="yes" />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("value", "yes");
    });

    it("supports required attribute", () => {
      render(<Checkbox required />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeRequired();
    });

    it("forwards data attributes", () => {
      render(<Checkbox data-testid="custom-checkbox" data-custom="value" />);

      const checkbox = screen.getByTestId("custom-checkbox");
      expect(checkbox).toHaveAttribute("data-custom", "value");
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Checkbox.displayName).toBe("Checkbox");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders checkbox with label", () => {
      render(
        <div>
          <label htmlFor="terms">
            <Checkbox id="terms" />I agree to the terms and conditions
          </label>
        </div>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByText(/I agree to the terms/)).toBeInTheDocument();
    });

    it("renders required checkbox", () => {
      render(
        <div>
          <label htmlFor="required-check">
            <Checkbox id="required-check" required />
            Required field <span className="text-red-500">*</span>
          </label>
        </div>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeRequired();
    });

    it("renders checkbox group", () => {
      render(
        <div>
          <Checkbox id="option1" name="options" value="1" />
          <Checkbox id="option2" name="options" value="2" />
          <Checkbox id="option3" name="options" value="3" />
        </div>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    it("renders disabled checkbox with explanation", () => {
      render(
        <div>
          <label htmlFor="disabled-check" className="opacity-50">
            <Checkbox id="disabled-check" disabled />
            This option is not available
          </label>
        </div>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });

    it("handles form submission", () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <Checkbox name="subscribe" value="yes" />
          <button type="submit">Submit</button>
        </form>,
      );

      const submitButton = screen.getByRole("button");
      fireEvent.click(submitButton);

      expect(handleSubmit).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("has sky-500 color when checked", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("text-sky-500");
    });

    it("has rounded corners", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("rounded");
    });

    it("has proper sizing", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("h-4", "w-4");
    });
  });
});
