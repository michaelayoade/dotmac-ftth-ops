import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginForm } from "../../app/dashboard/settings/plugins/components/PluginForm";

const mockPlugin = {
  name: "Test Plugin",
  type: "integration" as const,
  version: "1.0.0",
  description: "Test plugin for coverage",
  supports_health_check: true,
  supports_test_connection: true,
  fields: [
    {
      key: "test_string",
      label: "Test String",
      type: "string" as const,
      description: "Test string field",
      required: false,
      min_length: 5,
      max_length: 20,
    },
    {
      key: "test_file",
      label: "Test File",
      type: "file" as const,
      description: "Test file upload",
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

describe("PluginForm Extended Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles file upload field", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    // Create a fake file
    const file = new File(["test content"], "test.txt", { type: "text/plain" });

    // Mock FileReader
    const originalFileReader = global.FileReader;
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: null,
      result: "data:text/plain;base64,dGVzdCBjb250ZW50",
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    await user.upload(fileInput, file);

    // Simulate FileReader onload
    act(() => {
      if (mockFileReader.onload) {
        (mockFileReader.onload as any)({} as any);
      }
    });

    global.FileReader = originalFileReader;
  });

  it("validates string field length constraints", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test");

    const stringField = screen.getByLabelText(/Test String/);
    await user.type(stringField, "abc"); // Too short (min 5)

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Minimum length is 5 characters/)).toBeInTheDocument();
    });
  });

  it("validates string field max length", async () => {
    const user = userEvent.setup();
    render(<PluginForm {...defaultProps} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test");

    const stringField = screen.getByLabelText(/Test String/) as HTMLInputElement;
    // Use fireEvent to bypass HTML maxLength attribute
    fireEvent.change(stringField, { target: { value: "a".repeat(25) } }); // Too long (max 20)

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    expect(await screen.findByText(/Maximum length is 20 characters/)).toBeInTheDocument();
  });

  it("handles JSON field parsing correctly", async () => {
    const pluginWithJson = {
      ...mockPlugin,
      fields: [
        {
          key: "json_field",
          label: "JSON Field",
          type: "json" as const,
          description: "Test JSON field",
          required: false,
        },
      ],
    };

    render(<PluginForm {...defaultProps} plugin={pluginWithJson} />);

    const jsonField = screen.getByLabelText(/JSON Field/) as HTMLTextAreaElement;

    // Use fireEvent to avoid userEvent keyboard parsing issues with curly braces
    const jsonValue = '{"key": "value"}';
    fireEvent.change(jsonField, { target: { value: jsonValue } });

    // Verify the field accepts the input (may be formatted)
    expect(jsonField.value).toContain("key");
    expect(jsonField.value).toContain("value");
  });

  it("handles non-plugin-provided case", async () => {
    const user = userEvent.setup();

    render(<PluginForm {...defaultProps} plugin={null} />);

    // Should show plugin selection
    expect(screen.getByLabelText(/Plugin/)).toBeInTheDocument();

    // Select a plugin
    const pluginSelect = screen.getByLabelText(/Plugin/);
    await user.selectOptions(pluginSelect, "Test Plugin");

    await waitFor(() => {
      expect(screen.getByLabelText(/Test String/)).toBeInTheDocument();
    });
  });

  it("handles connection test error", async () => {
    const user = userEvent.setup();
    const onTestConnection = jest.fn().mockRejectedValue(new Error("Test failed"));

    render(<PluginForm {...defaultProps} onTestConnection={onTestConnection} />);

    // Fill in required fields to pass validation
    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test Instance");

    const testButton = screen.getByRole("button", { name: /Test Connection/ });
    await user.click(testButton);

    expect(await screen.findByText(/Test failed/)).toBeInTheDocument();
  });

  it("handles configuration validation edge cases", async () => {
    const user = userEvent.setup();

    const pluginWithComplexValidation = {
      ...mockPlugin,
      fields: [
        {
          key: "integer_field",
          label: "Integer Field",
          type: "integer" as const,
          required: false,
          min_value: 5,
          max_value: 10,
        },
        {
          key: "float_field",
          label: "Float Field",
          type: "float" as const,
          required: false,
          min_value: 1.5,
          max_value: 5.5,
        },
      ],
    };

    render(<PluginForm {...defaultProps} plugin={pluginWithComplexValidation} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test");

    // Test integer bounds
    const intField = screen.getByLabelText(/Integer Field/);
    await user.type(intField, "15"); // Above max

    // Test float bounds
    const floatField = screen.getByLabelText(/Float Field/);
    await user.type(floatField, "0.5"); // Below min

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Maximum value is 10/)).toBeInTheDocument();
      expect(screen.getByText(/Minimum value is 1.5/)).toBeInTheDocument();
    });
  });

  it("clears field errors when values are corrected", async () => {
    const user = userEvent.setup();

    const pluginWithRequired = {
      ...mockPlugin,
      fields: [
        {
          key: "required_field",
          label: "Required Field",
          type: "string" as const,
          required: true,
        },
      ],
    };

    render(<PluginForm {...defaultProps} plugin={pluginWithRequired} />);

    const instanceNameField = screen.getByLabelText(/Instance Name/);
    await user.type(instanceNameField, "Test");

    // Submit without required field to trigger error
    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Required Field is required/)).toBeInTheDocument();
    });

    // Now fill the required field
    const requiredField = screen.getByLabelText(/Required Field/);
    await user.type(requiredField, "test value");

    // Error should clear
    await waitFor(() => {
      expect(screen.queryByText(/Required Field is required/)).not.toBeInTheDocument();
    });
  });

  it("handles default values correctly", () => {
    const pluginWithDefaults = {
      ...mockPlugin,
      fields: [
        {
          key: "default_string",
          label: "Default String",
          type: "string" as const,
          default: "default value",
        },
        {
          key: "default_boolean",
          label: "Default Boolean",
          type: "boolean" as const,
          default: true,
        },
        {
          key: "default_integer",
          label: "Default Integer",
          type: "integer" as const,
          default: 42,
        },
      ],
    };

    render(<PluginForm {...defaultProps} plugin={pluginWithDefaults} />);

    const stringField = screen.getByLabelText(/Default String/) as HTMLInputElement;
    expect(stringField.value).toBe("default value");

    const booleanField = screen.getByLabelText(/Default Boolean/) as HTMLInputElement;
    expect(booleanField.checked).toBe(true);

    const integerField = screen.getByLabelText(/Default Integer/) as HTMLInputElement;
    expect(integerField.value).toBe("42");
  });
});
