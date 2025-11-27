"use client";

/**
 * Tax Configuration Settings Component
 *
 * Configures tax types, rates, exemptions, and regional tax settings
 * for billing and invoicing.
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
import { Info, Receipt, DollarSign, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TaxSettingsProps {
  settings: {
    tax_enabled: boolean;
    default_tax_type: string;
    default_tax_rate: number;
    tax_calculation_method: string;
    require_tax_id: boolean;
    tax_id_label: string;
    validate_tax_id_format: boolean;
    allow_tax_exemptions: boolean;
    require_exemption_certificate: boolean;
    regional_tax_rates: Record<string, number>;
    tax_reporting_enabled: boolean;
    tax_registration_number: string | null;
  };
  onChange: (settings: any) => void;
}

const TAX_TYPES = [
  {
    value: "vat",
    label: "VAT (Value Added Tax)",
    description: "Common in EU, UK, and many other countries",
  },
  {
    value: "gst",
    label: "GST (Goods and Services Tax)",
    description: "Used in Canada, Australia, India, etc.",
  },
  { value: "sales_tax", label: "Sales Tax", description: "Common in US states" },
  { value: "custom", label: "Custom Tax Type", description: "Define your own tax type" },
];

const TAX_CALCULATION_METHODS = [
  {
    value: "inclusive",
    label: "Tax Inclusive",
    description: "Tax is included in the displayed price",
  },
  {
    value: "exclusive",
    label: "Tax Exclusive",
    description: "Tax is added to the price at checkout",
  },
  { value: "compound", label: "Compound Tax", description: "Tax calculated on tax (rare)" },
];

export function TaxSettings({ settings, onChange }: TaxSettingsProps) {
  const [newRegionCode, setNewRegionCode] = useState("");
  const [newRegionRate, setNewRegionRate] = useState("");

  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const addRegionalTaxRate = () => {
    if (newRegionCode && newRegionRate) {
      updateSetting("regional_tax_rates", {
        ...settings.regional_tax_rates,
        [newRegionCode.toUpperCase()]: parseFloat(newRegionRate),
      });
      setNewRegionCode("");
      setNewRegionRate("");
    }
  };

  const removeRegionalTaxRate = (code: string) => {
    const { [code]: removed, ...rest } = settings.regional_tax_rates;
    updateSetting("regional_tax_rates", rest);
  };

  const selectedTaxType = TAX_TYPES.find((t) => t.value === settings.default_tax_type);
  const selectedCalculationMethod = TAX_CALCULATION_METHODS.find(
    (m) => m.value === settings.tax_calculation_method,
  );

  const formatTaxRate = (rate: number): string => {
    return `${rate.toFixed(2)}%`;
  };

  const calculateTaxAmount = (
    price: number,
    rate: number,
    method: string,
  ): { tax: number; total: number } => {
    if (method === "inclusive") {
      const taxAmount = (price * rate) / (100 + rate);
      return { tax: taxAmount, total: price };
    } else {
      const taxAmount = (price * rate) / 100;
      return { tax: taxAmount, total: price + taxAmount };
    }
  };

  const examplePrice = 100;
  const exampleCalculation = calculateTaxAmount(
    examplePrice,
    settings.default_tax_rate,
    settings.tax_calculation_method,
  );

  return (
    <div className="space-y-6">
      <Alert>
        <Receipt className="h-4 w-4" />
        <AlertDescription>
          Tax settings apply to all invoices and billing. Consult with your accountant or tax
          advisor for compliance requirements.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
          <CardDescription>Configure tax types and calculation methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tax_enabled">Enable Tax Calculations</Label>
              <p className="text-sm text-muted-foreground">Apply tax to invoices and billing</p>
            </div>
            <Switch
              id="tax_enabled"
              checked={settings.tax_enabled}
              onCheckedChange={(checked) => updateSetting("tax_enabled", checked)}
            />
          </div>

          {settings.tax_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tax_type">Default Tax Type</Label>
                <Select
                  value={settings.default_tax_type}
                  onValueChange={(value) => updateSetting("default_tax_type", value)}
                >
                  <SelectTrigger id="tax_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{selectedTaxType?.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate">Default Tax Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.default_tax_rate}
                    onChange={(e) => updateSetting("default_tax_rate", parseFloat(e.target.value))}
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Rate: {formatTaxRate(settings.default_tax_rate)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calculation_method">Tax Calculation Method</Label>
                <Select
                  value={settings.tax_calculation_method}
                  onValueChange={(value) => updateSetting("tax_calculation_method", value)}
                >
                  <SelectTrigger id="calculation_method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_CALCULATION_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedCalculationMethod?.description}
                </p>
              </div>

              <Alert>
                <DollarSign className="h-4 w-4" />
                <AlertDescription>
                  <strong>Example calculation:</strong> Price ${examplePrice.toFixed(2)}
                  <br />
                  Tax ({formatTaxRate(settings.default_tax_rate)}): $
                  {exampleCalculation.tax.toFixed(2)}
                  <br />
                  Total: ${exampleCalculation.total.toFixed(2)}
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {settings.tax_enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tax ID Requirements</CardTitle>
              <CardDescription>
                Configure tax identification requirements for customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require_tax_id">Require Tax ID from Customers</Label>
                  <p className="text-sm text-muted-foreground">
                    Customers must provide a tax identification number
                  </p>
                </div>
                <Switch
                  id="require_tax_id"
                  checked={settings.require_tax_id}
                  onCheckedChange={(checked) => updateSetting("require_tax_id", checked)}
                />
              </div>

              {settings.require_tax_id && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id_label">Tax ID Label</Label>
                    <Input
                      id="tax_id_label"
                      value={settings.tax_id_label}
                      onChange={(e) => updateSetting("tax_id_label", e.target.value)}
                      placeholder="e.g., VAT Number, GST Number, Tax ID"
                    />
                    <p className="text-sm text-muted-foreground">
                      Label shown to customers (e.g., &quot;VAT Number&quot; for EU, &quot;GST
                      Number&quot; for India)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="validate_format">Validate Tax ID Format</Label>
                      <p className="text-sm text-muted-foreground">
                        Validate format based on country/region
                      </p>
                    </div>
                    <Switch
                      id="validate_format"
                      checked={settings.validate_tax_id_format}
                      onCheckedChange={(checked) =>
                        updateSetting("validate_tax_id_format", checked)
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Exemptions</CardTitle>
              <CardDescription>
                Configure tax exemption policies for eligible customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow_exemptions">Allow Tax Exemptions</Label>
                  <p className="text-sm text-muted-foreground">
                    Customers can claim tax-exempt status
                  </p>
                </div>
                <Switch
                  id="allow_exemptions"
                  checked={settings.allow_tax_exemptions}
                  onCheckedChange={(checked) => updateSetting("allow_tax_exemptions", checked)}
                />
              </div>

              {settings.allow_tax_exemptions && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_certificate">Require Exemption Certificate</Label>
                    <p className="text-sm text-muted-foreground">
                      Upload exemption certificate for tax-exempt customers
                    </p>
                  </div>
                  <Switch
                    id="require_certificate"
                    checked={settings.require_exemption_certificate}
                    onCheckedChange={(checked) =>
                      updateSetting("require_exemption_certificate", checked)
                    }
                  />
                </div>
              )}

              {settings.allow_tax_exemptions && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Tax-exempt customers will not be charged tax on invoices. Ensure proper
                    documentation is maintained for compliance.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Tax Rates</CardTitle>
              <CardDescription>
                Configure different tax rates by state/province/region
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.keys(settings.regional_tax_rates).length > 0 && (
                <div className="space-y-2">
                  <Label>Current Regional Rates</Label>
                  <div className="space-y-2">
                    {Object.entries(settings.regional_tax_rates).map(([code, rate]) => (
                      <div
                        key={code}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{code}</Badge>
                          <span className="text-sm">{formatTaxRate(rate)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRegionalTaxRate(code)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Add Regional Tax Rate</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Region Code (e.g., CA, NY)"
                    value={newRegionCode}
                    onChange={(e) => setNewRegionCode(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Tax Rate (%)"
                    value={newRegionRate}
                    onChange={(e) => setNewRegionRate(e.target.value)}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <Button onClick={addRegionalTaxRate} disabled={!newRegionCode || !newRegionRate}>
                    Add Rate
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Example: CA = 7.25 (California), NY = 8.875 (New York)
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Regional rates override the default rate when customer address matches the region
                  code.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Reporting</CardTitle>
              <CardDescription>Configure tax reporting and compliance features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tax_reporting">Enable Tax Reporting</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate tax reports for filing and compliance
                  </p>
                </div>
                <Switch
                  id="tax_reporting"
                  checked={settings.tax_reporting_enabled}
                  onCheckedChange={(checked) => updateSetting("tax_reporting_enabled", checked)}
                />
              </div>

              {settings.tax_reporting_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="tax_reg_number">Tax Registration Number</Label>
                  <Input
                    id="tax_reg_number"
                    value={settings.tax_registration_number || ""}
                    onChange={(e) =>
                      updateSetting("tax_registration_number", e.target.value || null)
                    }
                    placeholder="Your company's tax registration number"
                  />
                  <p className="text-sm text-muted-foreground">
                    Displayed on tax reports and invoices
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Configuration Summary</CardTitle>
              <CardDescription>Overview of current tax settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tax Setup:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    <li>Tax enabled: {settings.tax_enabled ? "Yes" : "No"}</li>
                    <li>Tax type: {selectedTaxType?.label}</li>
                    <li>Default rate: {formatTaxRate(settings.default_tax_rate)}</li>
                    <li>Calculation: {selectedCalculationMethod?.label}</li>
                  </ul>
                </div>

                {settings.require_tax_id && (
                  <div>
                    <h4 className="font-medium mb-2">Tax ID Requirements:</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Label: {settings.tax_id_label}</li>
                      <li>
                        Validation: {settings.validate_tax_id_format ? "Enabled" : "Disabled"}
                      </li>
                    </ul>
                  </div>
                )}

                {settings.allow_tax_exemptions && (
                  <div>
                    <h4 className="font-medium mb-2">Exemptions:</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Exemptions allowed: Yes</li>
                      <li>
                        Certificate required:{" "}
                        {settings.require_exemption_certificate ? "Yes" : "No"}
                      </li>
                    </ul>
                  </div>
                )}

                {Object.keys(settings.regional_tax_rates).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Regional Rates:</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                      {Object.entries(settings.regional_tax_rates).map(([code, rate]) => (
                        <li key={code}>
                          {code}: {formatTaxRate(rate)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
