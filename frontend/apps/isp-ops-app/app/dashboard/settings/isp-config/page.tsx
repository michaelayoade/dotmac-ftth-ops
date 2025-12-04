"use client";

/**
 * ISP Configuration Settings Page
 *
 * Comprehensive settings management for ISP-specific configuration including:
 * - Subscriber ID generation
 * - RADIUS defaults
 * - Network provisioning
 * - Compliance settings
 * - Portal customization
 * - Localization
 * - SLA configuration
 * - Service defaults
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, useToast } from "@dotmac/ui";
import { Loader2, Save, RotateCcw, Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { httpClient as http } from "@dotmac/http-client";

import { SubscriberIDSettings } from "./components/SubscriberIDSettings";
import { RADIUSSettings } from "./components/RADIUSSettings";
import { NetworkSettings } from "./components/NetworkSettings";
import { ComplianceSettings } from "./components/ComplianceSettings";
import { PortalSettings } from "./components/PortalSettings";
import { LocalizationSettings } from "./components/LocalizationSettings";
import { SLASettings } from "./components/SLASettings";
import { ServiceDefaultsSettings } from "./components/ServiceDefaultsSettings";
import { TaxSettings } from "./components/TaxSettings";
import { BillingSettings } from "./components/BillingSettings";
import { BankAccountSettings } from "./components/BankAccountSettings";
import { ispSettingsSchema, ispSettingsUpdateSchema } from "./validation";
import type { z } from "zod";

export type ISPSettings = z.infer<typeof ispSettingsSchema>;

export default function ISPConfigPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("subscriber-id");
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState<ISPSettings | null>(null);

  // Fetch current settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<ISPSettings>({
    queryKey: ["isp-settings"],
    queryFn: async () => {
      const response = await http.get("/isp-settings");
      return response.data;
    },
  });

  // Update local state when data loads
  if (settings && !localSettings) {
    const parsed = ispSettingsSchema.parse(settings);
    setLocalSettings(parsed);
  }

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<ISPSettings>) => {
      const validated = ispSettingsUpdateSchema.parse(updates);
      const response = await http.put("/isp-settings", {
        updates: validated,
        validate_only: false,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["isp-settings"], data.settings);
      setLocalSettings(data.settings);
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await http.post("/isp-settings/reset?confirm=true");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["isp-settings"], data);
      setLocalSettings(data);
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Settings reset to defaults",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to reset settings",
        variant: "destructive",
      });
    },
  });

  // Export settings
  const handleExport = async () => {
    try {
      const response = await http.get("/isp-settings/export");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `isp-settings-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "Settings exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export settings",
        variant: "destructive",
      });
    }
  };

  // Import settings
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedSettings = ispSettingsSchema.parse(JSON.parse(text));

      const response = await http.post("/isp-settings/import", {
        settings: importedSettings,
        validate_only: false,
      });

      queryClient.setQueryData(["isp-settings"], response.data.settings);
      setLocalSettings(response.data.settings);
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Settings imported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to import settings",
        variant: "destructive",
      });
    }
  };

  // Handle section update
  const handleSectionUpdate = (section: string, updates: any) => {
    if (!localSettings) return;

    const newSettings = {
      ...localSettings,
      [section]: updates,
    };

    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  // Save all changes
  const handleSave = () => {
    if (!localSettings || !settings) return;

    // Calculate what changed
    const changes: any = {};
    Object.keys(localSettings).forEach((key) => {
      if (
        JSON.stringify(localSettings[key as keyof ISPSettings]) !==
        JSON.stringify(settings[key as keyof ISPSettings])
      ) {
        changes[key] = localSettings[key as keyof ISPSettings];
      }
    });

    if (Object.keys(changes).length === 0) {
      toast({
        title: "Info",
        description: "No changes to save",
      });
      return;
    }

    saveMutation.mutate(changes);
  };

  // Discard changes
  const handleDiscard = () => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
      toast({
        title: "Info",
        description: "Changes discarded",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load settings. Please try again.</AlertDescription>
      </Alert>
    );
  }

  if (!localSettings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ISP Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage ISP-specific settings and defaults</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("import-file")?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            id="import-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You have unsaved changes</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Settings tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-11">
          <TabsTrigger value="subscriber-id">Subscriber ID</TabsTrigger>
          <TabsTrigger value="radius">RADIUS</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="localization">Localization</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriber-id" className="mt-6">
          <SubscriberIDSettings
            settings={localSettings.subscriber_id as any}
            onChange={(updates) => handleSectionUpdate("subscriber_id", updates)}
          />
        </TabsContent>

        <TabsContent value="radius" className="mt-6">
          <RADIUSSettings
            settings={localSettings.radius as any}
            onChange={(updates) => handleSectionUpdate("radius", updates)}
          />
        </TabsContent>

        <TabsContent value="network" className="mt-6">
          <NetworkSettings
            settings={localSettings.network as any}
            onChange={(updates) => handleSectionUpdate("network", updates)}
          />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceSettings
            settings={localSettings.compliance as any}
            onChange={(updates) => handleSectionUpdate("compliance", updates)}
          />
        </TabsContent>

        <TabsContent value="portal" className="mt-6">
          <PortalSettings
            settings={localSettings.portal as any}
            onChange={(updates) => handleSectionUpdate("portal", updates)}
          />
        </TabsContent>

        <TabsContent value="localization" className="mt-6">
          <LocalizationSettings
            settings={localSettings.localization as any}
            onChange={(updates) => handleSectionUpdate("localization", updates)}
          />
        </TabsContent>

        <TabsContent value="sla" className="mt-6">
          <SLASettings
            settings={localSettings.sla as any}
            onChange={(updates) => handleSectionUpdate("sla", updates)}
          />
        </TabsContent>

        <TabsContent value="service" className="mt-6">
          <ServiceDefaultsSettings
            settings={localSettings.service_defaults as any}
            onChange={(updates) => handleSectionUpdate("service_defaults", updates)}
          />
        </TabsContent>

        <TabsContent value="tax" className="mt-6">
          <TaxSettings
            settings={localSettings.tax as any}
            onChange={(updates) => handleSectionUpdate("tax", updates)}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingSettings
            settings={localSettings.billing as any}
            onChange={(updates) => handleSectionUpdate("billing", updates)}
          />
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
          <BankAccountSettings
            settings={localSettings.bank_accounts as any}
            onChange={(updates) => handleSectionUpdate("bank_accounts", updates)}
          />
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your ISP configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to reset all settings to defaults? This cannot be undone.",
                )
              ) {
                resetMutation.mutate();
              }
            }}
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
