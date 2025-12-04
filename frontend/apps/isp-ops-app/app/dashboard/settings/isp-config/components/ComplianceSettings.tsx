/**
 * Compliance Settings Component
 *
 * Configures regulatory compliance and data protection settings including
 * GDPR, CCPA, data residency, and retention policies.
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
import { Shield, Lock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComplianceSettingsProps {
  settings: {
    data_residency_region: string;
    gdpr_enabled: boolean;
    ccpa_enabled: boolean;
    hipaa_enabled: boolean;
    audit_retention_days: number;
    customer_data_retention_days: number;
    pii_encryption_required: boolean;
    data_export_format: string;
    right_to_deletion: boolean;
    right_to_access: boolean;
    anonymize_on_deletion: boolean;
  };
  onChange: (settings: any) => void;
}

const DATA_RESIDENCY_REGIONS = [
  { value: "us", label: "United States", flag: "🇺🇸" },
  { value: "eu", label: "European Union", flag: "🇪🇺" },
  { value: "uk", label: "United Kingdom", flag: "🇬🇧" },
  { value: "canada", label: "Canada", flag: "🇨🇦" },
  { value: "australia", label: "Australia", flag: "🇦🇺" },
  { value: "apac", label: "Asia Pacific", flag: "🌏" },
  { value: "middle_east", label: "Middle East", flag: "🌍" },
  { value: "africa", label: "Africa", flag: "🌍" },
];

export function ComplianceSettings({ settings, onChange }: ComplianceSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const formatDays = (days: number): string => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years} years ${months} months` : `${years} years`;
  };

  const selectedRegion = DATA_RESIDENCY_REGIONS.find(
    (r) => r.value === settings.data_residency_region,
  );

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Compliance settings help ensure regulatory adherence. Consult legal counsel for specific
          requirements in your jurisdiction.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Data Residency</CardTitle>
          <CardDescription>Define where customer data is stored and processed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="data_residency">Data Residency Region</Label>
              <Badge variant="secondary">Initial Setup</Badge>
            </div>
            <Select
              value={settings.data_residency_region}
              onValueChange={(value) => updateSetting("data_residency_region", value)}
            >
              <SelectTrigger id="data_residency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_RESIDENCY_REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.flag} {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Primary region where customer data is stored. Changing this may require data
              migration.
            </p>
          </div>

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Current region:{" "}
              <strong>
                {selectedRegion?.flag} {selectedRegion?.label}
              </strong>{" "}
              - Data is stored in compliance with local regulations
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regulatory Compliance</CardTitle>
          <CardDescription>Enable compliance features for specific regulations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* GDPR */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gdpr">GDPR Compliance (EU)</Label>
              <p className="text-sm text-muted-foreground">
                General Data Protection Regulation - Required for EU operations
              </p>
            </div>
            <Switch
              id="gdpr"
              checked={settings.gdpr_enabled}
              onCheckedChange={(checked) => updateSetting("gdpr_enabled", checked)}
            />
          </div>

          {settings.gdpr_enabled && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                GDPR enabled: Right to deletion, access, and data portability are enforced. Audit
                logs track all data access and modifications.
              </AlertDescription>
            </Alert>
          )}

          {/* CCPA */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ccpa">CCPA Compliance (California)</Label>
              <p className="text-sm text-muted-foreground">
                California Consumer Privacy Act - Required for California operations
              </p>
            </div>
            <Switch
              id="ccpa"
              checked={settings.ccpa_enabled}
              onCheckedChange={(checked) => updateSetting("ccpa_enabled", checked)}
            />
          </div>

          {/* HIPAA */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="hipaa">HIPAA Compliance (Healthcare)</Label>
              <p className="text-sm text-muted-foreground">
                Health Insurance Portability and Accountability Act - For healthcare data
              </p>
            </div>
            <Switch
              id="hipaa"
              checked={settings.hipaa_enabled}
              onCheckedChange={(checked) => updateSetting("hipaa_enabled", checked)}
            />
          </div>

          {settings.hipaa_enabled && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>HIPAA Enabled:</strong> Enhanced security measures and audit trails are
                required. Ensure all staff are trained on HIPAA compliance.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Retention Policies</CardTitle>
          <CardDescription>Configure how long different types of data are retained</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Audit Logs Retention */}
          <div className="space-y-2">
            <Label htmlFor="audit_retention">Audit Log Retention</Label>
            <Input
              id="audit_retention"
              type="number"
              min="30"
              max="2555"
              value={settings.audit_retention_days}
              onChange={(e) => updateSetting("audit_retention_days", parseInt(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              Days ({formatDays(settings.audit_retention_days)}) - GDPR recommends 90 days minimum
            </p>
          </div>

          {/* Customer Data Retention */}
          <div className="space-y-2">
            <Label htmlFor="customer_retention">Customer Data Retention After Closure</Label>
            <Input
              id="customer_retention"
              type="number"
              min="365"
              max="3650"
              value={settings.customer_data_retention_days}
              onChange={(e) =>
                updateSetting("customer_data_retention_days", parseInt(e.target.value))
              }
            />
            <p className="text-sm text-muted-foreground">
              Days ({formatDays(settings.customer_data_retention_days)}) - How long to keep data
              after account closure
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Retention periods vary by regulation:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>GDPR: Data must be kept only as long as necessary</li>
                <li>Financial records: Often 7 years for tax purposes</li>
                <li>Audit logs: Recommended 90+ days</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Protection</CardTitle>
          <CardDescription>Configure data encryption and protection measures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PII Encryption */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pii_encryption">Require PII Encryption at Rest</Label>
              <p className="text-sm text-muted-foreground">
                Encrypt personally identifiable information in database
              </p>
            </div>
            <Switch
              id="pii_encryption"
              checked={settings.pii_encryption_required}
              onCheckedChange={(checked) => updateSetting("pii_encryption_required", checked)}
            />
          </div>

          {settings.pii_encryption_required && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                PII encryption enabled: Customer names, addresses, phone numbers, and emails are
                encrypted in the database.
              </AlertDescription>
            </Alert>
          )}

          {/* Data Export Format */}
          <div className="space-y-2">
            <Label htmlFor="export_format">Data Export Format</Label>
            <Select
              value={settings.data_export_format}
              onValueChange={(value) => updateSetting("data_export_format", value)}
            >
              <SelectTrigger id="export_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (Structured)</SelectItem>
                <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                <SelectItem value="xml">XML (Legacy Systems)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Default format for customer data exports and portability requests
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Rights</CardTitle>
          <CardDescription>
            Enable customer privacy rights and data subject requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Right to Deletion */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="right_deletion">Right to Deletion</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to request deletion of their data (GDPR Article 17)
              </p>
            </div>
            <Switch
              id="right_deletion"
              checked={settings.right_to_deletion}
              onCheckedChange={(checked) => updateSetting("right_to_deletion", checked)}
            />
          </div>

          {/* Right to Access */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="right_access">Right to Access</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to request a copy of their data (GDPR Article 15)
              </p>
            </div>
            <Switch
              id="right_access"
              checked={settings.right_to_access}
              onCheckedChange={(checked) => updateSetting("right_to_access", checked)}
            />
          </div>

          {/* Anonymize on Deletion */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="anonymize">Anonymize Instead of Hard Delete</Label>
              <p className="text-sm text-muted-foreground">
                Anonymize data rather than permanently deleting (preserves analytics)
              </p>
            </div>
            <Switch
              id="anonymize"
              checked={settings.anonymize_on_deletion}
              onCheckedChange={(checked) => updateSetting("anonymize_on_deletion", checked)}
            />
          </div>

          {settings.anonymize_on_deletion && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Anonymization replaces personal data with random values while preserving statistical
                integrity for analytics and reporting.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <div className="font-semibold mb-2">Compliance Summary:</div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Data Region: {selectedRegion?.label}</li>
            <li>
              Active Regulations:{" "}
              {[
                settings.gdpr_enabled && "GDPR",
                settings.ccpa_enabled && "CCPA",
                settings.hipaa_enabled && "HIPAA",
              ]
                .filter(Boolean)
                .join(", ") || "None"}
            </li>
            <li>Audit Retention: {formatDays(settings.audit_retention_days)}</li>
            <li>PII Encryption: {settings.pii_encryption_required ? "Enabled" : "Disabled"}</li>
            <li>
              Privacy Rights:{" "}
              {[settings.right_to_deletion && "Deletion", settings.right_to_access && "Access"]
                .filter(Boolean)
                .join(", ") || "None"}
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
