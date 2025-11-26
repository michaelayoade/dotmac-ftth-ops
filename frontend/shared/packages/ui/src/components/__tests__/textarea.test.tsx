/**
 * Textarea Component Tests
 *
 * Tests shadcn/ui Textarea form control component
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Textarea } from "../textarea";

describe("Textarea", () => {
  describe("Basic Rendering", () => {
    it("renders textarea element", () => {
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });

    it("renders as textarea tag", () => {
      const { container } = render(<Textarea />);

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("flex", "min-h-[80px]", "w-full", "rounded-md", "border");
    });

    it("supports custom className", () => {
      render(<Textarea className="custom-textarea" data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("custom-textarea");
    });
  });

  describe("User Input", () => {
    it("accepts user input", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello, World!");

      expect(textarea).toHaveValue("Hello, World!");
    });

    it("accepts multi-line input", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Line 1{Enter}Line 2{Enter}Line 3");

      expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3");
    });

    it("preserves whitespace", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "  Indented text  ");

      expect(textarea).toHaveValue("  Indented text  ");
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Textarea value="Initial value" onChange={onChange} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Initial value");

      await user.clear(textarea);
      await user.type(textarea, "New value");

      expect(onChange).toHaveBeenCalled();
    });

    it("updates value when prop changes", () => {
      const { rerender } = render(<Textarea value="First" onChange={() => {}} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("First");

      rerender(<Textarea value="Second" onChange={() => {}} />);

      expect(textarea).toHaveValue("Second");
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component", async () => {
      const user = userEvent.setup();
      render(<Textarea defaultValue="Default text" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Default text");

      await user.type(textarea, " Added text");

      expect(textarea).toHaveValue("Default text Added text");
    });

    it("supports defaultValue prop", () => {
      render(<Textarea defaultValue="Initial content" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Initial content");
    });
  });

  describe("HTML Attributes", () => {
    it("supports placeholder attribute", () => {
      render(<Textarea placeholder="Enter description..." />);

      const textarea = screen.getByPlaceholderText("Enter description...");
      expect(textarea).toBeInTheDocument();
    });

    it("supports rows attribute", () => {
      render(<Textarea rows={10} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("rows", "10");
    });

    it("supports cols attribute", () => {
      render(<Textarea cols={50} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("cols", "50");
    });

    it("supports maxLength attribute", () => {
      render(<Textarea maxLength={100} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("maxLength", "100");
    });

    it("supports minLength attribute", () => {
      render(<Textarea minLength={10} data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("minLength", "10");
    });

    it("supports name attribute", () => {
      render(<Textarea name="description" data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("name", "description");
    });

    it("supports id attribute", () => {
      render(<Textarea id="comment-textarea" data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("id", "comment-textarea");
    });

    it("supports required attribute", () => {
      render(<Textarea required data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toBeRequired();
    });

    it("supports readOnly attribute", () => {
      render(
        <Textarea readOnly value="Read only text" onChange={() => {}} data-testid="textarea" />,
      );

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveAttribute("readOnly");
    });
  });

  describe("Disabled State", () => {
    it("can be disabled", () => {
      render(<Textarea disabled />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(<Textarea disabled data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-50");
    });

    it("cannot accept input when disabled", async () => {
      const user = userEvent.setup();
      render(<Textarea disabled />);

      const textarea = screen.getByRole("textbox");

      await user.type(textarea, "Should not type");

      expect(textarea).toHaveValue("");
    });
  });

  describe("Focus State", () => {
    it("can be focused", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      textarea.focus();

      expect(document.activeElement).toBe(textarea);
    });

    it("applies focus styles", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("focus:outline-none", "focus:ring-2");
    });

    it("calls onFocus handler", async () => {
      const user = userEvent.setup();
      const onFocus = jest.fn();

      render(<Textarea onFocus={onFocus} />);

      const textarea = screen.getByRole("textbox");
      await user.click(textarea);

      expect(onFocus).toHaveBeenCalled();
    });

    it("calls onBlur handler", async () => {
      const user = userEvent.setup();
      const onBlur = jest.fn();

      render(<Textarea onBlur={onBlur} />);

      const textarea = screen.getByRole("textbox");
      await user.click(textarea);
      await user.tab();

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Event Handlers", () => {
    it("calls onChange handler", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Textarea onChange={onChange} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "test");

      expect(onChange).toHaveBeenCalled();
    });

    it("calls onKeyDown handler", async () => {
      const user = userEvent.setup();
      const onKeyDown = jest.fn();

      render(<Textarea onKeyDown={onKeyDown} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "a");

      expect(onKeyDown).toHaveBeenCalled();
    });

    it("calls onKeyUp handler", async () => {
      const user = userEvent.setup();
      const onKeyUp = jest.fn();

      render(<Textarea onKeyUp={onKeyUp} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "a");

      expect(onKeyUp).toHaveBeenCalled();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to textarea element", () => {
      const ref = React.createRef<HTMLTextAreaElement>();

      render(<Textarea ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it("ref can be used to focus textarea", () => {
      const ref = React.createRef<HTMLTextAreaElement>();

      render(<Textarea ref={ref} />);

      ref.current?.focus();

      expect(document.activeElement).toBe(ref.current);
    });

    it("ref can be used to get textarea value", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLTextAreaElement>();

      render(<Textarea ref={ref} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Test value");

      expect(ref.current?.value).toBe("Test value");
    });
  });

  describe("Display Name", () => {
    it("Textarea has correct display name", () => {
      expect(Textarea.displayName).toBe("Textarea");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders comment textarea", () => {
      render(<Textarea placeholder="Add a comment..." rows={4} />);

      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument();
    });

    it("renders description field", () => {
      render(
        <Textarea
          placeholder="Enter description"
          maxLength={500}
          defaultValue="Product description goes here"
        />,
      );

      expect(screen.getByRole("textbox")).toHaveValue("Product description goes here");
    });

    it("renders feedback form", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn((e) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <Textarea placeholder="Share your feedback" required />
          <button type="submit">Submit</button>
        </form>,
      );

      const textarea = screen.getByPlaceholderText("Share your feedback");
      await user.type(textarea, "Great product!");

      const button = screen.getByText("Submit");
      await user.click(button);

      expect(onSubmit).toHaveBeenCalled();
    });

    it("renders bio editor", () => {
      render(
        <Textarea
          placeholder="Tell us about yourself"
          rows={6}
          maxLength={200}
          defaultValue="Software developer passionate about React and TypeScript."
        />,
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Software developer passionate about React and TypeScript.");
    });

    it("renders message composer", async () => {
      const user = userEvent.setup();
      const onSend = jest.fn();

      render(
        <div>
          <Textarea placeholder="Type a message..." rows={3} />
          <button onClick={onSend}>Send</button>
        </div>,
      );

      const textarea = screen.getByPlaceholderText("Type a message...");
      await user.type(textarea, "Hello, how are you?");

      expect(textarea).toHaveValue("Hello, how are you?");
    });

    it("renders code snippet textarea", () => {
      const code = `const greeting = 'Hello, World!';
console.log(greeting);`;
      render(
        <Textarea
          placeholder="Paste code here"
          className="font-mono"
          rows={10}
          defaultValue={code}
        />,
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue(code);
    });
  });

  describe("Accessibility", () => {
    it("has textbox role", () => {
      render(<Textarea />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("supports aria-label", () => {
      render(<Textarea aria-label="Comment field" />);

      expect(screen.getByLabelText("Comment field")).toBeInTheDocument();
    });

    it("supports aria-describedby", () => {
      render(
        <div>
          <Textarea aria-describedby="description" />
          <div id="description">Enter your comment here</div>
        </div>,
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("aria-describedby", "description");
    });

    it("supports aria-invalid", () => {
      render(<Textarea aria-invalid="true" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });

    it("is keyboard accessible", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");

      await user.tab();
      expect(document.activeElement).toBe(textarea);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty value", () => {
      render(<Textarea value="" onChange={() => {}} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("");
    });

    it("handles very long text", async () => {
      const user = userEvent.setup();
      const longText = "A".repeat(1000);

      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, longText);

      expect(textarea).toHaveValue(longText);
    });

    it("handles special characters", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Special: <>&\"'");

      expect(textarea).toHaveValue("Special: <>&\"'");
    });

    it("handles Unicode characters", async () => {
      const user = userEvent.setup();
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello 世界 🌍");

      expect(textarea).toHaveValue("Hello 世界 🌍");
    });

    it("handles null className", () => {
      render(<Textarea className={undefined} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });
  });
});
