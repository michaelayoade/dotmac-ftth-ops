"use client";

import { useState, useEffect } from "react";
import {
  X,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Upload,
  Calendar,
  Clock,
} from "lucide-react";
import type { FieldSpec, PluginConfig, PluginInstance, PluginTestResult } from "@/hooks/usePlugins";

type ExtendedFieldSpec = Omit<FieldSpec, "type"> & {
  type: FieldSpec["type"] | "date" | "datetime" | "file";
};

const valueOrUndefined = <T,>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined ? undefined : value;

interface PluginFormProps {
  plugin?: PluginConfig | null;
  instance?: PluginInstance;
  availablePlugins: PluginConfig[];
  onSubmit: (data: {
    plugin_name: string;
    instance_name: string;
    configuration: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
  onTestConnection: (
    instanceId: string,
    testConfig?: Record<string, unknown>,
  ) => Promise<PluginTestResult>;
}

// Dynamic field component
const DynamicField = ({
  field,
  value,
  onChange,
  showSecrets,
  onToggleSecret,
  error,
}: {
  field: ExtendedFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  showSecrets: Record<string, boolean>;
  onToggleSecret: (key: string) => void;
  error?: string | undefined;
}) => {
  const baseInputClasses = `w-full px-3 py-2 bg-accent border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 ${
    error ? "border-rose-500" : "border-border"
  }`;

  const renderField = () => {
    switch (field["type"]) {
      case "string":
        return (
          <input
            id={`field-${field["key"]}`}
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={valueOrUndefined(field["description"])}
            className={baseInputClasses}
            minLength={valueOrUndefined(field["min_length"])}
            maxLength={valueOrUndefined(field["max_length"])}
            pattern={valueOrUndefined(field["pattern"])}
            required={field["required"]}
          />
        );

      case "secret":
        return (
          <div className="relative">
            <input
              id={`field-${field["key"]}`}
              type={showSecrets[field["key"]] ? "text" : "password"}
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter secret value"
              className={`${baseInputClasses} pr-10`}
              minLength={valueOrUndefined(field["min_length"])}
              maxLength={valueOrUndefined(field["max_length"])}
              required={field["required"]}
            />
            <button
              type="button"
              onClick={() => onToggleSecret(field["key"])}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecrets[field["key"]] ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        );

      case "boolean":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id={`field-${field["key"]}`}
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-accent text-sky-500 focus:ring-sky-500"
            />
            <span className="text-sm text-muted-foreground">
              {field["description"] || "Enable this option"}
            </span>
          </label>
        );

      case "integer":
        return (
          <input
            id={`field-${field["key"]}`}
            type="number"
            value={(value as string) || ""}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
            placeholder={valueOrUndefined(field["description"])}
            className={baseInputClasses}
            min={valueOrUndefined(field["min_value"])}
            max={valueOrUndefined(field["max_value"])}
            step={1}
            required={field["required"]}
          />
        );

      case "float":
        return (
          <input
            id={`field-${field["key"]}`}
            type="number"
            value={(value as string) || ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder={valueOrUndefined(field["description"])}
            className={baseInputClasses}
            min={valueOrUndefined(field["min_value"])}
            max={valueOrUndefined(field["max_value"])}
            step="any"
            required={field["required"]}
          />
        );

      case "select":
        return (
          <select
            id={`field-${field["key"]}`}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClasses}
            required={field["required"]}
          >
            <option value="">{`Select ${field["label"].toLowerCase()}...`}</option>
            {field["options"]?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "json":
        return (
          <textarea
            id={`field-${field["key"]}`}
            value={
              typeof value === "object" ? JSON.stringify(value, null, 2) : (value as string) || ""
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                onChange(e.target.value);
              }
            }}
            placeholder='{"key": "value"}'
            rows={4}
            className={`${baseInputClasses} font-mono text-sm`}
            required={field["required"]}
          />
        );

      case "url":
        return (
          <input
            id={`field-${field["key"]}`}
            type="url"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com"
            className={baseInputClasses}
            required={field["required"]}
          />
        );

      case "email":
        return (
          <input
            id={`field-${field["key"]}`}
            type="email"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="user@example.com"
            className={baseInputClasses}
            required={field["required"]}
          />
        );

      case "phone":
        return (
          <input
            id={`field-${field["key"]}`}
            type="tel"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="+1234567890"
            className={baseInputClasses}
            minLength={valueOrUndefined(field["min_length"])}
            maxLength={valueOrUndefined(field["max_length"])}
            pattern={valueOrUndefined(field["pattern"]) ?? "^\\+[1-9]\\d{1,14}$"}
            required={field["required"]}
          />
        );

      case "date":
        return (
          <div className="relative">
            <input
              id={`field-${field["key"]}`}
              type="date"
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
              className={`${baseInputClasses} pr-10`}
              required={field["required"]}
            />
            <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        );

      case "datetime":
        return (
          <div className="relative">
            <input
              id={`field-${field["key"]}`}
              type="datetime-local"
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
              className={`${baseInputClasses} pr-10`}
              required={field["required"]}
            />
            <Clock className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        );

      case "file":
        return (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => onChange(reader.result);
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
                id={`file-${field["key"]}`}
                required={field["required"]}
              />
              <label
                htmlFor={`file-${field["key"]}`}
                className={`${baseInputClasses} cursor-pointer flex items-center gap-2 hover:bg-muted`}
              >
                <Upload className="h-4 w-4" />
                {value ? "File selected" : "Choose file..."}
              </label>
            </div>
            {value && typeof value === "string" ? (
              <div className="text-xs text-muted-foreground truncate">{value.slice(0, 50)}...</div>
            ) : null}
          </div>
        );

      default:
        return (
          <input
            id={`field-${field["key"]}`}
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={valueOrUndefined(field["description"])}
            className={baseInputClasses}
            required={field["required"]}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <label
        htmlFor={`field-${field["key"]}`}
        className="block text-sm font-medium text-muted-foreground"
      >
        {field["label"]}
        {field["required"] && <span className="text-rose-400 ml-1">*</span>}
        {field["is_secret"] && <span className="text-amber-400 ml-1 text-xs">(Secret)</span>}
      </label>
      {field["description"] && field["type"] !== "boolean" && (
        <p className="text-xs text-muted-foreground">{field["description"]}</p>
      )}
      {renderField()}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {field["validation_rules"].length > 0 && (
        <div className="text-xs text-muted-foreground">
          <ul className="list-disc list-inside space-y-0.5">
            {field["validation_rules"].map((rule, index) => {
              const ruleText =
                rule.message ??
                [rule.type, rule.value !== undefined ? String(rule.value) : null]
                  .filter(Boolean)
                  .join(": ");
              return <li key={index}>{ruleText}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export const PluginForm = ({
  plugin,
  instance,
  availablePlugins,
  onSubmit,
  onCancel,
  onTestConnection,
}: PluginFormProps) => {
  const [selectedPlugin, setSelectedPlugin] = useState<PluginConfig | null>(plugin || null);
  const [instanceName, setInstanceName] = useState(instance?.instance_name || "");
  const [configuration, setConfiguration] = useState<Record<string, any>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PluginTestResult | null>(null);

  // Initialize configuration from instance if editing
  useEffect(() => {
    if (instance && instance.has_configuration) {
      // Load existing configuration (would need API call to get unmasked values for editing)
      const defaultConfig: Record<string, any> = {};
      instance.config_schema.fields.forEach((field) => {
        if (field["default"] !== undefined) {
          defaultConfig[field["key"]] = field["default"];
        }
      });
      setConfiguration(defaultConfig);
    } else if (selectedPlugin) {
      // Set default values
      const defaultConfig: Record<string, any> = {};
      selectedPlugin.fields.forEach((field) => {
        if (field["default"] !== undefined) {
          defaultConfig[field["key"]] = field["default"];
        }
      });
      setConfiguration(defaultConfig);
    }
  }, [instance, selectedPlugin]);

  const handleConfigChange = (key: string, value: unknown) => {
    setConfiguration((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedPlugin) {
      newErrors["plugin"] = "Please select a plugin";
      setErrors(newErrors);
      return false;
    }

    if (!instanceName.trim()) {
      newErrors["instanceName"] = "Instance name is required";
    }

    // Validate each field
    selectedPlugin.fields.forEach((field) => {
      const value = configuration[field["key"]];

      if (field["required"] && (value === undefined || value === null || value === "")) {
        newErrors[field["key"]] = `${field["label"]} is required`;
        return;
      }

      if (value !== undefined && value !== null && value !== "") {
        // Type-specific validation
        if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors[field["key"]] = "Invalid email format";
        }

        if (field.type === "url" && value && !/^https?:\/\/.+/.test(value)) {
          newErrors[field["key"]] = "Invalid URL format";
        }

        if (
          field.type === "phone" &&
          value &&
          field["pattern"] &&
          !new RegExp(field["pattern"]).test(value)
        ) {
          newErrors[field["key"]] = "Invalid phone number format";
        }

        if (field["min_length"] != null && value["length"] < field["min_length"]) {
          newErrors[field["key"]] = `Minimum length is ${field["min_length"]} characters`;
        }

        if (field["max_length"] != null && value["length"] > field["max_length"]) {
          newErrors[field["key"]] = `Maximum length is ${field["max_length"]} characters`;
        }

        if (field.type === "integer" || field.type === "float") {
          const num = Number(value);
          if (field["min_value"] != null && num < field["min_value"]) {
            newErrors[field["key"]] = `Minimum value is ${field["min_value"]}`;
          }
          if (field["max_value"] != null && num > field["max_value"]) {
            newErrors[field["key"]] = `Maximum value is ${field["max_value"]}`;
          }
        }

        if (field.type === "json" && typeof value === "string") {
          try {
            JSON.parse(value);
          } catch {
            newErrors[field["key"]] = "Invalid JSON format";
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        plugin_name: selectedPlugin!.name,
        instance_name: instanceName,
        configuration,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error["message"] : "Failed to submit form";
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPlugin || !validateForm()) {
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await onTestConnection(instance?.id ?? "", configuration);
      setTestResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error["message"] : "Connection test failed";
      setTestResult({
        success: false,
        message: errorMessage,
        details: {},
        timestamp: new Date().toISOString(),
        response_time_ms: null,
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group fields by group
  const groupedFields =
    (selectedPlugin?.fields as ExtendedFieldSpec[] | undefined)?.reduce(
      (groups, field) => {
        const group = field["group"] || "Configuration";
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(field);
        return groups;
      },
      {} as Record<string, ExtendedFieldSpec[]>,
    ) ?? {};

  return (
    <div className="fixed inset-0 bg-card/75 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {instance ? "Edit Plugin Configuration" : "Add New Plugin Instance"}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col max-h-[calc(90vh-80px)]"
          data-testid="plugin-form"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Plugin Selection */}
            {!instance && (
              <div className="space-y-2">
                <label
                  htmlFor="plugin-select"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  Plugin <span className="text-rose-400">*</span>
                </label>
                <select
                  id="plugin-select"
                  value={selectedPlugin?.name || ""}
                  onChange={(e) => {
                    const plugin = availablePlugins.find((p) => p.name === e.target.value);
                    setSelectedPlugin(plugin || null);
                    setConfiguration({});
                  }}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  <option value="">Select a plugin...</option>
                  {availablePlugins.map((plugin) => (
                    <option key={plugin["name"]} value={plugin["name"]}>
                      {plugin["name"]} - {plugin["description"]}
                    </option>
                  ))}
                </select>
                {errors["plugin"] && <p className="text-xs text-rose-400">{errors["plugin"]}</p>}
              </div>
            )}

            {/* Instance Name */}
            <div className="space-y-2">
              <label
                htmlFor="instance-name"
                className="block text-sm font-medium text-muted-foreground"
              >
                Instance Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="instance-name"
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="My Plugin Instance"
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
                disabled={!!instance}
              />
              {errors["instanceName"] && (
                <p className="text-xs text-rose-400">{errors["instanceName"]}</p>
              )}
            </div>

            {/* Plugin Information */}
            {selectedPlugin && (
              <div className="bg-accent/50 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">{selectedPlugin.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{selectedPlugin.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Version: {selectedPlugin.version}</span>
                  {selectedPlugin.author && <span>By: {selectedPlugin.author}</span>}
                  <span>Type: {selectedPlugin.type}</span>
                </div>
                {selectedPlugin.tags && (
                  <div className="flex items-center gap-1 mt-2">
                    {selectedPlugin.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-muted text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Configuration Fields */}
            {selectedPlugin &&
              Object.keys(groupedFields).map((groupName) => (
                <div key={groupName} className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground border-b border-border pb-2">
                    {groupName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(groupedFields[groupName] || [])
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((field) => (
                        <div
                          key={field["key"]}
                          className={field.type === "json" ? "md:col-span-2" : ""}
                        >
                          <DynamicField
                            field={field}
                            value={configuration[field["key"]]}
                            onChange={(value) => handleConfigChange(field["key"], value)}
                            showSecrets={showSecrets}
                            onToggleSecret={toggleSecretVisibility}
                            error={errors[field["key"]]}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}

            {/* Test Connection Result */}
            {testResult && (
              <div
                className={`p-4 rounded-lg border ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span
                    className={`text-sm ${
                      testResult.success ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {testResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Error */}
            {errors["submit"] && (
              <div className="p-4 rounded-lg border border-rose-500/20 bg-rose-500/10">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-400" />
                  <span className="text-sm text-rose-400">{errors["submit"]}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            {selectedPlugin?.supports_test_connection && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Test Connection
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-muted text-white rounded-lg transition-colors flex items-center gap-2"
              data-testid="submit-plugin-form"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {instance ? "Update" : "Create"} Plugin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
