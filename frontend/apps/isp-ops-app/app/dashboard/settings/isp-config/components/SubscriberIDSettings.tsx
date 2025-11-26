/**
 * Subscriber ID Generation Settings Component
 *
 * Configures how subscriber and customer IDs are generated including
 * format, prefixes, sequences, and migration settings.
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";

interface SubscriberIDSettingsProps {
  settings: {
    format: string;
    prefix: string;
    sequence_start: number;
    sequence_padding: number;
    custom_pattern: string | null;
    allow_custom_ids: boolean;
    validate_imported_ids: boolean;
  };
  onChange: (settings: any) => void;
}

export function SubscriberIDSettings({ settings, onChange }: SubscriberIDSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const formatExamples = {
    uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    sequential: "1",
    prefix_sequential: `${settings.prefix || "SUB"}-${String(settings.sequence_start || 1).padStart(settings.sequence_padding || 6, "0")}`,
    custom_pattern: settings.custom_pattern || "{prefix}-{year}-{sequence:05d}",
    import_preserved: "EXISTING-ID-123",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ID Generation Format</CardTitle>
          <CardDescription>Configure how subscriber and customer IDs are generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">ID Format</Label>
            <Select
              value={settings.format}
              onValueChange={(value) => updateSetting("format", value)}
            >
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uuid">UUID (Random)</SelectItem>
                <SelectItem value="sequential">Sequential Numbers</SelectItem>
                <SelectItem value="prefix_sequential">Prefix + Sequential</SelectItem>
                <SelectItem value="custom_pattern">Custom Pattern</SelectItem>
                <SelectItem value="import_preserved">Import Preserved (Migration)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Example:{" "}
              <code className="bg-muted px-2 py-1 rounded">
                {formatExamples[settings.format as keyof typeof formatExamples]}
              </code>
            </p>
          </div>

          {/* Prefix (for prefix_sequential) */}
          {(settings.format === "prefix_sequential" || settings.format === "custom_pattern") && (
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={settings.prefix}
                onChange={(e) => updateSetting("prefix", e.target.value.toUpperCase())}
                placeholder="SUB"
                maxLength={10}
              />
              <p className="text-sm text-muted-foreground">
                Prefix for subscriber IDs (e.g., SUB, CUST, ACCT)
              </p>
            </div>
          )}

          {/* Sequence Settings */}
          {(settings.format === "sequential" ||
            settings.format === "prefix_sequential" ||
            settings.format === "custom_pattern") && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sequence_start">Starting Number</Label>
                  <Input
                    id="sequence_start"
                    type="number"
                    min="1"
                    value={settings.sequence_start}
                    onChange={(e) => updateSetting("sequence_start", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">First subscriber ID number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sequence_padding">Zero Padding</Label>
                  <Input
                    id="sequence_padding"
                    type="number"
                    min="1"
                    max="12"
                    value={settings.sequence_padding}
                    onChange={(e) => updateSetting("sequence_padding", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">Pad with zeros (6 = 000001)</p>
                </div>
              </div>
            </>
          )}

          {/* Custom Pattern */}
          {settings.format === "custom_pattern" && (
            <div className="space-y-2">
              <Label htmlFor="custom_pattern">Custom Pattern</Label>
              <Input
                id="custom_pattern"
                value={settings.custom_pattern || ""}
                onChange={(e) => updateSetting("custom_pattern", e.target.value)}
                placeholder="{prefix}-{year}-{sequence:05d}"
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Available variables:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>
                    <code>{"{prefix}"}</code> - Prefix value above
                  </li>
                  <li>
                    <code>{"{year}"}</code> - Current year (YYYY)
                  </li>
                  <li>
                    <code>{"{month}"}</code> - Current month (MM)
                  </li>
                  <li>
                    <code>{"{sequence}"}</code> or <code>{"{sequence:05d}"}</code> - Incrementing
                    number
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Warning for UUID */}
          {settings.format === "uuid" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                UUID format generates random unique IDs. This cannot be changed later without data
                migration.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Migration Settings</CardTitle>
          <CardDescription>
            Settings for importing subscribers from existing systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow_custom_ids">Allow Custom IDs</Label>
              <p className="text-sm text-muted-foreground">
                Allow importing subscribers with their existing IDs
              </p>
            </div>
            <Switch
              id="allow_custom_ids"
              checked={settings.allow_custom_ids}
              onCheckedChange={(checked) => updateSetting("allow_custom_ids", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="validate_imported_ids">Validate Imported IDs</Label>
              <p className="text-sm text-muted-foreground">
                Validate imported IDs match the configured format
              </p>
            </div>
            <Switch
              id="validate_imported_ids"
              checked={settings.validate_imported_ids}
              onCheckedChange={(checked) => updateSetting("validate_imported_ids", checked)}
            />
          </div>

          {settings.allow_custom_ids && !settings.validate_imported_ids && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Allowing custom IDs without validation may result in inconsistent ID formats
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
