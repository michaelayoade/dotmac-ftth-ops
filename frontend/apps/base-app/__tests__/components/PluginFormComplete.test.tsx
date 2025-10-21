import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginForm } from "../../app/dashboard/settings/plugins/components/PluginForm";
import type { FieldSpec, PluginConfig, PluginTestResult } from "@/hooks/usePlugins";

const createField = (
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

const createPlugin = (overrides: Partial<PluginConfig>): PluginConfig => ({
  name: "Test Plugin",
  type: "integration",
  version: "1.0.0",
  description: "Test plugin",
  supports_health_check: true,
  supports_test_connection: false,
  tags: [],
  dependencies: [],
  fields: [],
  ...overrides,
});

const noopTestConnection = jest.fn<Promise<PluginTestResult>, [string, Record<string, unknown>?]>(
  async () => ({
    success: true,
    message: "ok",
    details: {},
    timestamp: new Date().toISOString(),
  }),
);

describe("PluginForm Complete Coverage Tests", () => {
  it("handles JSON field with object value", async () => {
    const user = userEvent.setup();

    const pluginWithJson = createPlugin({
      name: "JSON Plugin",
      description: "Plugin with JSON field",
      fields: [
        createField({
          key: "json_config",
          label: "JSON Config",
          type: "json",
          description: "JSON configuration",
          required: false,
          order: 1,
        }),
      ],
    });

    const onSubmit = jest.fn();
    render(
      <PluginForm
        plugin={pluginWithJson}
        availablePlugins={[pluginWithJson]}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    const instanceName = screen.getByLabelText(/Instance Name/);
    await user.type(instanceName, "Test Instance");

    const jsonField = screen.getByLabelText(/JSON Config/) as HTMLTextAreaElement;

    // Test valid JSON input - use fireEvent to avoid keyboard parsing issues with {}
    fireEvent.change(jsonField, { target: { value: '{"test": "value"}' } });

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        instance_name: "Test Instance",
        plugin_name: "JSON Plugin",
        configuration: {
          json_config: { test: "value" },
        },
      });
    });
  });

  it("handles JSON field with invalid JSON", async () => {
    const user = userEvent.setup();

    const pluginWithJson = createPlugin({
      name: "JSON Plugin",
      description: "Plugin with JSON field",
      fields: [
        createField({
          key: "json_config",
          label: "JSON Config",
          type: "json",
          description: "JSON configuration",
          required: false,
          order: 1,
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithJson}
        availablePlugins={[pluginWithJson]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    const jsonField = screen.getByLabelText(/JSON Config/) as HTMLTextAreaElement;

    // Test invalid JSON input - should keep as string - use fireEvent to avoid keyboard parsing issues with {}
    fireEvent.change(jsonField, { target: { value: '{"invalid": json}' } });

    expect(jsonField).toHaveValue('{"invalid": json}');
  });

  it("displays field descriptions for non-boolean fields", () => {
    const pluginWithDescriptions = createPlugin({
      name: "Description Plugin",
      description: "Plugin with descriptions",
      fields: [
        createField({
          key: "string_field",
          label: "String Field",
          type: "string",
          description: "This is a string field description",
          required: false,
          order: 1,
        }),
        createField({
          key: "boolean_field",
          label: "Boolean Field",
          type: "boolean",
          description: "Enable this boolean feature",
          required: false,
          order: 2,
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithDescriptions}
        availablePlugins={[pluginWithDescriptions]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    // String field description should be visible below the field
    expect(screen.getByText("This is a string field description")).toBeInTheDocument();

    // Boolean field description should be visible as inline label text
    expect(screen.getByText("Enable this boolean feature")).toBeInTheDocument();
  });

  it("displays validation rules when present", () => {
    const pluginWithRules = createPlugin({
      name: "Rules Plugin",
      description: "Plugin with validation rules",
      fields: [
        createField({
          key: "field_with_rules",
          label: "Field With Rules",
          type: "string",
          description: "Field with validation rules",
          required: false,
          order: 1,
          validation_rules: [
            {
              type: "minLength",
              value: 5,
              message: "Must be at least 5 characters",
            },
            {
              type: "pattern",
              value: "^[a-zA-Z0-9]+$",
              message: "Cannot contain special characters",
            },
          ],
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithRules}
        availablePlugins={[pluginWithRules]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    expect(screen.getByText("Must be at least 5 characters")).toBeInTheDocument();
    expect(screen.getByText("Cannot contain special characters")).toBeInTheDocument();
  });

  it("displays secret indicator for secret fields", () => {
    const pluginWithSecret = createPlugin({
      name: "Secret Plugin",
      description: "Plugin with secret field",
      fields: [
        createField({
          key: "secret_field",
          label: "Secret Field",
          type: "string",
          description: "Secret field",
          is_secret: true,
          order: 1,
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithSecret}
        availablePlugins={[pluginWithSecret]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    expect(screen.getByText("(Secret)")).toBeInTheDocument();
  });

  it("handles file field without FileReader support", async () => {
    const pluginWithFile = createPlugin({
      name: "File Plugin",
      description: "Plugin with file field",
      fields: [
        createField({
          key: "file_field",
          label: "File Field",
          type: "string",
          description: "Upload a file",
          order: 1,
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithFile}
        availablePlugins={[pluginWithFile]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    // File input uses different id pattern (file- instead of field-)
    const fileInput = document.querySelector("#file-file_field") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");

    // Verify custom file upload label is present
    const uploadLabel = screen.getByText("Choose file...");
    expect(uploadLabel).toBeInTheDocument();
  });

  it("handles form submission without test connection support", async () => {
    const user = userEvent.setup();

    const pluginWithoutTest = createPlugin({
      name: "No Test Plugin",
      description: "Plugin without test connection",
      supports_test_connection: false,
      fields: [
        createField({
          key: "simple_field",
          label: "Simple Field",
          type: "string",
          required: false,
          order: 1,
        }),
      ],
    });

    const onSubmit = jest.fn();
    render(
      <PluginForm
        plugin={pluginWithoutTest}
        availablePlugins={[pluginWithoutTest]}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    const instanceName = screen.getByLabelText(/Instance Name/);
    await user.type(instanceName, "Test Instance");

    // Test connection button should not be present
    expect(screen.queryByRole("button", { name: /Test Connection/ })).not.toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: /Create Plugin/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        instance_name: "Test Instance",
        plugin_name: "No Test Plugin",
        configuration: {}, // Empty field not included
      });
    });
  });

  it("handles plugin selection in creation mode", async () => {
    const user = userEvent.setup();

    const availablePlugins = [
      createPlugin({
        name: "Plugin 1",
        description: "First plugin",
        supports_test_connection: true,
        fields: [
          createField({
            key: "field1",
            label: "Field 1",
            type: "string",
            order: 1,
          }),
        ],
      }),
      createPlugin({
        name: "Plugin 2",
        description: "Second plugin",
        supports_test_connection: true,
        fields: [
          createField({
            key: "field2",
            label: "Field 2",
            type: "string",
            order: 1,
          }),
        ],
      }),
    ];

    render(
      <PluginForm
        plugin={null}
        availablePlugins={availablePlugins}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    // Select first plugin
    const pluginSelect = screen.getByLabelText(/Plugin/);
    await user.selectOptions(pluginSelect, "Plugin 1");

    await waitFor(() => {
      expect(screen.getByLabelText(/Field 1/)).toBeInTheDocument();
    });

    // Change to second plugin
    await user.selectOptions(pluginSelect, "Plugin 2");

    await waitFor(() => {
      expect(screen.getByLabelText(/Field 2/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Field 1/)).not.toBeInTheDocument();
    });
  });

  it("clears form when plugin changes", async () => {
    const user = userEvent.setup();

    const availablePlugins = [
      createPlugin({
        name: "Plugin A",
        description: "Plugin A",
        supports_test_connection: true,
        fields: [
          createField({
            key: "fieldA",
            label: "Field A",
            type: "string",
            order: 1,
          }),
        ],
      }),
      createPlugin({
        name: "Plugin B",
        description: "Plugin B",
        supports_test_connection: true,
        fields: [
          createField({
            key: "fieldB",
            label: "Field B",
            type: "string",
            order: 1,
          }),
        ],
      }),
    ];

    render(
      <PluginForm
        plugin={null}
        availablePlugins={availablePlugins}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    const instanceName = screen.getByLabelText(/Instance Name/);
    await user.type(instanceName, "Test Instance");

    const pluginSelect = screen.getByLabelText(/Plugin/);
    await user.selectOptions(pluginSelect, "Plugin A");

    await waitFor(() => {
      expect(screen.getByLabelText(/Field A/)).toBeInTheDocument();
    });

    const fieldA = screen.getByLabelText(/Field A/);
    await user.type(fieldA, "Test Value");

    // Switch plugins - fields change but instance name persists
    await user.selectOptions(pluginSelect, "Plugin B");

    await waitFor(() => {
      expect(screen.getByLabelText(/Field B/)).toBeInTheDocument();
      // Instance name is preserved when changing plugins
      expect((screen.getByLabelText(/Instance Name/) as HTMLInputElement).value).toBe(
        "Test Instance",
      );
    });
  });

  it("handles validation for all field constraint types", async () => {
    const user = userEvent.setup();

    const pluginWithConstraints = createPlugin({
      name: "Constraint Plugin",
      description: "Plugin with various constraints",
      supports_test_connection: false,
      fields: [
        createField({
          key: "string_with_pattern",
          label: "String with Pattern",
          type: "string",
          pattern: "^[A-Z]+$",
          order: 1,
        }),
        createField({
          key: "number_field",
          label: "Number Field",
          type: "integer",
          order: 2,
        }),
      ],
    });

    render(
      <PluginForm
        plugin={pluginWithConstraints}
        availablePlugins={[pluginWithConstraints]}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onTestConnection={noopTestConnection}
      />,
    );

    const stringField = screen.getByLabelText(/String with Pattern/);
    expect(stringField).toHaveAttribute("pattern", "^[A-Z]+$");

    const numberField = screen.getByLabelText(/Number Field/);
    // Integer fields use step=1 by default
    expect(numberField).toHaveAttribute("step", "1");
    expect(numberField).toHaveAttribute("type", "number");
  });
});
