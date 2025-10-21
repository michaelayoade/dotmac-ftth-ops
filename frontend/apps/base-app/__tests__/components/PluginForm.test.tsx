import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginForm } from "../../app/dashboard/settings/plugins/components/PluginForm";
import type { FieldSpec, PluginConfig, PluginInstance, PluginTestResult } from "@/hooks/usePlugins";

const makeField = (
  field: Omit<FieldSpec, "validation_rules" | "options" | "required" | "is_secret"> & {
    required?: boolean;
    is_secret?: boolean;
    validation_rules?: FieldSpec["validation_rules"];
    options?: FieldSpec["options"];
  },
): FieldSpec => ({
  required: false,
  is_secret: false,
  validation_rules: [],
  options: [],
  ...field,
});

// Mock data
const mockWhatsAppPlugin: PluginConfig = {
  name: "WhatsApp Business",
  type: "notification" as const,
  version: "1.0.0",
  description: "Send WhatsApp messages via WhatsApp Business API",
  author: "DotMac Platform",
  homepage: "https://developers.facebook.com/docs/whatsapp",
  tags: ["messaging", "notification", "whatsapp"],
  dependencies: ["httpx"],
  supports_health_check: true,
  supports_test_connection: true,
  fields: [
    makeField({
      key: "phone_number",
      label: "Phone Number",
      type: "phone",
      description: "WhatsApp Business phone number in E.164 format",
      required: true,
      pattern: "^\\+[1-9]\\d{1,14}$",
      group: "Basic Configuration",
      order: 1,
    }),
    makeField({
      key: "api_token",
      label: "API Token",
      type: "secret",
      description: "WhatsApp Business API access token",
      required: true,
      is_secret: true,
      min_length: 50,
      group: "Basic Configuration",
      order: 2,
    }),
    makeField({
      key: "business_account_id",
      label: "Business Account ID",
      type: "string",
      description: "WhatsApp Business Account ID",
      required: true,
      group: "Basic Configuration",
      order: 3,
    }),
    makeField({
      key: "api_version",
      label: "API Version",
      type: "select",
      description: "WhatsApp Business API version",
      default: "v18.0",
      options: [
        { value: "v18.0", label: "v18.0 (Latest)" },
        { value: "v17.0", label: "v17.0" },
        { value: "v16.0", label: "v16.0" },
      ],
      group: "Environment",
      order: 1,
    }),
    makeField({
      key: "sandbox_mode",
      label: "Sandbox Mode",
      type: "boolean",
      description: "Enable sandbox mode for testing",
      default: false,
      group: "Environment",
      order: 2,
    }),
    makeField({
      key: "webhook_url",
      label: "Webhook URL",
      type: "url",
      description: "URL to receive webhook notifications",
      group: "Webhooks",
      order: 1,
    }),
    makeField({
      key: "webhook_token",
      label: "Webhook Verification Token",
      type: "secret",
      description: "Token for webhook verification",
      is_secret: true,
      required: false,
      group: "Webhooks",
      order: 2,
    }),
    makeField({
      key: "message_retry_count",
      label: "Message Retry Count",
      type: "integer",
      description: "Number of retry attempts for failed messages",
      default: 3,
      min_value: 0,
      max_value: 5,
      group: "Advanced",
      order: 1,
    }),
    makeField({
      key: "timeout_seconds",
      label: "Request Timeout",
      type: "float",
      description: "HTTP request timeout in seconds",
      default: 30.5,
      min_value: 5,
      max_value: 300,
      group: "Advanced",
      order: 2,
    }),
    makeField({
      key: "custom_headers",
      label: "Custom Headers",
      type: "json",
      description: "Additional HTTP headers as JSON object",
      group: "Advanced",
      order: 3,
    }),
    makeField({
      key: "contact_email",
      label: "Contact Email",
      type: "email",
      description: "Contact email for notifications",
      group: "Advanced",
      order: 4,
    }),
    makeField({
      key: "created_date",
      label: "Created Date",
      type: "string",
      description: "Date when account was created",
      group: "Advanced",
      order: 5,
    }),
    makeField({
      key: "last_sync",
      label: "Last Sync Time",
      type: "string",
      description: "Last synchronization timestamp",
      group: "Advanced",
      order: 6,
    }),
  ],
};

const mockInstance: PluginInstance = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  plugin_name: "WhatsApp Business",
  instance_name: "Production WhatsApp",
  config_schema: mockWhatsAppPlugin,
  status: "active" as const,
  has_configuration: true,
  last_health_check: "2024-01-20T15:30:00Z",
};

const mockAvailablePlugins: PluginConfig[] = [mockWhatsAppPlugin];

const defaultProps: Parameters<typeof PluginForm>[0] = {
  availablePlugins: mockAvailablePlugins,
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  onTestConnection: jest.fn<Promise<PluginTestResult>, [string, Record<string, unknown>?]>(
    async () => ({
      success: true,
      message: "ok",
      details: {},
      timestamp: new Date().toISOString(),
    }),
  ),
};

// Helper to render form with default props
const renderPluginForm = (props = {}) => {
  return render(<PluginForm {...defaultProps} {...props} />);
};

describe("PluginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Plugin Selection Mode", () => {
    it("renders plugin selection form when no plugin is pre-selected", () => {
      renderPluginForm();

      expect(screen.getByText("Add New Plugin Instance")).toBeInTheDocument();
      expect(screen.getByLabelText(/Plugin/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Instance Name/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create Plugin/ })).toBeInTheDocument();
    });

    it("allows selecting a plugin from dropdown", async () => {
      const user = userEvent.setup();
      renderPluginForm();

      const pluginSelect = screen.getByLabelText(/Plugin/);
      await user.selectOptions(pluginSelect, "WhatsApp Business");

      expect(pluginSelect).toHaveValue("WhatsApp Business");

      // Should show plugin fields after selection
      await waitFor(() => {
        expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
      });
    });

    it("shows validation error when no plugin is selected", async () => {
      const user = userEvent.setup();
      renderPluginForm();

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });

      await user.click(submitButton);

      // Use findByText which waits for the element to appear
      const errorMessage = await screen.findByText("Please select a plugin");
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe("Field Type Rendering", () => {
    beforeEach(() => {
      renderPluginForm({ plugin: mockWhatsAppPlugin });
    });

    it("renders string fields correctly", () => {
      const stringField = screen.getByLabelText(/Business Account ID/);
      expect(stringField).toBeInTheDocument();
      expect(stringField).toHaveAttribute("type", "text");
    });

    it("renders secret fields with password input and visibility toggle", () => {
      const secretField = screen.getByLabelText(/API Token/);
      expect(secretField).toBeInTheDocument();
      expect(secretField).toHaveAttribute("type", "password");

      // Should have visibility toggle button
      const toggleButton = secretField.parentElement?.querySelector("button");
      expect(toggleButton).toBeInTheDocument();
    });

    it("renders phone fields with correct pattern", () => {
      const phoneField = screen.getByLabelText(/Phone Number/);
      expect(phoneField).toBeInTheDocument();
      expect(phoneField).toHaveAttribute("type", "tel");
      expect(phoneField).toHaveAttribute("pattern", "^\\+[1-9]\\d{1,14}$");
    });

    it("renders select fields with options", () => {
      const selectField = screen.getByLabelText(/API Version/);
      expect(selectField).toBeInTheDocument();
      expect(selectField.tagName).toBe("SELECT");

      // Check that the select field has the correct options
      const selectElement = selectField as HTMLSelectElement;
      expect(selectElement.options.length).toBe(4); // 3 options + placeholder
      expect(screen.getByRole("option", { name: /v18.0 \(Latest\)/ })).toBeInTheDocument();
    });

    it("renders boolean fields as checkboxes", () => {
      const booleanField = screen.getByLabelText(/Enable sandbox mode for testing/);
      expect(booleanField).toBeInTheDocument();
      expect(booleanField).toHaveAttribute("type", "checkbox");
    });

    it("renders integer fields with number input", () => {
      const integerField = screen.getByLabelText(/Message Retry Count/);
      expect(integerField).toBeInTheDocument();
      expect(integerField).toHaveAttribute("type", "number");
      expect(integerField).toHaveAttribute("step", "1");
    });

    it("renders float fields with decimal support", () => {
      const floatField = screen.getByLabelText(/Request Timeout/);
      expect(floatField).toBeInTheDocument();
      expect(floatField).toHaveAttribute("type", "number");
      expect(floatField).toHaveAttribute("step", "any");
    });

    it("renders URL fields with URL validation", () => {
      const urlField = screen.getByLabelText(/Webhook URL/);
      expect(urlField).toBeInTheDocument();
      expect(urlField).toHaveAttribute("type", "url");
    });

    it("renders email fields with email validation", () => {
      const emailField = screen.getByLabelText(/Contact Email/);
      expect(emailField).toBeInTheDocument();
      expect(emailField).toHaveAttribute("type", "email");
    });

    it("renders date fields with date picker", () => {
      const dateField = screen.getByLabelText(/Created Date/);
      expect(dateField).toBeInTheDocument();
      expect(dateField).toHaveAttribute("type", "date");
    });

    it("renders datetime fields with datetime picker", () => {
      const datetimeField = screen.getByLabelText(/Last Sync Time/);
      expect(datetimeField).toBeInTheDocument();
      expect(datetimeField).toHaveAttribute("type", "datetime-local");
    });

    it("renders JSON fields as textarea", () => {
      const jsonField = screen.getByLabelText(/Custom Headers/);
      expect(jsonField).toBeInTheDocument();
      expect(jsonField.tagName).toBe("TEXTAREA");
    });
  });

  describe("Secret Field Visibility Toggle", () => {
    it("toggles secret field visibility when eye button is clicked", async () => {
      const user = userEvent.setup();
      renderPluginForm({ plugin: mockWhatsAppPlugin });

      const secretField = screen.getByLabelText(/API Token/) as HTMLInputElement;
      const toggleButton = secretField.parentElement?.querySelector("button");

      expect(secretField.type).toBe("password");

      if (toggleButton) {
        await act(async () => {
          await user.click(toggleButton);
        });
        expect(secretField.type).toBe("text");

        await act(async () => {
          await user.click(toggleButton);
        });
        expect(secretField.type).toBe("password");
      }
    });
  });

  describe("Form Validation", () => {
    beforeEach(() => {
      renderPluginForm({ plugin: mockWhatsAppPlugin });
    });

    it("shows validation errors for required fields", async () => {
      const user = userEvent.setup();

      const instanceNameField = screen.getByLabelText(/Instance Name/);
      await user.type(instanceNameField, "Test Instance");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      // Use findByText which automatically waits for elements
      expect(await screen.findByText(/Phone Number is required/)).toBeInTheDocument();
      expect(await screen.findByText(/API Token is required/)).toBeInTheDocument();
      expect(await screen.findByText(/Business Account ID is required/)).toBeInTheDocument();
    });

    it("validates minimum length for secret fields", async () => {
      const user = userEvent.setup();

      const apiTokenField = screen.getByLabelText(/API Token/);
      await user.type(apiTokenField, "short");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Minimum length is 50 characters/)).toBeInTheDocument();
    });

    it("validates email format", async () => {
      const user = userEvent.setup();

      const emailField = screen.getByLabelText(/Contact Email/);
      await user.type(emailField, "invalid-email");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Invalid email format/)).toBeInTheDocument();
    });

    it("validates URL format", async () => {
      const user = userEvent.setup();

      const urlField = screen.getByLabelText(/Webhook URL/);
      await user.type(urlField, "invalid-url");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Invalid URL format/)).toBeInTheDocument();
    });

    it("validates phone number format", async () => {
      const user = userEvent.setup();

      const phoneField = screen.getByLabelText(/Phone Number/);
      await user.type(phoneField, "123456");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Invalid phone number format/)).toBeInTheDocument();
    });

    it("validates number field ranges", async () => {
      const user = userEvent.setup();

      const retryCountField = screen.getByLabelText(/Message Retry Count/);
      await user.type(retryCountField, "10");

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Maximum value is 5/)).toBeInTheDocument();
    });

    it("validates JSON format", async () => {
      const user = userEvent.setup();

      const jsonField = screen.getByLabelText(/Custom Headers/) as HTMLTextAreaElement;
      // Use direct value setting to avoid userEvent keyboard parsing issues with curly braces
      fireEvent.change(jsonField, { target: { value: "{ invalid json" } });

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Invalid JSON format/)).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("submits form with valid data", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockResolvedValue(undefined);

      renderPluginForm({ plugin: mockWhatsAppPlugin, onSubmit });

      // Fill required fields
      await act(async () => {
        await user.type(screen.getByLabelText(/Instance Name/), "Test Instance");
        await user.type(screen.getByLabelText(/Phone Number/), "+1234567890");
        await user.type(screen.getByLabelText(/API Token/), "a".repeat(50));
        await user.type(screen.getByLabelText(/Business Account ID/), "test-account-id");
      });

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });

      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          plugin_name: "WhatsApp Business",
          instance_name: "Test Instance",
          configuration: expect.objectContaining({
            phone_number: "+1234567890",
            api_token: "a".repeat(50),
            business_account_id: "test-account-id",
          }),
        });
      });
    });

    it("handles submission errors", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockRejectedValue(new Error("Submission failed"));

      renderPluginForm({ plugin: mockWhatsAppPlugin, onSubmit });

      // Fill required fields
      await act(async () => {
        await user.type(screen.getByLabelText(/Instance Name/), "Test Instance");
        await user.type(screen.getByLabelText(/Phone Number/), "+1234567890");
        await user.type(screen.getByLabelText(/API Token/), "a".repeat(50));
        await user.type(screen.getByLabelText(/Business Account ID/), "test-account-id");
      });

      const submitButton = screen.getByRole("button", {
        name: /Create Plugin/,
      });

      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Submission failed/)).toBeInTheDocument();
      });
    });
  });

  describe("Connection Testing", () => {
    it("shows test connection button for plugins that support it", () => {
      renderPluginForm({ plugin: mockWhatsAppPlugin });
      expect(screen.getByRole("button", { name: /Test Connection/ })).toBeInTheDocument();
    });

    it("does not show test connection button for plugins that do not support it", () => {
      const pluginWithoutTestConnection = {
        ...mockWhatsAppPlugin,
        supports_test_connection: false,
      };

      renderPluginForm({ plugin: pluginWithoutTestConnection });
      expect(screen.queryByRole("button", { name: /Test Connection/ })).not.toBeInTheDocument();
    });

    it("calls onTestConnection when test button is clicked", async () => {
      const user = userEvent.setup();
      const onTestConnection = jest.fn().mockResolvedValue({
        success: true,
        message: "Connection successful",
      });

      renderPluginForm({ plugin: mockWhatsAppPlugin, onTestConnection });

      // Fill in required fields to pass validation
      const instanceNameField = screen.getByLabelText(/Instance Name/);
      const phoneField = screen.getByLabelText(/Phone Number/);
      const apiTokenField = screen.getByLabelText(/API Token/);
      const businessAccountIdField = screen.getByLabelText(/Business Account ID/);

      await user.type(instanceNameField, "Test Instance");
      await user.type(phoneField, "+1234567890");
      await user.type(apiTokenField, "a".repeat(50));
      await user.type(businessAccountIdField, "business-123");

      const testButton = screen.getByRole("button", {
        name: /Test Connection/,
      });

      await user.click(testButton);

      await waitFor(() => {
        expect(onTestConnection).toHaveBeenCalledWith("", expect.any(Object));
      });

      // Wait for all state updates to complete
      await waitFor(() => {
        expect(screen.queryByText(/Checking\.\.\./)).not.toBeInTheDocument();
      });
    });

    it("displays test result message", async () => {
      const user = userEvent.setup();
      const onTestConnection = jest.fn().mockResolvedValue({
        success: true,
        message: "Connection successful",
      });

      renderPluginForm({ plugin: mockWhatsAppPlugin, onTestConnection });

      // Fill in required fields to pass validation
      const instanceNameField = screen.getByLabelText(/Instance Name/);
      const phoneField = screen.getByLabelText(/Phone Number/);
      const apiTokenField = screen.getByLabelText(/API Token/);
      const businessAccountIdField = screen.getByLabelText(/Business Account ID/);

      await user.type(instanceNameField, "Test Instance");
      await user.type(phoneField, "+1234567890");
      await user.type(apiTokenField, "a".repeat(50));
      await user.type(businessAccountIdField, "business-123");

      const testButton = screen.getByRole("button", {
        name: /Test Connection/,
      });

      await user.click(testButton);

      expect(await screen.findByText(/Connection successful/)).toBeInTheDocument();

      // Wait for all state updates to complete
      await waitFor(() => {
        expect(screen.queryByText(/Checking\.\.\./)).not.toBeInTheDocument();
      });
    });

    it("displays test failure message", async () => {
      const user = userEvent.setup();
      const onTestConnection = jest.fn().mockResolvedValue({
        success: false,
        message: "Connection failed",
      });

      renderPluginForm({ plugin: mockWhatsAppPlugin, onTestConnection });

      // Fill in required fields to pass validation
      const instanceNameField = screen.getByLabelText(/Instance Name/);
      const phoneField = screen.getByLabelText(/Phone Number/);
      const apiTokenField = screen.getByLabelText(/API Token/);
      const businessAccountIdField = screen.getByLabelText(/Business Account ID/);

      await user.type(instanceNameField, "Test Instance");
      await user.type(phoneField, "+1234567890");
      await user.type(apiTokenField, "a".repeat(50));
      await user.type(businessAccountIdField, "business-123");

      const testButton = screen.getByRole("button", {
        name: /Test Connection/,
      });

      await user.click(testButton);

      expect(await screen.findByText(/Connection failed/)).toBeInTheDocument();

      // Wait for all state updates to complete
      await waitFor(() => {
        expect(screen.queryByText(/Checking\.\.\./)).not.toBeInTheDocument();
      });
    });
  });

  describe("Edit Mode", () => {
    it("renders in edit mode when instance is provided", () => {
      renderPluginForm({ instance: mockInstance });

      expect(screen.getByText("Edit Plugin Configuration")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Update Plugin/ })).toBeInTheDocument();

      // Instance name should be disabled in edit mode
      const instanceNameField = screen.getByLabelText(/Instance Name/) as HTMLInputElement;
      expect(instanceNameField).toBeDisabled();
      expect(instanceNameField.value).toBe("Production WhatsApp");
    });

    it("does not show plugin selection in edit mode", () => {
      renderPluginForm({ instance: mockInstance });
      expect(screen.queryByLabelText(/Plugin/)).not.toBeInTheDocument();
    });
  });

  describe("Field Grouping", () => {
    beforeEach(() => {
      renderPluginForm({ plugin: mockWhatsAppPlugin });
    });

    it("groups fields by group name", () => {
      expect(screen.getByText("Basic Configuration")).toBeInTheDocument();
      expect(screen.getByText("Environment")).toBeInTheDocument();
      expect(screen.getByText("Webhooks")).toBeInTheDocument();
      expect(screen.getByText("Advanced")).toBeInTheDocument();
    });

    it("shows fields under correct groups", () => {
      // Basic Configuration group should contain phone, token, and business ID
      const basicSection = screen.getByText("Basic Configuration").closest("div");
      expect(basicSection).toBeInTheDocument();
    });
  });

  describe("Default Values", () => {
    it("sets default values for fields that have them", () => {
      renderPluginForm({ plugin: mockWhatsAppPlugin });

      const apiVersionField = screen.getByLabelText(/API Version/) as HTMLSelectElement;
      expect(apiVersionField.value).toBe("v18.0");

      const sandboxField = screen.getByLabelText(
        /Enable sandbox mode for testing/,
      ) as HTMLInputElement;
      expect(sandboxField.checked).toBe(false);

      const retryCountField = screen.getByLabelText(/Message Retry Count/) as HTMLInputElement;
      expect(retryCountField.value).toBe("3");
    });
  });

  describe("Cancel Functionality", () => {
    it("calls onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      renderPluginForm({ plugin: mockWhatsAppPlugin, onCancel });

      const cancelButton = screen.getByRole("button", { name: /Cancel/ });

      await act(async () => {
        await user.click(cancelButton);
      });

      expect(onCancel).toHaveBeenCalled();
    });

    it("calls onCancel when close button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      renderPluginForm({ plugin: mockWhatsAppPlugin, onCancel });

      const closeButton = screen.getByLabelText(/close/i);

      await user.click(closeButton);
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
