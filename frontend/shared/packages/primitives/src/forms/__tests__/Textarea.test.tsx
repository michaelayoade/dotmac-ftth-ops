/**
 * Textarea Component Tests
 *
 * Testing focus styles, escape handling, textarea styling, and all standard HTML attributes
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  userEvent,
} from "../../testing";
import { Textarea } from "../Textarea";

describe("Textarea", () => {
  describe("Basic Rendering", () => {
    it("renders textarea element", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("applies placeholder text", () => {
      render(<Textarea placeholder="Enter your message" />);

      expect(screen.getByPlaceholderText("Enter your message")).toBeInTheDocument();
    });

    it("renders with initial value", () => {
      render(<Textarea defaultValue="Initial content" data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Initial content");
    });

    it("applies custom className", () => {
      render(<Textarea className="custom-class" data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveClass("custom-class");
    });

    it("applies default min-height styling", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("min-h-[80px]");
    });
  });

  describe("User Interactions", () => {
    it("handles text input", async () => {
      const { user } = render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      await user.type(textarea, "Hello, World!");

      expect(textarea).toHaveValue("Hello, World!");
    });

    it("handles onChange events", async () => {
      const onChange = jest.fn();
      const { user } = render(<Textarea onChange={onChange} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      await user.type(textarea, "Test");

      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledTimes(4); // Once per character
    });

    it("handles onBlur events", () => {
      const onBlur = jest.fn();
      render(<Textarea onBlur={onBlur} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      fireEvent.focus(textarea);
      fireEvent.blur(textarea);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("handles onFocus events", () => {
      const onFocus = jest.fn();
      render(<Textarea onFocus={onFocus} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      fireEvent.focus(textarea);

      expect(onFocus).toHaveBeenCalledTimes(1);
    });

    it("handles multiline text input", async () => {
      const { user } = render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      await user.type(textarea, "Line 1{Enter}Line 2{Enter}Line 3");

      expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3");
    });

    it("handles keyboard events", () => {
      const onKeyDown = jest.fn();
      render(<Textarea onKeyDown={onKeyDown} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onKeyDown).toHaveBeenCalled();
    });

    it("handles escape key press", () => {
      const onKeyDown = jest.fn();
      render(<Textarea onKeyDown={onKeyDown} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    });
  });

  describe("Focus Styles", () => {
    it("applies focus ring styles on focus", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      fireEvent.focus(textarea);

      // Check for focus ring classes (from Tailwind)
      expect(textarea).toHaveClass("focus:ring-2");
      expect(textarea).toHaveClass("focus:ring-blue-500");
      expect(textarea).toHaveClass("focus:ring-offset-2");
    });

    it("applies border color on focus", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("focus:border-blue-500");
    });

    it("removes outline in favor of ring", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("focus:outline-none");
    });
  });

  describe("Disabled State", () => {
    it("applies disabled attribute", () => {
      render(<Textarea disabled data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toBeDisabled();
    });

    it("applies disabled cursor style", () => {
      render(<Textarea disabled data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveClass("disabled:cursor-not-allowed");
    });

    it("applies disabled opacity", () => {
      render(<Textarea disabled data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveClass("disabled:opacity-50");
    });

    it("prevents text input when disabled", async () => {
      const onChange = jest.fn();
      const { user } = render(<Textarea disabled onChange={onChange} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");

      // Attempt to type
      await user.type(textarea, "Test");

      expect(onChange).not.toHaveBeenCalled();
      expect(textarea).toHaveValue("");
    });
  });

  describe("HTML Attributes", () => {
    it("supports required attribute", () => {
      render(<Textarea required data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toBeRequired();
    });

    it("supports readonly attribute", () => {
      render(<Textarea readOnly data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("readonly");
    });

    it("supports maxLength attribute", () => {
      render(<Textarea maxLength={100} data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("maxlength", "100");
    });

    it("supports rows attribute", () => {
      render(<Textarea rows={5} data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("rows", "5");
    });

    it("supports cols attribute", () => {
      render(<Textarea cols={50} data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("cols", "50");
    });

    it("supports name attribute", () => {
      render(<Textarea name="message" data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("name", "message");
    });

    it("supports autoComplete attribute", () => {
      render(<Textarea autoComplete="off" data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("autocomplete", "off");
    });

    it("supports autoFocus attribute", () => {
      render(<Textarea autoFocus data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveFocus();
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState("");

        return (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="textarea"
          />
        );
      };

      const { user } = render(<TestComponent />);

      const textarea = screen.getByTestId("textarea");
      await user.type(textarea, "Controlled");

      expect(textarea).toHaveValue("Controlled");
    });

    it("prevents uncontrolled updates when value prop is provided", async () => {
      const { user } = render(
        <Textarea value="Fixed" onChange={() => {}} data-testid="textarea" />,
      );

      const textarea = screen.getByTestId("textarea");
      await user.type(textarea, "Test");

      expect(textarea).toHaveValue("Fixed");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to textarea element", () => {
      const ref = React.createRef<HTMLTextAreaElement>();

      render(<Textarea ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it("allows ref access to textarea methods", () => {
      const ref = React.createRef<HTMLTextAreaElement>();

      render(<Textarea ref={ref} defaultValue="Test" />);

      expect(ref.current?.value).toBe("Test");

      // Can call textarea methods
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });

  describe("Accessibility", () => {
    it("passes accessibility validation", async () => {
      await renderA11y(<Textarea aria-label="Message" />);
    });

    it("supports aria-label", () => {
      render(<Textarea aria-label="Description" data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("aria-label", "Description");
    });

    it("supports aria-describedby", () => {
      render(
        <>
          <Textarea aria-describedby="help-text" data-testid="textarea" />
          <p id="help-text">Helper text</p>
        </>,
      );

      expect(screen.getByTestId("textarea")).toHaveAttribute("aria-describedby", "help-text");
    });

    it("supports aria-invalid for error states", () => {
      render(<Textarea aria-invalid="true" data-testid="textarea" />);

      expect(screen.getByTestId("textarea")).toHaveAttribute("aria-invalid", "true");
    });

    it("is keyboard accessible", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");

      // Should be focusable via keyboard
      textarea.focus();
      expect(textarea).toHaveFocus();
    });
  });

  describe("Security", () => {
    it("passes security validation", async () => {
      const result = await renderSecurity(<Textarea />);
      expect(result.container).toHaveNoSecurityViolations();
    });

    it("prevents XSS in value", async () => {
      const maliciousValue = '<script>alert("XSS")</script>';

      const result = await renderSecurity(
        <Textarea defaultValue={maliciousValue} data-testid="textarea" />,
      );

      const textarea = screen.getByTestId("textarea") as HTMLTextAreaElement;

      // Value should be treated as plain text, not HTML
      expect(textarea.value).toBe(maliciousValue);
      expect(result.container).toHaveNoSecurityViolations();
    });

    it("prevents XSS in placeholder", async () => {
      const maliciousPlaceholder = '<img src=x onerror="alert(1)">';

      const result = await renderSecurity(
        <Textarea placeholder={maliciousPlaceholder} data-testid="textarea" />,
      );

      expect(result.container).toHaveNoSecurityViolations();
    });
  });

  describe("Performance", () => {
    it("renders within performance threshold", () => {
      const result = renderPerformance(<Textarea />);

      const metrics = result.measurePerformance();
      expect(metrics).toBePerformant(80);
    });

    it("handles large text content efficiently", () => {
      const largeContent = "A".repeat(10000);

      const result = renderPerformance(
        <Textarea defaultValue={largeContent} data-testid="textarea" />,
      );

      const metrics = result.measurePerformance();
      expect(metrics).toBePerformant(50); // Allow more time for large content
    });
  });

  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <Textarea
          placeholder="Enter your message"
          aria-label="Message input"
          maxLength={500}
          rows={4}
        />,
      );

      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant();
      expect(result.container).toHaveValidMarkup();
    });
  });
});
