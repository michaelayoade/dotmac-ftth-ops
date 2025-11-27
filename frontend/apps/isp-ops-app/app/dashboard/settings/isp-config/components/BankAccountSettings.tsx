/**
 * Bank Account & Payment Gateway Settings Component
 *
 * Configures default bank accounts, payment methods, payment gateways,
 * and reconciliation settings.
 */

import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@dotmac/ui";
import { Info, Building2, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";

interface BankAccountSettingsProps {
  settings: {
    default_bank_account_id: number | null;
    default_bank_account_name: string | null;
    payment_methods_enabled: string[];
    stripe_enabled: boolean;
    paypal_enabled: boolean;
    paystack_enabled: boolean;
    flutterwave_enabled: boolean;
    bank_transfer_enabled: boolean;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_routing_number: string | null;
    bank_iban: string | null;
    bank_swift_code: string | null;
    auto_reconcile_enabled: boolean;
    require_payment_reference: boolean;
    payment_reference_format: string;
  };
  onChange: (settings: any) => void;
}

const PAYMENT_METHODS = [
  {
    value: "card",
    label: "Credit/Debit Card",
    icon: "💳",
    description: "Card payments via gateway",
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
    icon: "🏦",
    description: "Direct bank transfers",
  },
  { value: "check", label: "Check", icon: "✅", description: "Paper checks" },
  { value: "cash", label: "Cash", icon: "💵", description: "Cash payments" },
  { value: "crypto", label: "Cryptocurrency", icon: "₿", description: "Bitcoin, Ethereum, etc." },
];

const PAYMENT_GATEWAYS = [
  {
    key: "stripe",
    label: "Stripe",
    logo: "💳",
    description: "Global payment processing",
    regions: ["Global"],
  },
  {
    key: "paypal",
    label: "PayPal",
    logo: "🅿️",
    description: "PayPal and credit cards",
    regions: ["Global"],
  },
  {
    key: "paystack",
    label: "Paystack",
    logo: "📱",
    description: "African payment gateway",
    regions: ["Nigeria", "Ghana", "South Africa", "Kenya"],
  },
  {
    key: "flutterwave",
    label: "Flutterwave",
    logo: "🦋",
    description: "Pan-African payments",
    regions: ["Africa", "34+ countries"],
  },
];

export function BankAccountSettings({ settings, onChange }: BankAccountSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const togglePaymentMethod = (method: string) => {
    const current = settings.payment_methods_enabled || [];
    if (current.includes(method)) {
      updateSetting(
        "payment_methods_enabled",
        current.filter((m) => m !== method),
      );
    } else {
      updateSetting("payment_methods_enabled", [...current, method]);
    }
  };

  const isPaymentMethodEnabled = (method: string): boolean => {
    return settings.payment_methods_enabled?.includes(method) || false;
  };

  const enabledGatewaysCount = [
    settings.stripe_enabled,
    settings.paypal_enabled,
    settings.paystack_enabled,
    settings.flutterwave_enabled,
  ].filter(Boolean).length;

  const enabledPaymentMethodsCount = settings.payment_methods_enabled?.length || 0;

  return (
    <div className="space-y-6">
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Configure payment methods and bank accounts for receiving customer payments. Payment
          gateway credentials are configured separately in integrations settings.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Default Bank Account</CardTitle>
          <CardDescription>Configure default bank account for payment tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="bank_account_name">Bank Account Name</Label>
            <Input
              id="bank_account_name"
              value={settings.default_bank_account_name || ""}
              onChange={(e) => updateSetting("default_bank_account_name", e.target.value || null)}
              placeholder="Main Operating Account"
            />
            <p className="text-sm text-muted-foreground">
              Friendly name for your primary bank account
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Bank account details configured here are used for payment tracking and reconciliation.
              Actual bank accounts are managed in the Banking section.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accepted Payment Methods</CardTitle>
          <CardDescription>Select which payment methods you accept from customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.value}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <div className="font-medium">{method.label}</div>
                    <div className="text-sm text-muted-foreground">{method.description}</div>
                  </div>
                </div>
                <Switch
                  checked={isPaymentMethodEnabled(method.value)}
                  onCheckedChange={() => togglePaymentMethod(method.value)}
                />
              </div>
            ))}
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {enabledPaymentMethodsCount} payment method
              {enabledPaymentMethodsCount !== 1 ? "s" : ""} enabled. Customers can use any enabled
              method during checkout.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Gateways</CardTitle>
          <CardDescription>Enable payment gateway integrations for online payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PAYMENT_GATEWAYS.map((gateway) => (
            <div key={gateway.key} className="flex items-center justify-between p-4 border rounded">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{gateway.logo}</span>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {gateway.label}
                    {settings[`${gateway.key}_enabled` as keyof typeof settings] && (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{gateway.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Regions: {gateway.regions.join(", ")}
                  </div>
                </div>
              </div>
              <Switch
                checked={settings[`${gateway.key}_enabled` as keyof typeof settings] as boolean}
                onCheckedChange={(checked) => updateSetting(`${gateway.key}_enabled`, checked)}
              />
            </div>
          ))}

          {enabledGatewaysCount === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No payment gateways enabled. Enable at least one gateway to accept online payments.
              </AlertDescription>
            </Alert>
          )}

          {enabledGatewaysCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {enabledGatewaysCount} payment gateway{enabledGatewaysCount !== 1 ? "s" : ""}{" "}
                enabled. Configure API credentials in Settings → Integrations.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Transfer Details</CardTitle>
          <CardDescription>
            Bank account information shown to customers for direct transfers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <Label htmlFor="bank_transfer_toggle">Enable Bank Transfers</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to pay via direct bank transfer
              </p>
            </div>
            <Switch
              id="bank_transfer_toggle"
              checked={settings.bank_transfer_enabled}
              onCheckedChange={(checked) => updateSetting("bank_transfer_enabled", checked)}
            />
          </div>

          {settings.bank_transfer_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={settings.bank_name || ""}
                  onChange={(e) => updateSetting("bank_name", e.target.value || null)}
                  placeholder="First National Bank"
                />
                <p className="text-sm text-muted-foreground">Name of your bank</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={settings.bank_account_number || ""}
                    onChange={(e) => updateSetting("bank_account_number", e.target.value || null)}
                    placeholder="1234567890"
                  />
                  <p className="text-sm text-muted-foreground">Bank account number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="routing_number">Routing Number</Label>
                  <Input
                    id="routing_number"
                    value={settings.bank_routing_number || ""}
                    onChange={(e) => updateSetting("bank_routing_number", e.target.value || null)}
                    placeholder="021000021"
                  />
                  <p className="text-sm text-muted-foreground">Routing/Sort code</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN (International)</Label>
                  <Input
                    id="iban"
                    value={settings.bank_iban || ""}
                    onChange={(e) => updateSetting("bank_iban", e.target.value || null)}
                    placeholder="GB82 WEST 1234 5698 7654 32"
                  />
                  <p className="text-sm text-muted-foreground">International Bank Account Number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="swift">SWIFT/BIC Code</Label>
                  <Input
                    id="swift"
                    value={settings.bank_swift_code || ""}
                    onChange={(e) => updateSetting("bank_swift_code", e.target.value || null)}
                    placeholder="BOFAUS3N"
                  />
                  <p className="text-sm text-muted-foreground">Bank identifier code</p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This information is displayed to customers on invoices and payment pages when they
                  select bank transfer as payment method.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Reconciliation</CardTitle>
          <CardDescription>Configure automatic payment matching and reconciliation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_reconcile">Enable Auto-Reconciliation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically match imported bank statements to invoices
              </p>
            </div>
            <Switch
              id="auto_reconcile"
              checked={settings.auto_reconcile_enabled}
              onCheckedChange={(checked) => updateSetting("auto_reconcile_enabled", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require_reference">Require Payment Reference</Label>
              <p className="text-sm text-muted-foreground">
                Customers must include reference in bank transfers
              </p>
            </div>
            <Switch
              id="require_reference"
              checked={settings.require_payment_reference}
              onCheckedChange={(checked) => updateSetting("require_payment_reference", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_format">Payment Reference Format</Label>
            <Input
              id="reference_format"
              value={settings.payment_reference_format}
              onChange={(e) => updateSetting("payment_reference_format", e.target.value)}
              placeholder="INV-{invoice_number}"
            />
            <p className="text-sm text-muted-foreground">
              Format for payment references. Variables: {"{invoice_number}"}, {"{customer_id}"}
            </p>
          </div>

          {settings.require_payment_reference && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Example reference:{" "}
                <strong>
                  {settings.payment_reference_format.replace("{invoice_number}", "000123")}
                </strong>
                <br />
                Customers see this reference on invoices and payment instructions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Configuration Summary</CardTitle>
          <CardDescription>Overview of enabled payment options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Payment Methods:</h4>
              <div className="flex flex-wrap gap-2">
                {settings.payment_methods_enabled?.map((method) => {
                  const methodInfo = PAYMENT_METHODS.find((m) => m.value === method);
                  return (
                    <Badge key={method} variant="secondary">
                      {methodInfo?.icon} {methodInfo?.label}
                    </Badge>
                  );
                })}
                {enabledPaymentMethodsCount === 0 && (
                  <span className="text-sm text-muted-foreground">None enabled</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Payment Gateways:</h4>
              <div className="flex flex-wrap gap-2">
                {settings.stripe_enabled && <Badge>Stripe</Badge>}
                {settings.paypal_enabled && <Badge>PayPal</Badge>}
                {settings.paystack_enabled && <Badge>Paystack</Badge>}
                {settings.flutterwave_enabled && <Badge>Flutterwave</Badge>}
                {enabledGatewaysCount === 0 && (
                  <span className="text-sm text-muted-foreground">None enabled</span>
                )}
              </div>
            </div>

            {settings.bank_transfer_enabled && (
              <div>
                <h4 className="font-medium mb-2">Bank Transfer:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Bank: {settings.bank_name || "Not configured"}</li>
                  <li>Account: {settings.bank_account_number ? "Configured" : "Not configured"}</li>
                  {settings.bank_iban && <li>IBAN: Configured</li>}
                  {settings.bank_swift_code && <li>SWIFT: Configured</li>}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">Reconciliation:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Auto-reconcile: {settings.auto_reconcile_enabled ? "Enabled" : "Disabled"}</li>
                <li>Reference required: {settings.require_payment_reference ? "Yes" : "No"}</li>
                <li>Reference format: {settings.payment_reference_format}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
