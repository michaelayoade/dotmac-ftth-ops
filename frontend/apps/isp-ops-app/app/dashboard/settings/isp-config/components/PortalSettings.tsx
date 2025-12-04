"use client";

/**
 * Portal Customization Settings Component
 *
 * Configures customer portal branding, features, and customization including
 * themes, logos, custom domains, and feature toggles.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palette, Globe, Info } from "lucide-react";

interface PortalSettingsProps {
  settings: {
    custom_domain: string | null;
    theme_primary_color: string;
    theme_secondary_color: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    custom_css: string | null;
    enable_self_service: boolean;
    enable_ticket_creation: boolean;
    enable_payment_methods: boolean;
    enable_usage_monitoring: boolean;
    welcome_message: string | null;
    support_email: string | null;
    support_phone: string | null;
  };
  onChange: (settings: any) => void;
}

export function PortalSettings({ settings, onChange }: PortalSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  // Validate color format
  const isValidColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [portalLogoError, setPortalLogoError] = useState(false);

  useEffect(() => {
    setLogoPreviewError(false);
    setPortalLogoError(false);
  }, [settings.logo_url]);

  return (
    <div className="space-y-6">
      <Alert>
        <Palette className="h-4 w-4" />
        <AlertDescription>
          Customize the customer portal appearance and features for your brand. Changes are visible
          to customers immediately after saving.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Configure custom domain for customer portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="custom_domain">Custom Domain</Label>
            <Input
              id="custom_domain"
              value={settings.custom_domain || ""}
              onChange={(e) => updateSetting("custom_domain", e.target.value || null)}
              placeholder="portal.myisp.com"
            />
            <p className="text-sm text-muted-foreground">
              Custom domain for customer portal (e.g., portal.myisp.com)
            </p>
          </div>

          {settings.custom_domain && (
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                <strong>DNS Configuration Required:</strong>
                <br />
                Add a CNAME record for{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{settings.custom_domain}</code>{" "}
                pointing to your platform domain.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding & Theme</CardTitle>
          <CardDescription>Customize colors, logos, and visual appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary Brand Color</Label>
            <div className="flex gap-2">
              <Input
                id="primary_color"
                value={settings.theme_primary_color}
                onChange={(e) => updateSetting("theme_primary_color", e.target.value)}
                placeholder="#0066cc"
                className="flex-1"
              />
              <div
                className="w-12 h-10 rounded border"
                style={{ backgroundColor: settings.theme_primary_color }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Primary color for buttons, links, and highlights (hex format)
            </p>
            {!isValidColor(settings.theme_primary_color) && (
              <p className="text-sm text-red-600">Invalid color format. Use #RRGGBB format.</p>
            )}
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <Label htmlFor="secondary_color">Secondary Brand Color (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="secondary_color"
                value={settings.theme_secondary_color || ""}
                onChange={(e) => updateSetting("theme_secondary_color", e.target.value || null)}
                placeholder="#ffaa00"
                className="flex-1"
              />
              {settings.theme_secondary_color && (
                <div
                  className="w-12 h-10 rounded border"
                  style={{ backgroundColor: settings.theme_secondary_color }}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Secondary accent color (leave empty to auto-generate)
            </p>
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              value={settings.logo_url || ""}
              onChange={(e) => updateSetting("logo_url", e.target.value || null)}
              placeholder="https://cdn.myisp.com/logo.png"
            />
            <p className="text-sm text-muted-foreground">
              URL to company logo image (PNG, SVG recommended)
            </p>
          </div>

          {settings.logo_url && (
            <div className="p-4 bg-muted rounded">
              <p className="text-sm text-muted-foreground mb-2">Logo Preview:</p>
              {!logoPreviewError ? (
                <Image
                  src={settings.logo_url}
                  alt="Logo preview"
                  width={240}
                  height={48}
                  className="h-12 w-auto object-contain"
                  unoptimized
                  onError={() => setLogoPreviewError(true)}
                />
              ) : (
                <p className="text-sm text-red-600">Failed to load logo image</p>
              )}
            </div>
          )}

          {/* Favicon URL */}
          <div className="space-y-2">
            <Label htmlFor="favicon_url">Favicon URL</Label>
            <Input
              id="favicon_url"
              value={settings.favicon_url || ""}
              onChange={(e) => updateSetting("favicon_url", e.target.value || null)}
              placeholder="https://cdn.myisp.com/favicon.ico"
            />
            <p className="text-sm text-muted-foreground">URL to favicon (16x16 or 32x32 ICO/PNG)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>
            Add custom CSS to further customize the portal appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="custom_css">Custom CSS Code</Label>
            <Textarea
              id="custom_css"
              value={settings.custom_css || ""}
              onChange={(e) => updateSetting("custom_css", e.target.value || null)}
              placeholder=".portal-header { font-size: 24px; }"
              className="font-mono text-sm"
              rows={10}
            />
            <p className="text-sm text-muted-foreground">
              Advanced customization with custom CSS (max 50,000 characters)
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Custom CSS is applied globally to the customer portal. Test thoroughly before
              deploying to production.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portal Features</CardTitle>
          <CardDescription>Enable or disable customer-facing features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Self-Service */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="self_service">Enable Self-Service</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to manage their account and services
              </p>
            </div>
            <Switch
              id="self_service"
              checked={settings.enable_self_service}
              onCheckedChange={(checked) => updateSetting("enable_self_service", checked)}
            />
          </div>

          {/* Ticket Creation */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tickets">Enable Ticket Creation</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to create support tickets
              </p>
            </div>
            <Switch
              id="tickets"
              checked={settings.enable_ticket_creation}
              onCheckedChange={(checked) => updateSetting("enable_ticket_creation", checked)}
            />
          </div>

          {/* Payment Methods */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="payments">Enable Payment Methods</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to add and manage payment methods
              </p>
            </div>
            <Switch
              id="payments"
              checked={settings.enable_payment_methods}
              onCheckedChange={(checked) => updateSetting("enable_payment_methods", checked)}
            />
          </div>

          {/* Usage Monitoring */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="usage">Enable Usage Monitoring</Label>
              <p className="text-sm text-muted-foreground">
                Show bandwidth usage and data caps to customers
              </p>
            </div>
            <Switch
              id="usage"
              checked={settings.enable_usage_monitoring}
              onCheckedChange={(checked) => updateSetting("enable_usage_monitoring", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portal Content</CardTitle>
          <CardDescription>
            Customize welcome message and support contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="welcome_message">Welcome Message</Label>
            <Textarea
              id="welcome_message"
              value={settings.welcome_message || ""}
              onChange={(e) => updateSetting("welcome_message", e.target.value || null)}
              placeholder="Welcome to our customer portal..."
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Message displayed on portal homepage (max 1000 characters)
            </p>
          </div>

          {/* Support Email */}
          <div className="space-y-2">
            <Label htmlFor="support_email">Support Email</Label>
            <Input
              id="support_email"
              type="email"
              value={settings.support_email || ""}
              onChange={(e) => updateSetting("support_email", e.target.value || null)}
              placeholder="support@myisp.com"
            />
            <p className="text-sm text-muted-foreground">Contact email displayed to customers</p>
          </div>

          {/* Support Phone */}
          <div className="space-y-2">
            <Label htmlFor="support_phone">Support Phone</Label>
            <Input
              id="support_phone"
              type="tel"
              value={settings.support_phone || ""}
              onChange={(e) => updateSetting("support_phone", e.target.value || null)}
              placeholder="+1 (555) 123-4567"
            />
            <p className="text-sm text-muted-foreground">
              Contact phone number displayed to customers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Portal Preview</CardTitle>
          <CardDescription>Preview of how your portal will look</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border rounded-lg p-6"
            style={{ borderColor: settings.theme_primary_color }}
          >
            <div className="flex items-center justify-between mb-4">
              {settings.logo_url && !portalLogoError ? (
                <Image
                  src={settings.logo_url}
                  alt="Logo"
                  width={128}
                  height={32}
                  className="h-8 w-auto object-contain"
                  unoptimized
                  onError={() => setPortalLogoError(true)}
                />
              ) : (
                <div className="h-8 w-32 bg-muted rounded" />
              )}
              <div className="text-sm text-muted-foreground">
                {settings.custom_domain || "portal.example.com"}
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: settings.theme_primary_color }}>
              Welcome to Your Portal
            </h2>
            <p className="text-muted-foreground">
              {settings.welcome_message || "Your personalized portal for managing services"}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 rounded text-white"
                style={{ backgroundColor: settings.theme_primary_color }}
              >
                Primary Button
              </button>
              {settings.theme_secondary_color && (
                <button
                  className="px-4 py-2 rounded text-white"
                  style={{ backgroundColor: settings.theme_secondary_color }}
                >
                  Secondary Button
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
