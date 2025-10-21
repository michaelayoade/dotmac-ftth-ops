"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";
import { PluginForm } from "../dashboard/settings/plugins/components/PluginForm";
import { PluginCard } from "../dashboard/settings/plugins/components/PluginCard";
import { PluginHealthDashboard } from "../dashboard/settings/plugins/components/PluginHealthDashboard";
import type {
  PluginConfig,
  PluginInstance,
  PluginHealthCheck,
  PluginTestResult,
  FieldSpec,
} from "@/hooks/usePlugins";

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

// Mock data matching our WhatsApp plugin schema
const withDefaults = (
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
    withDefaults({
      key: "phone_number",
      label: "Phone Number",
      type: "phone",
      description: "WhatsApp Business phone number in E.164 format",
      required: true,
      pattern: "^\\+[1-9]\\d{1,14}$",
      group: "Basic Configuration",
      order: 1,
    }),
    withDefaults({
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
    withDefaults({
      key: "business_account_id",
      label: "Business Account ID",
      type: "string",
      description: "WhatsApp Business Account ID",
      required: true,
      group: "Basic Configuration",
      order: 3,
    }),
    withDefaults({
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
    withDefaults({
      key: "sandbox_mode",
      label: "Sandbox Mode",
      type: "boolean",
      description: "Enable sandbox mode for testing",
      default: false,
      group: "Environment",
      order: 2,
    }),
    withDefaults({
      key: "webhook_url",
      label: "Webhook URL",
      type: "url",
      description: "URL to receive webhook notifications",
      group: "Webhooks",
      order: 1,
    }),
    withDefaults({
      key: "webhook_token",
      label: "Webhook Verification Token",
      type: "secret",
      description: "Token for webhook verification",
      is_secret: true,
      group: "Webhooks",
      order: 2,
    }),
    withDefaults({
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
    withDefaults({
      key: "timeout_seconds",
      label: "Request Timeout",
      type: "float",
      description: "HTTP request timeout in seconds",
      default: 30,
      min_value: 5,
      max_value: 300,
      group: "Advanced",
      order: 2,
    }),
    withDefaults({
      key: "custom_headers",
      label: "Custom Headers",
      type: "json",
      description: "Additional HTTP headers as JSON object",
      group: "Advanced",
      order: 3,
    }),
  ],
};

const mockInstances: PluginInstance[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    plugin_name: "WhatsApp Business",
    instance_name: "Production WhatsApp",
    config_schema: mockWhatsAppPlugin,
    status: "active" as const,
    has_configuration: true,
    last_health_check: "2024-01-20T15:30:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    plugin_name: "WhatsApp Business",
    instance_name: "Test WhatsApp",
    config_schema: mockWhatsAppPlugin,
    status: "error" as const,
    has_configuration: true,
    last_error: "Authentication failed: Invalid API token",
  },
];

const mockHealthChecks: PluginHealthCheck[] = [
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440000",
    status: "healthy" as const,
    message: "WhatsApp Business API is accessible and responding normally",
    details: {
      api_accessible: true,
      business_name: "DotMac Corp",
      phone_number_verified: true,
      webhook_configured: true,
      last_message_sent: "2024-01-20T15:25:00Z",
    },
    response_time_ms: 245,
    timestamp: "2024-01-20T15:30:00Z",
  },
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440001",
    status: "error" as const,
    message: "Authentication failed: Invalid or expired API token",
    details: {
      api_accessible: false,
      error: "Token validation failed",
      status_code: 401,
    },
    response_time_ms: 120,
    timestamp: "2024-01-20T15:30:00Z",
  },
];

const mockAvailablePlugins: PluginConfig[] = [mockWhatsAppPlugin];

export default function TestPluginsPage() {
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginConfig | null>(null);
  const [view, setView] = useState<"card" | "form" | "health">("card");

  const handleSubmit = async (data: Record<string, unknown>) => {
    logger.info("Form submitted", { pluginData: data });
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setShowForm(false);
    toast({
      title: "Success",
      description: `Plugin instance "${data.instance_name}" created successfully!`,
    });
  };

  const handleTestConnection = async (
    instanceId: string,
    testConfig?: Record<string, unknown>,
  ): Promise<PluginTestResult> => {
    logger.info("Testing connection", { instanceId, testConfig });
    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      success: true,
      message: "Connection test successful! WhatsApp Business API is accessible.",
      details: {
        business_name: "Test Business",
        api_version: testConfig?.api_version || "v18.0",
      },
      timestamp: new Date().toISOString(),
      response_time_ms: 1250,
    };
  };

  const handleRefresh = async () => {
    logger.info("Refreshing health data");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Plugin UI Test Page</h1>
          <p className="text-muted-foreground">
            Testing the dynamic plugin system with WhatsApp Business API example
          </p>
        </div>

        {/* View Selector */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setView("card")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === "card"
                ? "bg-sky-500 text-white"
                : "bg-accent text-muted-foreground hover:bg-muted"
            }`}
          >
            Plugin Card
          </button>
          <button
            onClick={() => setView("form")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === "form"
                ? "bg-sky-500 text-white"
                : "bg-accent text-muted-foreground hover:bg-muted"
            }`}
          >
            Plugin Form
          </button>
          <button
            onClick={() => setView("health")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === "health"
                ? "bg-sky-500 text-white"
                : "bg-accent text-muted-foreground hover:bg-muted"
            }`}
          >
            Health Dashboard
          </button>
        </div>

        {/* Content */}
        {view === "card" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Plugin Card Component</h2>
            <div className="max-w-md">
              <PluginCard
                plugin={mockWhatsAppPlugin}
                instances={mockInstances}
                onInstall={(plugin) => {
                  setSelectedPlugin(plugin);
                  setShowForm(true);
                }}
              />
            </div>
          </div>
        )}

        {view === "form" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Plugin Form Component</h2>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
            >
              Open Plugin Form
            </button>
          </div>
        )}

        {view === "health" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Plugin Health Dashboard</h2>
            <PluginHealthDashboard
              instances={mockInstances}
              healthChecks={mockHealthChecks}
              onRefresh={handleRefresh}
            />
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <PluginForm
            plugin={selectedPlugin ?? undefined}
            availablePlugins={mockAvailablePlugins}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setSelectedPlugin(null);
            }}
            onTestConnection={handleTestConnection}
          />
        )}

        {/* Field Types Demo */}
        <div className="mt-12 p-6 bg-card/50 border border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Supported Field Types in WhatsApp Plugin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="font-medium text-sky-400">String Fields:</span>
              <p className="text-muted-foreground">Business Account ID</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-amber-400">Secret Fields:</span>
              <p className="text-muted-foreground">API Token, Webhook Token</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-emerald-400">Phone Fields:</span>
              <p className="text-muted-foreground">Phone Number (E.164 format)</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-purple-400">Select Fields:</span>
              <p className="text-muted-foreground">API Version options</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-rose-400">Boolean Fields:</span>
              <p className="text-muted-foreground">Sandbox Mode toggle</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-indigo-400">URL Fields:</span>
              <p className="text-muted-foreground">Webhook URL</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-orange-400">Integer Fields:</span>
              <p className="text-muted-foreground">Retry Count, Timeout</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-teal-400">JSON Fields:</span>
              <p className="text-muted-foreground">Custom Headers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
