import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginForm } from "../../app/dashboard/settings/plugins/components/PluginForm";

// Import types for proper typing
type PluginConfig = {
  name: string;
  type: "notification" | "integration" | "payment" | "storage";
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  dependencies?: string[];
  supports_health_check: boolean;
  supports_test_connection: boolean;
  fields: Array<{
    key: string;
    label: string;
    type:
      | "string"
      | "secret"
      | "boolean"
      | "integer"
      | "float"
      | "select"
      | "json"
      | "url"
      | "email"
      | "phone"
      | "date"
      | "datetime"
      | "file";
    description?: string;
    required?: boolean;
    is_secret?: boolean;
    default?: unknown;
    min_value?: number;
    max_value?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    validation_rules?: string[];
    options?: Array<{ value: string; label: string }>;
    group?: string;
    order?: number;
  }>;
};

const mockPlugin: PluginConfig = {
  name: "Coverage Plugin",
  type: "integration",
  version: "1.0.0",
  description: "Test plugin for coverage",
  supports_health_check: true,
  supports_test_connection: true,
  fields: [
    {
      key: "secret_field",
      label: "Secret Field",
      type: "secret",
      description: "Secret field for testing",
      required: true,
    },
    {
      key: "boolean_field",
      label: "Boolean Field",
      type: "boolean",
      description: "Boolean field for testing",
      required: false,
      default: true,
    },
    {
      key: "integer_field",
      label: "Integer Field",
      type: "integer",
      description: "Integer field",
      required: false,
      min_value: 1,
      max_value: 100,
    },
    {
      key: "float_field",
      label: "Float Field",
      type: "float",
      description: "Float field",
      required: false,
      min_value: 0.1,
      max_value: 99.9,
    },
    {
      key: "select_field",
      label: "Select Field",
      type: "select",
      description: "Select field",
      required: false,
      options: [
        { value: "option1", label: "Option 1" },
        { value: "option2", label: "Option 2" },
        { value: "option3", label: "Option 3" },
      ],
    },
    {
      key: "url_field",
      label: "URL Field",
      type: "url",
      description: "URL field",
      required: false,
    },
    {
      key: "email_field",
      label: "Email Field",
      type: "email",
      description: "Email field",
      required: false,
    },
    {
      key: "phone_field",
      label: "Phone Field",
      type: "phone",
      description: "Phone field",
      required: false,
      pattern: "^\\+?[0-9]{10,}$",
    },
    {
      key: "date_field",
      label: "Date Field",
      type: "date",
      description: "Date field",
      required: false,
    },
    {
      key: "datetime_field",
      label: "DateTime Field",
      type: "datetime",
      description: "DateTime field",
      required: false,
    },
  ],
};

const defaultProps = {
  plugin: mockPlugin,
  availablePlugins: [mockPlugin],
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  onTestConnection: jest.fn(),
};

describe("PluginForm Coverage Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles secret field visibility toggle", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const secretField = screen.getByLabelText(/Secret Field/) as HTMLInputElement;
    expect(secretField).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: "" });
    await user.click(toggleButton);

    expect(secretField).toHaveAttribute("type", "text");
  });

  it("handles boolean field interactions", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const booleanField = screen.getByLabelText(/Boolean Field/) as HTMLInputElement;
    expect(booleanField.checked).toBe(true); // default value

    await user.click(booleanField);
    expect(booleanField.checked).toBe(false);
  });

  it("handles integer field validation", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const integerField = screen.getByLabelText(/Integer Field/);
    await user.type(integerField, "150"); // Above max

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Maximum value is 100/)).toBeInTheDocument();
  });

  it("handles float field validation", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    // Fill required field first
    const secretField = screen.getByLabelText(/Secret Field/);
    await user.type(secretField, "secret123");

    const floatField = screen.getByLabelText(/Float Field/);
    // Use fireEvent to bypass HTML validation
    fireEvent.change(floatField, { target: { value: "0.05" } }); // Below min

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Minimum value is 0.1/)).toBeInTheDocument();
  });

  it("handles select field interactions", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const selectField = screen.getByLabelText(/Select Field/) as HTMLSelectElement;
    await user.selectOptions(selectField, "option2");

    expect(selectField.value).toBe("option2");
  });

  it("handles URL field validation", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const urlField = screen.getByLabelText(/URL Field/);
    await user.type(urlField, "invalid-url");

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Invalid URL format/)).toBeInTheDocument();
  });

  it("handles email field validation", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const emailField = screen.getByLabelText(/Email Field/);
    await user.type(emailField, "invalid-email");

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Invalid email format/)).toBeInTheDocument();
  });

  it("handles phone field validation", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    // Fill required field first
    const secretField = screen.getByLabelText(/Secret Field/);
    await user.type(secretField, "secret123");

    const phoneField = screen.getByLabelText(/Phone Field/);
    await user.type(phoneField, "123"); // Too short

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Invalid phone number format/)).toBeInTheDocument();
  });

  it("handles date field interactions", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const dateField = screen.getByLabelText(/Date Field/);
    await user.type(dateField, "2024-12-25");

    expect((dateField as HTMLInputElement).value).toBe("2024-12-25");
  });

  it("handles datetime field interactions", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const datetimeField = screen.getByLabelText(/DateTime Field/);
    await user.type(datetimeField, "2024-12-25T10:30");

    expect((datetimeField as HTMLInputElement).value).toBe("2024-12-25T10:30");
  });

  it("submits form with all field types", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<PluginForm {...defaultProps} onSubmit={onSubmit} />);

    // Fill required fields
    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const secretField = screen.getByLabelText(/Secret Field/);
    await user.type(secretField, "secret123");

    // Fill optional fields using fireEvent for speed
    const integerField = screen.getByLabelText(/Integer Field/);
    fireEvent.change(integerField, { target: { value: "50" } });

    const floatField = screen.getByLabelText(/Float Field/);
    fireEvent.change(floatField, { target: { value: "25.5" } });

    const selectField = screen.getByLabelText(/Select Field/);
    await user.selectOptions(selectField, "option1");

    const urlField = screen.getByLabelText(/URL Field/);
    fireEvent.change(urlField, { target: { value: "https://example.com" } });

    const emailField = screen.getByLabelText(/Email Field/);
    fireEvent.change(emailField, { target: { value: "test@example.com" } });

    const phoneField = screen.getByLabelText(/Phone Field/);
    fireEvent.change(phoneField, { target: { value: "+1234567890" } });

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        instance_name: "Test Instance",
        plugin_name: "Coverage Plugin",
        configuration: {
          secret_field: "secret123",
          boolean_field: true,
          integer_field: 50,
          float_field: 25.5,
          select_field: "option1",
          url_field: "https://example.com",
          email_field: "test@example.com",
          phone_field: "+1234567890",
          // date_field and datetime_field are empty so not included
        },
      });
    });
  });

  it("handles form cancellation", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<PluginForm {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/ });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it("handles test connection success", async () => {
    const user = userEvent.setup();
    const onTestConnection = jest.fn().mockResolvedValue({
      success: true,
      message: "Connection successful",
    });
    render(<PluginForm {...defaultProps} onTestConnection={onTestConnection} />);

    // Fill required fields
    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const secretField = screen.getByLabelText(/Secret Field/);
    await user.type(secretField, "secret123");

    const testButton = screen.getByRole("button", { name: /Test Connection/ });
    await user.click(testButton);

    // Wait for onTestConnection to be called with correct params
    await waitFor(() => {
      expect(onTestConnection).toHaveBeenCalledWith("", expect.any(Object));
    });

    // Wait for success message
    expect(await screen.findByText(/Connection successful/)).toBeInTheDocument();
  });

  it("handles empty form submission with validation errors", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Instance name is required/)).toBeInTheDocument();
    expect(await screen.findByText(/Secret Field is required/)).toBeInTheDocument();
  });
});
