/**
 * Billing & Invoicing Settings Component
 *
 * Configures invoice numbering, payment terms, late fees, dunning strategies,
 * and auto-billing settings.
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
import { Textarea } from "@/components/ui/textarea";
import { Info, FileText, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BillingSettingsProps {
  settings: {
    invoice_numbering_format: string;
    invoice_prefix: string;
    invoice_sequence_start: number;
    invoice_sequence_padding: number;
    invoice_custom_pattern: string | null;
    default_payment_terms: string;
    custom_payment_terms_days: number | null;
    late_fee_enabled: boolean;
    late_fee_type: string;
    late_fee_amount: number;
    late_fee_grace_days: number;
    late_fee_max_amount: number | null;
    dunning_enabled: boolean;
    dunning_strategy: string;
    dunning_first_notice_days: number;
    dunning_escalation_days: number;
    dunning_max_notices: number;
    invoice_logo_url: string | null;
    invoice_footer_text: string | null;
    invoice_notes: string | null;
    auto_billing_enabled: boolean;
    auto_billing_retry_enabled: boolean;
    auto_billing_retry_days: number[];
  };
  onChange: (settings: any) => void;
}

const INVOICE_FORMATS = [
  { value: "sequential", label: "Sequential", example: "1, 2, 3, ..." },
  { value: "prefix_sequential", label: "Prefix + Sequential", example: "INV-000001, INV-000002" },
  { value: "year_sequential", label: "Year + Sequential", example: "2025-000001, 2025-000002" },
  {
    value: "custom_pattern",
    label: "Custom Pattern",
    example: "{prefix}-{year}-{month}-{sequence}",
  },
];

const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_7", label: "NET 7", days: 7 },
  { value: "net_15", label: "NET 15", days: 15 },
  { value: "net_30", label: "NET 30", days: 30 },
  { value: "net_60", label: "NET 60", days: 60 },
  { value: "custom", label: "Custom Terms", days: null },
];

const DUNNING_STRATEGIES = [
  { value: "gentle", label: "Gentle", description: "Friendly reminders, minimal pressure" },
  { value: "moderate", label: "Moderate", description: "Escalating messages, balanced approach" },
  { value: "aggressive", label: "Aggressive", description: "Strong language, rapid escalation" },
  { value: "custom", label: "Custom", description: "Define your own dunning flow" },
];

const LATE_FEE_TYPES = [
  { value: "percentage", label: "Percentage of Invoice", example: "5% of invoice amount" },
  { value: "fixed", label: "Fixed Amount", example: "$25 per invoice" },
];

export function BillingSettings({ settings, onChange }: BillingSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const generateInvoiceExample = (): string => {
    const format = settings.invoice_numbering_format;
    const prefix = settings.invoice_prefix || "INV";
    const sequence = String(settings.invoice_sequence_start || 1).padStart(
      settings.invoice_sequence_padding || 6,
      "0",
    );
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");

    switch (format) {
      case "sequential":
        return String(settings.invoice_sequence_start || 1);
      case "prefix_sequential":
        return `${prefix}-${sequence}`;
      case "year_sequential":
        return `${year}-${sequence}`;
      case "custom_pattern":
        return settings.invoice_custom_pattern || "{prefix}-{year}-{sequence}";
      default:
        return `${prefix}-${sequence}`;
    }
  };

  const selectedPaymentTerms = PAYMENT_TERMS.find(
    (t) => t.value === settings.default_payment_terms,
  );
  const selectedDunningStrategy = DUNNING_STRATEGIES.find(
    (s) => s.value === settings.dunning_strategy,
  );
  const selectedLateFeeType = LATE_FEE_TYPES.find((t) => t.value === settings.late_fee_type);

  return (
    <div className="space-y-6">
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Billing settings control invoice generation, payment terms, and collection processes.
          <strong> Some settings like invoice numbering format are initial setup only.</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Numbering</CardTitle>
          <CardDescription>Configure how invoice numbers are generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="invoice_format">Invoice Number Format</Label>
              <Badge variant="secondary">Initial Setup</Badge>
            </div>
            <Select
              value={settings.invoice_numbering_format}
              onValueChange={(value) => updateSetting("invoice_numbering_format", value)}
            >
              <SelectTrigger id="invoice_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Example:{" "}
              {INVOICE_FORMATS.find((f) => f.value === settings.invoice_numbering_format)?.example}
            </p>
          </div>

          {(settings.invoice_numbering_format === "prefix_sequential" ||
            settings.invoice_numbering_format === "year_sequential" ||
            settings.invoice_numbering_format === "custom_pattern") && (
            <div className="space-y-2">
              <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
              <Input
                id="invoice_prefix"
                value={settings.invoice_prefix}
                onChange={(e) => updateSetting("invoice_prefix", e.target.value)}
                placeholder="INV"
                maxLength={10}
              />
              <p className="text-sm text-muted-foreground">
                Prefix for invoice numbers (max 10 characters)
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sequence_start">Starting Number</Label>
              <Input
                id="sequence_start"
                type="number"
                min="1"
                value={settings.invoice_sequence_start}
                onChange={(e) => updateSetting("invoice_sequence_start", parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">First invoice number</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sequence_padding">Number Padding</Label>
              <Input
                id="sequence_padding"
                type="number"
                min="1"
                max="12"
                value={settings.invoice_sequence_padding}
                onChange={(e) =>
                  updateSetting("invoice_sequence_padding", parseInt(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">Zero-padding length (6 = 000001)</p>
            </div>
          </div>

          {settings.invoice_numbering_format === "custom_pattern" && (
            <div className="space-y-2">
              <Label htmlFor="custom_pattern">Custom Pattern</Label>
              <Input
                id="custom_pattern"
                value={settings.invoice_custom_pattern || ""}
                onChange={(e) => updateSetting("invoice_custom_pattern", e.target.value || null)}
                placeholder="{prefix}-{year}-{month}-{sequence:05d}"
              />
              <p className="text-sm text-muted-foreground">
                Variables: {"{prefix}"}, {"{year}"}, {"{month}"}, {"{sequence:05d}"}
              </p>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Next invoice number: <strong>{generateInvoiceExample()}</strong>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Terms</CardTitle>
          <CardDescription>Configure default payment terms for invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="payment_terms">Default Payment Terms</Label>
            <Select
              value={settings.default_payment_terms}
              onValueChange={(value) => updateSetting("default_payment_terms", value)}
            >
              <SelectTrigger id="payment_terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((term) => (
                  <SelectItem key={term.value} value={term.value}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {selectedPaymentTerms?.days !== null
                ? `Due ${selectedPaymentTerms?.days} days after invoice date`
                : "Custom payment terms"}
            </p>
          </div>

          {settings.default_payment_terms === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom_terms_days">Custom Payment Terms (Days)</Label>
              <Input
                id="custom_terms_days"
                type="number"
                min="1"
                max="365"
                value={settings.custom_payment_terms_days || ""}
                onChange={(e) =>
                  updateSetting("custom_payment_terms_days", parseInt(e.target.value) || null)
                }
                placeholder="Number of days"
              />
              <p className="text-sm text-muted-foreground">
                Payment due within {settings.custom_payment_terms_days || "N"} days
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Late Fees</CardTitle>
          <CardDescription>Configure late fees for overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="late_fee_enabled">Enable Late Fees</Label>
              <p className="text-sm text-muted-foreground">Charge late fees on overdue invoices</p>
            </div>
            <Switch
              id="late_fee_enabled"
              checked={settings.late_fee_enabled}
              onCheckedChange={(checked) => updateSetting("late_fee_enabled", checked)}
            />
          </div>

          {settings.late_fee_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="late_fee_type">Late Fee Type</Label>
                <Select
                  value={settings.late_fee_type}
                  onValueChange={(value) => updateSetting("late_fee_type", value)}
                >
                  <SelectTrigger id="late_fee_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LATE_FEE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{selectedLateFeeType?.example}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="late_fee_amount">
                  Late Fee Amount {settings.late_fee_type === "percentage" ? "(%)" : "($)"}
                </Label>
                <Input
                  id="late_fee_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.late_fee_amount}
                  onChange={(e) => updateSetting("late_fee_amount", parseFloat(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  {settings.late_fee_type === "percentage"
                    ? `${settings.late_fee_amount}% of invoice amount`
                    : `$${settings.late_fee_amount.toFixed(2)} per invoice`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="late_fee_grace">Grace Period (Days)</Label>
                  <Input
                    id="late_fee_grace"
                    type="number"
                    min="0"
                    max="30"
                    value={settings.late_fee_grace_days}
                    onChange={(e) => updateSetting("late_fee_grace_days", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Days after due date before late fee applies
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="late_fee_max">Maximum Late Fee ($)</Label>
                  <Input
                    id="late_fee_max"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.late_fee_max_amount || ""}
                    onChange={(e) =>
                      updateSetting("late_fee_max_amount", parseFloat(e.target.value) || null)
                    }
                    placeholder="No cap"
                  />
                  <p className="text-sm text-muted-foreground">
                    {settings.late_fee_max_amount
                      ? `Cap at $${settings.late_fee_max_amount}`
                      : "No maximum"}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dunning Configuration</CardTitle>
          <CardDescription>Configure automated collection for overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dunning_enabled">Enable Dunning</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send collection notices for overdue invoices
              </p>
            </div>
            <Switch
              id="dunning_enabled"
              checked={settings.dunning_enabled}
              onCheckedChange={(checked) => updateSetting("dunning_enabled", checked)}
            />
          </div>

          {settings.dunning_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dunning_strategy">Dunning Strategy</Label>
                <Select
                  value={settings.dunning_strategy}
                  onValueChange={(value) => updateSetting("dunning_strategy", value)}
                >
                  <SelectTrigger id="dunning_strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DUNNING_STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.value} value={strategy.value}>
                        {strategy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedDunningStrategy?.description}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_notice">First Notice (Days)</Label>
                  <Input
                    id="first_notice"
                    type="number"
                    min="0"
                    max="30"
                    value={settings.dunning_first_notice_days}
                    onChange={(e) =>
                      updateSetting("dunning_first_notice_days", parseInt(e.target.value))
                    }
                  />
                  <p className="text-sm text-muted-foreground">Days after due date</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="escalation">Escalation (Days)</Label>
                  <Input
                    id="escalation"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.dunning_escalation_days}
                    onChange={(e) =>
                      updateSetting("dunning_escalation_days", parseInt(e.target.value))
                    }
                  />
                  <p className="text-sm text-muted-foreground">Days between notices</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_notices">Max Notices</Label>
                  <Input
                    id="max_notices"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.dunning_max_notices}
                    onChange={(e) => updateSetting("dunning_max_notices", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">Before suspension</p>
                </div>
              </div>

              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Dunning Timeline:</strong>
                  <br />
                  1st notice: {settings.dunning_first_notice_days} days after due date
                  <br />
                  {settings.dunning_max_notices > 1 && (
                    <>
                      2nd-{settings.dunning_max_notices}th notices: Every{" "}
                      {settings.dunning_escalation_days} days
                    </>
                  )}
                  <br />
                  Suspension: After {settings.dunning_max_notices} notices (~
                  {settings.dunning_first_notice_days +
                    (settings.dunning_max_notices - 1) * settings.dunning_escalation_days}{" "}
                  days)
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Customization</CardTitle>
          <CardDescription>Customize invoice appearance and content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="invoice_logo">Invoice Logo URL</Label>
            <Input
              id="invoice_logo"
              value={settings.invoice_logo_url || ""}
              onChange={(e) => updateSetting("invoice_logo_url", e.target.value || null)}
              placeholder="https://cdn.example.com/logo.png"
            />
            <p className="text-sm text-muted-foreground">
              URL to company logo displayed on invoices
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_footer">Invoice Footer Text</Label>
            <Textarea
              id="invoice_footer"
              value={settings.invoice_footer_text || ""}
              onChange={(e) => updateSetting("invoice_footer_text", e.target.value || null)}
              placeholder="Thank you for your business!"
              rows={2}
              maxLength={500}
            />
            <p className="text-sm text-muted-foreground">
              Text displayed at bottom of invoices (max 500 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_notes">Default Invoice Notes</Label>
            <Textarea
              id="invoice_notes"
              value={settings.invoice_notes || ""}
              onChange={(e) => updateSetting("invoice_notes", e.target.value || null)}
              placeholder="Payment terms, banking details, or other notes..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-sm text-muted-foreground">
              Default notes on all invoices (max 1000 characters)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Billing</CardTitle>
          <CardDescription>Configure automatic payment collection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_billing">Enable Auto-Billing</Label>
              <p className="text-sm text-muted-foreground">
                Automatically charge saved payment method on due date
              </p>
            </div>
            <Switch
              id="auto_billing"
              checked={settings.auto_billing_enabled}
              onCheckedChange={(checked) => updateSetting("auto_billing_enabled", checked)}
            />
          </div>

          {settings.auto_billing_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto_retry">Enable Payment Retries</Label>
                  <p className="text-sm text-muted-foreground">
                    Retry failed auto-billing attempts automatically
                  </p>
                </div>
                <Switch
                  id="auto_retry"
                  checked={settings.auto_billing_retry_enabled}
                  onCheckedChange={(checked) =>
                    updateSetting("auto_billing_retry_enabled", checked)
                  }
                />
              </div>

              {settings.auto_billing_retry_enabled && (
                <div className="space-y-2">
                  <Label>Retry Schedule (Days After Failure)</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.auto_billing_retry_days.map((day, index) => (
                      <Badge key={index} variant="secondary">
                        Day {day}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Default: Retry on days 3, 7, and 14 after failed attempt
                  </p>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Auto-billing requires customers to have a valid payment method on file. Failed
                  payments trigger dunning if enabled.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Configuration Summary</CardTitle>
          <CardDescription>Overview of current billing settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Invoice Configuration:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>
                  Format:{" "}
                  {
                    INVOICE_FORMATS.find((f) => f.value === settings.invoice_numbering_format)
                      ?.label
                  }
                </li>
                <li>Next number: {generateInvoiceExample()}</li>
                <li>Payment terms: {selectedPaymentTerms?.label}</li>
              </ul>
            </div>

            {settings.late_fee_enabled && (
              <div>
                <h4 className="font-medium mb-2">Late Fees:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Type: {selectedLateFeeType?.label}</li>
                  <li>
                    Amount:{" "}
                    {settings.late_fee_type === "percentage"
                      ? `${settings.late_fee_amount}%`
                      : `$${settings.late_fee_amount}`}
                  </li>
                  <li>Grace period: {settings.late_fee_grace_days} days</li>
                  {settings.late_fee_max_amount && (
                    <li>Maximum: ${settings.late_fee_max_amount}</li>
                  )}
                </ul>
              </div>
            )}

            {settings.dunning_enabled && (
              <div>
                <h4 className="font-medium mb-2">Dunning:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Strategy: {selectedDunningStrategy?.label}</li>
                  <li>First notice: {settings.dunning_first_notice_days} days after due</li>
                  <li>Escalation: Every {settings.dunning_escalation_days} days</li>
                  <li>Max notices: {settings.dunning_max_notices}</li>
                </ul>
              </div>
            )}

            {settings.auto_billing_enabled && (
              <div>
                <h4 className="font-medium mb-2">Auto-Billing:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Enabled: Yes</li>
                  <li>
                    Retries:{" "}
                    {settings.auto_billing_retry_enabled
                      ? `Yes (${settings.auto_billing_retry_days.join(", ")} days)`
                      : "No"}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
