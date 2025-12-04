"use client";

/**
 * RADIUS Authentication Settings Component
 *
 * Configures default RADIUS settings for new subscribers including
 * password hashing, session timeouts, and bandwidth limits.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RADIUSSettingsProps {
  settings: {
    default_password_hash: string;
    session_timeout: number;
    idle_timeout: number;
    simultaneous_use: number;
    acct_interim_interval: number;
    default_download_speed: string | null;
    default_upload_speed: string | null;
    custom_attributes: Record<string, string>;
    nas_vendor_defaults: Record<string, any>;
  };
  onChange: (settings: any) => void;
}

export function RADIUSSettings({ settings, onChange }: RADIUSSettingsProps) {
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");

  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const addCustomAttribute = () => {
    if (newAttrKey && newAttrValue) {
      updateSetting("custom_attributes", {
        ...settings.custom_attributes,
        [newAttrKey]: newAttrValue,
      });
      setNewAttrKey("");
      setNewAttrValue("");
    }
  };

  const removeCustomAttribute = (key: string) => {
    const { [key]: removed, ...rest } = settings.custom_attributes;
    updateSetting("custom_attributes", rest);
  };

  const formatSeconds = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          These settings apply as defaults for <strong>new subscribers only</strong>. Existing
          subscribers retain their current settings unless manually updated.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Settings</CardTitle>
          <CardDescription>Configure password hashing and authentication defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Hash Method */}
          <div className="space-y-2">
            <Label htmlFor="password_hash">Default Password Hash Method</Label>
            <Select
              value={settings.default_password_hash}
              onValueChange={(value) => updateSetting("default_password_hash", value)}
            >
              <SelectTrigger id="password_hash">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sha256">SHA-256 (Recommended)</SelectItem>
                <SelectItem value="bcrypt">Bcrypt (Most Secure)</SelectItem>
                <SelectItem value="md5">MD5 (Legacy Compatibility)</SelectItem>
                <SelectItem value="cleartext">Cleartext (Not Recommended)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {settings.default_password_hash === "sha256" && (
                <p className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Good balance of security and NAS compatibility
                </p>
              )}
              {settings.default_password_hash === "bcrypt" && (
                <p className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Highest security but may not work with all NAS devices
                </p>
              )}
              {settings.default_password_hash === "md5" && (
                <p className="flex items-center gap-1 text-amber-600">
                  <Info className="h-3 w-3" />
                  Legacy only - use for older NAS equipment compatibility
                </p>
              )}
              {settings.default_password_hash === "cleartext" && (
                <p className="flex items-center gap-1 text-red-600">
                  <Info className="h-3 w-3" />
                  Insecure - only use for testing purposes
                </p>
              )}
            </div>
          </div>

          {/* Simultaneous Use */}
          <div className="space-y-2">
            <Label htmlFor="simultaneous_use">Simultaneous Sessions Limit</Label>
            <Input
              id="simultaneous_use"
              type="number"
              min="1"
              max="10"
              value={settings.simultaneous_use}
              onChange={(e) => updateSetting("simultaneous_use", parseInt(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of concurrent sessions per subscriber
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
          <CardDescription>Configure session and idle timeouts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Session Timeout */}
            <div className="space-y-2">
              <Label htmlFor="session_timeout">Session Timeout</Label>
              <Input
                id="session_timeout"
                type="number"
                min="60"
                max="86400"
                step="60"
                value={settings.session_timeout}
                onChange={(e) => updateSetting("session_timeout", parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Seconds ({formatSeconds(settings.session_timeout)})
              </p>
            </div>

            {/* Idle Timeout */}
            <div className="space-y-2">
              <Label htmlFor="idle_timeout">Idle Timeout</Label>
              <Input
                id="idle_timeout"
                type="number"
                min="60"
                max="7200"
                step="60"
                value={settings.idle_timeout}
                onChange={(e) => updateSetting("idle_timeout", parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Seconds ({formatSeconds(settings.idle_timeout)})
              </p>
            </div>
          </div>

          {/* Accounting Interim Interval */}
          <div className="space-y-2">
            <Label htmlFor="acct_interim">Accounting Interim Interval</Label>
            <Input
              id="acct_interim"
              type="number"
              min="60"
              max="3600"
              step="60"
              value={settings.acct_interim_interval}
              onChange={(e) => updateSetting("acct_interim_interval", parseInt(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Seconds ({formatSeconds(settings.acct_interim_interval)}) - How often usage updates
              are sent
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bandwidth Settings</CardTitle>
          <CardDescription>Default bandwidth limits for new subscribers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Download Speed */}
            <div className="space-y-2">
              <Label htmlFor="download_speed">Default Download Speed</Label>
              <Input
                id="download_speed"
                value={settings.default_download_speed || ""}
                onChange={(e) => updateSetting("default_download_speed", e.target.value || null)}
                placeholder="e.g., 100M, 1G"
              />
              <p className="text-sm text-muted-foreground">
                Format: 100M, 1G, 500K (leave empty for no limit)
              </p>
            </div>

            {/* Upload Speed */}
            <div className="space-y-2">
              <Label htmlFor="upload_speed">Default Upload Speed</Label>
              <Input
                id="upload_speed"
                value={settings.default_upload_speed || ""}
                onChange={(e) => updateSetting("default_upload_speed", e.target.value || null)}
                placeholder="e.g., 50M, 500M"
              />
              <p className="text-sm text-muted-foreground">
                Format: 50M, 500M, 100K (leave empty for no limit)
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Bandwidth limits are applied via RADIUS reply attributes. Ensure your NAS supports the
              configured format (Mikrotik-Rate-Limit, Cisco-AVPair, etc.)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom RADIUS Attributes</CardTitle>
          <CardDescription>
            Additional RADIUS reply attributes sent to all subscribers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Attributes */}
          {Object.keys(settings.custom_attributes).length > 0 && (
            <div className="space-y-2">
              <Label>Current Attributes</Label>
              <div className="space-y-2">
                {Object.entries(settings.custom_attributes).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="flex-1 text-sm">
                      {key} = {value}
                    </code>
                    <Button variant="ghost" size="sm" onClick={() => removeCustomAttribute(key)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Attribute */}
          <div className="space-y-2">
            <Label>Add Custom Attribute</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Attribute Name"
                value={newAttrKey}
                onChange={(e) => setNewAttrKey(e.target.value)}
              />
              <Input
                placeholder="Attribute Value"
                value={newAttrValue}
                onChange={(e) => setNewAttrValue(e.target.value)}
              />
              <Button onClick={addCustomAttribute} disabled={!newAttrKey || !newAttrValue}>
                Add Attribute
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Example: Framed-Protocol = PPP, Service-Type = Framed-User
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor-Specific Defaults</CardTitle>
          <CardDescription>
            Configure NAS vendor-specific settings (Mikrotik, Cisco, Huawei, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Vendor-specific settings are configured at the NAS level. This section is for advanced
              users only.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Label htmlFor="nas_vendor_json">Vendor Defaults (JSON)</Label>
            <Textarea
              id="nas_vendor_json"
              className="font-mono text-xs mt-2"
              rows={8}
              value={JSON.stringify(settings.nas_vendor_defaults, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateSetting("nas_vendor_defaults", parsed);
                } catch (err) {
                  // Invalid JSON - ignore
                }
              }}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Example:{" "}
              {`{"mikrotik": {"rate_limit": "100M/50M"}, "cisco": {"qos_policy": "premium"}}`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
