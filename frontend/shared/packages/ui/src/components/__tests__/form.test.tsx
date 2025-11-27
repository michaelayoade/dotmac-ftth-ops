/**
 * Form Component Tests
 *
 * Tests shadcn/ui Form components built on react-hook-form
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from "../form";
import { Input } from "../input";

type TestFormValues = {
  username: string;
};

type TestFormProps = {
  onSubmit: SubmitHandler<TestFormValues>;
  defaultValues?: Partial<TestFormValues>;
};

describe("Form Components", () => {
  // Test form component wrapper
  function TestForm({ onSubmit, defaultValues }: TestFormProps) {
    const form = useForm<TestFormValues>({ defaultValues });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="username"
            rules={{ required: "Username is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter username" />
                </FormControl>
                <FormDescription>Your unique username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <button type="submit">Submit</button>
        </form>
      </Form>
    );
  }

  describe("Form Provider", () => {
    it("renders form with react-hook-form context", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByLabelText("Username")).toBeInTheDocument();
    });

    it("handles form submission", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} defaultValues={{ username: "testuser" }} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ username: "testuser" }, expect.anything());
      });
    });

    it("provides form context to nested components", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      // FormLabel should be connected via context
      const label = screen.getByText("Username");
      const input = screen.getByPlaceholderText("Enter username");

      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });
  });

  describe("FormField", () => {
    it("renders field with controller", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    });

    it("provides field context", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      // Field name should be accessible via context
      expect(screen.getByLabelText("Username")).toBeInTheDocument();
    });

    it("handles validation rules", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      // Submit without filling required field
      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(screen.getByText("Username is required")).toBeInTheDocument();
      });
    });

    it("updates field value on input", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Enter username");
      await user.type(input, "newuser");

      expect(input).toHaveValue("newuser");
    });
  });

  describe("FormItem", () => {
    it("renders form item container", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const label = screen.getByText("Username");
      expect(label.closest(".space-y-2")).toBeInTheDocument();
    });

    it("generates unique ID", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Enter username");
      expect(input).toHaveAttribute("id");
    });

    it("provides item context to children", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      // Description and message should be connected via item context
      expect(screen.getByText("Your unique username")).toBeInTheDocument();
    });

    it("applies space-y-2 styles", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const label = screen.getByText("Username");
      const container = label.closest("div");
      expect(container).toHaveClass("space-y-2");
    });
  });

  describe("FormLabel", () => {
    it("renders label text", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("links to form control", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const label = screen.getByText("Username");
      const input = screen.getByPlaceholderText("Enter username");

      expect(label).toHaveAttribute("for", input.id);
    });

    it("applies error styles when field has error", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        const label = screen.getByText("Username");
        expect(label).toHaveClass("text-destructive");
      });
    });

    it("supports custom className", () => {
      function CustomLabelForm() {
        const form = useForm();
        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="test"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="custom-label">Test</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
      }

      render(<CustomLabelForm />);

      const label = screen.getByText("Test");
      expect(label).toHaveClass("custom-label");
    });
  });

  describe("FormControl", () => {
    it("renders controlled input", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    });

    it("applies aria-describedby", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Enter username");
      expect(input).toHaveAttribute("aria-describedby");
    });

    it("applies aria-invalid when field has error", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter username");
        expect(input).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("connects description via aria-describedby", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Enter username");
      const description = screen.getByText("Your unique username");

      expect(input.getAttribute("aria-describedby")).toContain(description.id);
    });
  });

  describe("FormDescription", () => {
    it("renders description text", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByText("Your unique username")).toBeInTheDocument();
    });

    it("applies muted foreground styles", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const description = screen.getByText("Your unique username");
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("has unique ID", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const description = screen.getByText("Your unique username");
      expect(description).toHaveAttribute("id");
    });

    it("supports custom className", () => {
      function CustomDescriptionForm() {
        const form = useForm();
        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="test"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription className="custom-desc">Custom description</FormDescription>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
      }

      render(<CustomDescriptionForm />);

      const description = screen.getByText("Custom description");
      expect(description).toHaveClass("custom-desc");
    });
  });

  describe("FormMessage", () => {
    it("does not render when no error", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.queryByText("Username is required")).not.toBeInTheDocument();
    });

    it("renders error message when validation fails", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(screen.getByText("Username is required")).toBeInTheDocument();
      });
    });

    it("applies destructive text styles", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        const message = screen.getByText("Username is required");
        expect(message).toHaveClass("text-sm", "font-medium", "text-destructive");
      });
    });

    it("has unique ID", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        const message = screen.getByText("Username is required");
        expect(message).toHaveAttribute("id");
      });
    });

    it("can render custom children", () => {
      function CustomMessageForm() {
        const form = useForm();
        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="test"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage>Custom message</FormMessage>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
      }

      render(<CustomMessageForm />);

      expect(screen.getByText("Custom message")).toBeInTheDocument();
    });
  });

  describe("useFormField Hook", () => {
    it("provides field context", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      // Hook should provide field name via context
      expect(screen.getByLabelText("Username")).toBeInTheDocument();
    });

    it("throws error when used outside FormField", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      function InvalidComponent() {
        useFormField();
        return null;
      }

      expect(() => render(<InvalidComponent />)).toThrow();

      console.error = originalError;
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders login form", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      function LoginForm() {
        const form = useForm({
          defaultValues: { email: "", password: "" },
        });

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                rules={{ required: "Email is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                rules={{ required: "Password is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit">Login</button>
            </form>
          </Form>
        );
      }

      render(<LoginForm />);

      await user.click(screen.getByText("Login"));

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(screen.getByText("Password is required")).toBeInTheDocument();
      });
    });

    it("renders registration form with validation", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      function RegisterForm() {
        const form = useForm();

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit">Register</button>
            </form>
          </Form>
        );
      }

      render(<RegisterForm />);

      const input = screen.getByRole("textbox");
      await user.type(input, "invalid");
      await user.click(screen.getByText("Register"));

      await waitFor(() => {
        expect(screen.getByText("Invalid email")).toBeInTheDocument();
      });
    });
  });

  describe("Display Names", () => {
    it("FormItem has correct display name", () => {
      expect(FormItem.displayName).toBe("FormItem");
    });

    it("FormLabel has correct display name", () => {
      expect(FormLabel.displayName).toBe("FormLabel");
    });

    it("FormControl has correct display name", () => {
      expect(FormControl.displayName).toBe("FormControl");
    });

    it("FormDescription has correct display name", () => {
      expect(FormDescription.displayName).toBe("FormDescription");
    });

    it("FormMessage has correct display name", () => {
      expect(FormMessage.displayName).toBe("FormMessage");
    });
  });

  describe("Accessibility", () => {
    it("connects label to input", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const label = screen.getByText("Username");
      const input = screen.getByPlaceholderText("Enter username");

      expect(label).toHaveAttribute("for", input.id);
    });

    it("provides accessible error messages", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByText("Submit"));

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter username");
        const errorMessage = screen.getByText("Username is required");

        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input.getAttribute("aria-describedby")).toContain(errorMessage.id);
      });
    });

    it("provides accessible descriptions", () => {
      const onSubmit = jest.fn();
      render(<TestForm onSubmit={onSubmit} />);

      const input = screen.getByPlaceholderText("Enter username");
      const description = screen.getByText("Your unique username");

      expect(input.getAttribute("aria-describedby")).toContain(description.id);
    });
  });
});
