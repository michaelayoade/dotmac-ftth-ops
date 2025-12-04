/**
 * Form component unit tests
 * Testing comprehensive form functionality with react-hook-form integration
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";
import { useForm } from "react-hook-form";

import {
  Checkbox,
  createValidationRules,
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  useFormContext,
  validationPatterns,
} from "../Form";

// Mock form component for testing
const TestForm = ({ onSubmit = jest.fn() }: { onSubmit?: jest.fn }) => {
  const form = useForm<{ email: string; name: string }>({
    defaultValues: { email: "", name: "" },
  });

  return (
    <Form form={form} onSubmit={onSubmit} aria-label="Test Form">
      <FormField name="email" rules={{ required: "Email is required" }}>
        {({ value, onChange, error, invalid }) => (
          <FormItem>
            <FormLabel required>Email</FormLabel>
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              data-testid="email-input"
            />
            {error && <FormMessage data-testid="email-error">{error}</FormMessage>}
          </FormItem>
        )}
      </FormField>

      <FormField name="name">
        {({ value, onChange }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              data-testid="name-input"
            />
          </FormItem>
        )}
      </FormField>

      <button type="submit" data-testid="submit-button">
        Submit
      </button>
    </Form>
  );
};

describe("Form Components", () => {
  describe("Form", () => {
    it("renders form correctly", () => {
      render(<TestForm />);

      expect(screen.getByRole("form")).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it("handles form submission", async () => {
      const mockSubmit = jest.fn();
      render(<TestForm onSubmit={mockSubmit} />);

      const emailInput = screen.getByTestId("email-input");
      const nameInput = screen.getByTestId("name-input");
      const submitButton = screen.getByTestId("submit-button");

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          { email: "test@example.com", name: "John Doe" },
          expect.any(Object),
        );
      });
    });

    it("shows validation errors", async () => {
      render(<TestForm />);

      const submitButton = screen.getByTestId("submit-button");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId("email-error")).toHaveTextContent("Email is required");
      });
    });

    it("clears validation errors when field becomes valid", async () => {
      render(<TestForm />);

      // Trigger validation error
      const submitButton = screen.getByTestId("submit-button");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId("email-error")).toBeInTheDocument();
      });

      // Fix the error
      const emailInput = screen.getByTestId("email-input");
      fireEvent.change(emailInput, { target: { value: "valid@example.com" } });

      await waitFor(() => {
        expect(screen.queryByTestId("email-error")).not.toBeInTheDocument();
      });
    });
  });

  describe("FormLabel", () => {
    it("renders label with required indicator", () => {
      render(<FormLabel required>Required Field</FormLabel>);

      const label = screen.getByText("Required Field");
      expect(label).toBeInTheDocument();
      expect(label.textContent).toContain("*");
    });

    it("renders label without required indicator", () => {
      render(<FormLabel>Optional Field</FormLabel>);

      const label = screen.getByText("Optional Field");
      expect(label).toBeInTheDocument();
      expect(label.textContent).not.toContain("*");
    });
  });

  describe("FormMessage", () => {
    it("renders error message", () => {
      render(<FormMessage>This field is required</FormMessage>);

      const message = screen.getByText("This field is required");
      expect(message).toBeInTheDocument();
      expect(message).toHaveClass("text-destructive");
    });

    it("renders custom styled message", () => {
      render(<FormMessage className="custom-error">Custom error</FormMessage>);

      const message = screen.getByText("Custom error");
      expect(message).toHaveClass("custom-error");
    });
  });

  describe("FormItem", () => {
    it("renders form item container", () => {
      render(
        <FormItem data-testid="form-item">
          <FormLabel>Test Label</FormLabel>
          <input />
        </FormItem>,
      );

      const formItem = screen.getByTestId("form-item");
      expect(formItem).toBeInTheDocument();
      expect(formItem).toHaveClass("space-y-2");
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(<TestForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("associates labels with inputs correctly", () => {
      render(<TestForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const nameInput = screen.getByLabelText(/name/i);

      expect(emailInput).toBeInTheDocument();
      expect(nameInput).toBeInTheDocument();
    });

    it("sets aria-invalid on invalid fields", async () => {
      render(<TestForm />);

      const submitButton = screen.getByTestId("submit-button");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const emailInput = screen.getByTestId("email-input");
        expect(emailInput).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("provides proper error announcement", async () => {
      render(<TestForm />);

      const submitButton = screen.getByTestId("submit-button");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByTestId("email-error");
        expect(errorMessage).toHaveAttribute("role", "alert");
      });
    });
  });

  describe("Integration", () => {
    it("works with controlled inputs", async () => {
      const TestControlledForm = () => {
        const form = useForm<{ controlled: string }>({
          defaultValues: { controlled: "initial" },
        });

        return (
          <Form form={form}>
            <FormField name="controlled">
              {({ value, onChange }) => (
                <FormItem>
                  <FormLabel>Controlled Input</FormLabel>
                  <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    data-testid="controlled-input"
                  />
                </FormItem>
              )}
            </FormField>
          </Form>
        );
      };

      render(<TestControlledForm />);

      const input = screen.getByTestId("controlled-input");
      expect(input).toHaveValue("initial");

      fireEvent.change(input, { target: { value: "updated" } });
      expect(input).toHaveValue("updated");
    });
  });

  describe("Input Component", () => {
    it("renders basic input", () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
    });

    it("supports different input types", () => {
      const { rerender } = render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("type", "email");

      rerender(<Input type="password" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("type", "password");

      rerender(<Input type="number" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("type", "number");
    });

    it("applies variant, size, and state classes", () => {
      const { rerender } = render(
        <Input variant="outlined" size="lg" state="error" data-testid="input" />,
      );

      let input = screen.getByTestId("input");
      expect(input).toHaveClass("outlined", "lg", "error");

      rerender(<Input variant="filled" size="sm" state="success" data-testid="input" />);
      input = screen.getByTestId("input");
      expect(input).toHaveClass("filled", "sm", "success");
    });

    it("renders with start and end icons", () => {
      const StartIcon = () => <span data-testid="start-icon">→</span>;
      const EndIcon = () => <span data-testid="end-icon">←</span>;

      render(<Input startIcon={<StartIcon />} endIcon={<EndIcon />} data-testid="input" />);

      expect(screen.getByTestId("start-icon")).toBeInTheDocument();
      expect(screen.getByTestId("end-icon")).toBeInTheDocument();
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    it("sets aria-invalid based on state", () => {
      const { rerender } = render(<Input state="error" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("aria-invalid", "true");

      rerender(<Input state="default" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("aria-invalid", "false");

      rerender(<Input aria-invalid="true" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("aria-invalid", "true");
    });

    it("generates unique IDs", () => {
      render(
        <div>
          <Input data-testid="input-1" />
          <Input data-testid="input-2" />
        </div>,
      );

      const input1 = screen.getByTestId("input-1");
      const input2 = screen.getByTestId("input-2");

      expect(input1.id).toBeTruthy();
      expect(input2.id).toBeTruthy();
      expect(input1.id).not.toBe(input2.id);
    });

    it("works as child component when asChild is true", () => {
      render(
        <Input asChild data-testid="wrapper">
          <button type="button">Custom button as input</button>
        </Input>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Custom button as input");
    });
  });

  describe("Textarea Component", () => {
    it("renders textarea element", () => {
      render(<Textarea data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("applies resize classes", () => {
      const { rerender } = render(<Textarea resize="none" data-testid="textarea" />);
      expect(screen.getByTestId("textarea")).toHaveClass("resize-none");

      rerender(<Textarea resize="both" data-testid="textarea" />);
      expect(screen.getByTestId("textarea")).toHaveClass("resize-both");

      rerender(<Textarea resize="horizontal" data-testid="textarea" />);
      expect(screen.getByTestId("textarea")).toHaveClass("resize-horizontal");
    });

    it("applies variant and size classes", () => {
      render(<Textarea variant="outlined" size="lg" data-testid="textarea" />);

      const textarea = screen.getByTestId("textarea");
      expect(textarea).toHaveClass("outlined", "lg");
    });

    it("works as child component", () => {
      render(
        <Textarea asChild data-testid="wrapper">
          <div data-testid="custom">Custom textarea</div>
        </Textarea>,
      );

      expect(screen.getByTestId("custom")).toBeInTheDocument();
    });
  });

  describe("Select Component", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2", disabled: true },
      { value: "option3", label: "Option 3" },
    ];

    it("renders select with options", () => {
      render(<Select options={options} data-testid="select" />);

      const select = screen.getByTestId("select");
      expect(select.tagName).toBe("SELECT");
      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getByText("Option 3")).toBeInTheDocument();
    });

    it("renders placeholder option", () => {
      render(<Select placeholder="Choose option" options={options} data-testid="select" />);

      expect(screen.getByText("Choose option")).toBeInTheDocument();
      const placeholderOption = screen.getByText("Choose option");
      expect(placeholderOption).toHaveAttribute("disabled");
    });

    it("handles disabled options", () => {
      render(<Select options={options} data-testid="select" />);

      const disabledOption = screen.getByText("Option 2");
      expect(disabledOption).toHaveAttribute("disabled");
    });

    it("renders children instead of options", () => {
      render(
        <Select data-testid="select">
          <option value="custom">Custom Option</option>
        </Select>,
      );

      expect(screen.getByText("Custom Option")).toBeInTheDocument();
    });

    it("applies variant and size classes", () => {
      render(<Select variant="filled" size="sm" options={options} data-testid="select" />);

      const select = screen.getByTestId("select");
      expect(select).toHaveClass("filled", "sm");
    });
  });

  describe("Checkbox Component", () => {
    it("renders checkbox input", () => {
      render(<Checkbox data-testid="checkbox" />);

      const checkbox = screen.getByTestId("checkbox").querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });

    it("renders with label and description", () => {
      render(
        <Checkbox
          label="Accept terms"
          description="I agree to the terms and conditions"
          data-testid="checkbox"
        />,
      );

      expect(screen.getByText("Accept terms")).toBeInTheDocument();
      expect(screen.getByText("I agree to the terms and conditions")).toBeInTheDocument();
    });

    it("handles controlled state", () => {
      const { rerender } = render(<Checkbox checked={false} data-testid="checkbox" />);

      let checkbox = screen.getByTestId("checkbox").querySelector("input");
      expect(checkbox).not.toBeChecked();

      rerender(<Checkbox checked={true} data-testid="checkbox" />);
      checkbox = screen.getByTestId("checkbox").querySelector("input");
      expect(checkbox).toBeChecked();
    });

    it("supports indeterminate state", () => {
      render(<Checkbox indeterminate data-testid="checkbox" />);

      const checkbox = screen.getByTestId("checkbox").querySelector("input");
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe("Radio Component", () => {
    it("renders radio input", () => {
      render(<Radio name="test" value="option1" data-testid="radio" />);

      const radio = screen.getByTestId("radio").querySelector('input[type="radio"]');
      expect(radio).toBeInTheDocument();
      expect(radio).toHaveAttribute("name", "test");
      expect(radio).toHaveAttribute("value", "option1");
    });

    it("renders with label and description", () => {
      render(
        <Radio
          name="test"
          value="option1"
          label="Option 1"
          description="First option description"
          data-testid="radio"
        />,
      );

      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("First option description")).toBeInTheDocument();
    });
  });

  describe("RadioGroup Component", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2", description: "Second option" },
      { value: "option3", label: "Option 3", disabled: true },
    ];

    it("renders radio group with options", () => {
      render(<RadioGroup name="test-group" options={options} data-testid="radio-group" />);

      expect(screen.getByTestId("radio-group")).toBeInTheDocument();
      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getByText("Option 3")).toBeInTheDocument();
      expect(screen.getByText("Second option")).toBeInTheDocument();
    });

    it("handles value selection", () => {
      const handleChange = jest.fn();

      render(
        <RadioGroup
          name="test-group"
          value="option1"
          onValueChange={handleChange}
          options={options}
          data-testid="radio-group"
        />,
      );

      // The first radio should be checked
      const radios = screen.getAllByRole("radio");
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
      expect(radios[2]).not.toBeChecked();
    });

    it("supports orientation classes", () => {
      const { rerender } = render(
        <RadioGroup
          name="test"
          options={options}
          orientation="horizontal"
          data-testid="radio-group"
        />,
      );

      expect(screen.getByTestId("radio-group")).toHaveClass("orientation-horizontal");

      rerender(
        <RadioGroup
          name="test"
          options={options}
          orientation="vertical"
          data-testid="radio-group"
        />,
      );

      expect(screen.getByTestId("radio-group")).toHaveClass("orientation-vertical");
    });

    it("handles disabled options", () => {
      render(<RadioGroup name="test-group" options={options} data-testid="radio-group" />);

      const radios = screen.getAllByRole("radio");
      expect(radios[2]).toBeDisabled();
    });
  });

  describe("FormDescription", () => {
    it("renders description text", () => {
      render(<FormDescription>This is a form description</FormDescription>);

      expect(screen.getByText("This is a form description")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <FormDescription className="custom-description" data-testid="description">
          Description
        </FormDescription>,
      );

      const description = screen.getByTestId("description");
      expect(description).toHaveClass("custom-description", "form-description");
    });

    it("forwards ref correctly", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(<FormDescription ref={ref}>Description</FormDescription>);

      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
      expect(ref.current?.textContent).toBe("Description");
    });
  });

  describe("FormMessage", () => {
    it("renders different message variants", () => {
      const { rerender } = render(
        <FormMessage variant="error" data-testid="message">
          Error message
        </FormMessage>,
      );

      let message = screen.getByTestId("message");
      expect(message).toHaveClass("variant-error");

      rerender(
        <FormMessage variant="success" data-testid="message">
          Success message
        </FormMessage>,
      );
      message = screen.getByTestId("message");
      expect(message).toHaveClass("variant-success");

      rerender(
        <FormMessage variant="warning" data-testid="message">
          Warning message
        </FormMessage>,
      );
      message = screen.getByTestId("message");
      expect(message).toHaveClass("variant-warning");

      rerender(
        <FormMessage variant="info" data-testid="message">
          Info message
        </FormMessage>,
      );
      message = screen.getByTestId("message");
      expect(message).toHaveClass("variant-info");
    });

    it("defaults to error variant", () => {
      render(<FormMessage data-testid="message">Default message</FormMessage>);

      const message = screen.getByTestId("message");
      expect(message).toHaveClass("variant-error");
    });
  });

  describe("Validation Utilities", () => {
    describe("createValidationRules", () => {
      it("creates required validation rule", () => {
        const rules = createValidationRules({ required: true });
        expect(rules.required).toBe("This field is required");

        const customRequired = createValidationRules({
          required: "Custom required message",
        });
        expect(customRequired.required).toBe("Custom required message");
      });

      it("creates pattern validation rule", () => {
        const pattern = { value: /test/, message: "Invalid pattern" };
        const rules = createValidationRules({ pattern });
        expect(rules.pattern).toEqual(pattern);
      });

      it("creates min/max validation rules", () => {
        const rules = createValidationRules({
          min: { value: 5, message: "Too low" },
          max: { value: 100, message: "Too high" },
        });
        expect(rules.min).toEqual({ value: 5, message: "Too low" });
        expect(rules.max).toEqual({ value: 100, message: "Too high" });
      });

      it("creates minLength/maxLength validation rules", () => {
        const rules = createValidationRules({
          minLength: { value: 3, message: "Too short" },
          maxLength: { value: 50, message: "Too long" },
        });
        expect(rules.minLength).toEqual({ value: 3, message: "Too short" });
        expect(rules.maxLength).toEqual({ value: 50, message: "Too long" });
      });

      it("creates custom validate function", () => {
        const validate = (value: string) => value.includes("test") || "Must contain test";
        const rules = createValidationRules({ validate });
        expect(rules.validate).toBe(validate);
      });
    });

    describe("validationPatterns", () => {
      it("provides email pattern", () => {
        const { email } = validationPatterns;
        expect(email.value.test("test@example.com")).toBe(true);
        expect(email.value.test("invalid-email")).toBe(false);
        expect(email.message).toBe("Please enter a valid email address");
      });

      it("provides phone pattern", () => {
        const { phone } = validationPatterns;
        expect(phone.value.test("+1234567890")).toBe(true);
        expect(phone.value.test("1234567890")).toBe(true);
        expect(phone.value.test("invalid-phone")).toBe(false);
        expect(phone.message).toBe("Please enter a valid phone number");
      });

      it("provides URL pattern", () => {
        const { url } = validationPatterns;
        expect(url.value.test("https://example.com")).toBe(true);
        expect(url.value.test("http://example.com")).toBe(true);
        expect(url.value.test("invalid-url")).toBe(false);
        expect(url.message).toBe("Please enter a valid URL");
      });

      it("provides IP address pattern", () => {
        const { ipAddress } = validationPatterns;
        expect(ipAddress.value.test("192.168.1.1")).toBe(true);
        expect(ipAddress.value.test("255.255.255.255")).toBe(true);
        expect(ipAddress.value.test("256.256.256.256")).toBe(false);
        expect(ipAddress.value.test("invalid-ip")).toBe(false);
        expect(ipAddress.message).toBe("Please enter a valid IP address");
      });
    });
  });

  describe("Form Context", () => {
    it("throws error when used outside Form", () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // Implementation pending
      });

      const TestComponent = () => {
        useFormContext();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponent />)).toThrow("Form components must be used within a Form");

      consoleSpy.mockRestore();
    });

    it("provides form context when used inside Form", () => {
      const TestComponent = () => {
        const { form } = useFormContext();
        return <div data-testid="has-context">{form ? "Has form" : "No form"}</div>;
      };

      const Wrapper = () => {
        const form = useForm();
        return (
          <Form form={form} onSubmit={jest.fn()}>
            <TestComponent />
          </Form>
        );
      };

      render(<Wrapper />);

      expect(screen.getByTestId("has-context")).toHaveTextContent("Has form");
    });
  });

  describe("Form Layout and Variants", () => {
    it("applies layout and size variants", () => {
      const Wrapper = () => {
        const form = useForm();
        return (
          <Form
            form={form}
            onSubmit={jest.fn()}
            layout="horizontal"
            size="lg"
            className="custom-form"
          >
            <div>Content</div>
          </Form>
        );
      };
      const { container } = render(<Wrapper />);

      const formElement = container.querySelector("form");
      expect(formElement).toHaveClass("custom-form");
    });

    it("renders as child component when asChild is true", () => {
      const Wrapper = () => {
        const form = useForm();
        return (
          <Form form={form} onSubmit={jest.fn()} asChild>
            <div data-testid="custom-wrapper">Custom form wrapper</div>
          </Form>
        );
      };

      render(<Wrapper />);

      expect(screen.getByTestId("custom-wrapper")).toBeInTheDocument();
    });

    it("sets noValidate on form element", () => {
      const Wrapper = () => {
        const form = useForm();
        return (
          <Form form={form} onSubmit={jest.fn()}>
            <div>Content</div>
          </Form>
        );
      };
      const { container } = render(<Wrapper />);

      const formElement = container.querySelector("form");
      expect(formElement).toHaveAttribute("noValidate");
    });
  });

  describe("Advanced Form Integration", () => {
    it("works with complex nested forms", async () => {
      const ComplexForm = () => {
        const form = useForm<{
          personal: { name: string; email: string };
          preferences: { newsletter: boolean; theme: string };
        }>({
          defaultValues: {
            personal: { name: "", email: "" },
            preferences: { newsletter: false, theme: "light" },
          },
        });

        return (
          <Form form={form} onSubmit={jest.fn()}>
            <FormField name="personal.name">
              {({ value, onChange, error, invalid }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    state={invalid ? "error" : "default"}
                    data-testid="name-input"
                  />
                  {error && <FormMessage>{error}</FormMessage>}
                </FormItem>
              )}
            </FormField>

            <FormField name="preferences.newsletter">
              {({ value, onChange }) => (
                <FormItem>
                  <Checkbox
                    checked={value || false}
                    onChange={(e) => onChange(e.target.checked)}
                    label="Subscribe to newsletter"
                    data-testid="newsletter-checkbox"
                  />
                </FormItem>
              )}
            </FormField>

            <FormField name="preferences.theme">
              {({ value, onChange }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <RadioGroup
                    name="theme"
                    value={value || "light"}
                    onValueChange={onChange}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                    data-testid="theme-radio-group"
                  />
                </FormItem>
              )}
            </FormField>
          </Form>
        );
      };

      render(<ComplexForm />);

      expect(screen.getByTestId("name-input")).toBeInTheDocument();
      expect(screen.getByTestId("newsletter-checkbox")).toBeInTheDocument();
      expect(screen.getByTestId("theme-radio-group")).toBeInTheDocument();
    });

    it("handles async form submission", async () => {
      const mockSubmit = jest.fn().mockResolvedValue({ success: true });

      const AsyncForm = () => {
        const form = useForm<{ email: string }>({
          defaultValues: { email: "" },
        });

        return (
          <Form form={form} onSubmit={mockSubmit}>
            <FormField name="email">
              {({ value, onChange }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    data-testid="email-input"
                  />
                </FormItem>
              )}
            </FormField>
            <button type="submit" data-testid="submit-btn">
              Submit
            </button>
          </Form>
        );
      };

      render(<AsyncForm />);

      const emailInput = screen.getByTestId("email-input");
      const submitBtn = screen.getByTestId("submit-btn");

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({ email: "test@example.com" }, expect.any(Object));
      });
    });
  });

  describe("Performance", () => {
    it("renders large forms efficiently", () => {
      const LargeForm = () => {
        const form = useForm();
        const fields = Array.from({ length: 100 }, (_, i) => `field_${i}`);

        return (
          <Form form={form} onSubmit={jest.fn()}>
            {fields.map((fieldName) => (
              <FormField key={fieldName} name={fieldName}>
                {({ value, onChange }) => (
                  <FormItem>
                    <FormLabel>{fieldName}</FormLabel>
                    <Input
                      value={value || ""}
                      onChange={(e) => onChange(e.target.value)}
                      data-testid={fieldName}
                    />
                  </FormItem>
                )}
              </FormField>
            ))}
          </Form>
        );
      };

      const startTime = performance.now();
      render(<LargeForm />);
      const endTime = performance.now();

      // Should render within reasonable time even in JSDOM
      expect(endTime - startTime).toBeLessThan(1500);
      expect(screen.getByTestId("field_0")).toBeInTheDocument();
      expect(screen.getByTestId("field_99")).toBeInTheDocument();
    });
  });
});
