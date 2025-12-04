/**
 * AddPaymentMethodModal Component
 *
 * Modal for adding payment methods (card, bank account, wallet).
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import { CreditCard, Building2, Wallet, AlertCircle } from "lucide-react";
import React, { useState } from "react";

export interface AddPaymentMethodRequest {
  method_type: "card" | "bank_account" | "wallet";

  // Tokens from Stripe.js
  card_token?: string;
  bank_token?: string;
  bank_account_token?: string;
  wallet_token?: string;

  // Bank account details
  bank_name?: string;
  bank_account_type?: string;

  // Billing details
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;

  set_as_default?: boolean;
}

interface Logger {
  error: (message: string, error: Error, context?: any) => void;
}

export interface AddPaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPaymentMethod: (request: AddPaymentMethodRequest) => Promise<void>;
  isAdding?: boolean;
  error?: string | null;
  logger?: Logger;
}

export const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  open,
  onOpenChange,
  onAddPaymentMethod,
  isAdding = false,
  error = null,
  logger = console,
}) => {
  const [methodType, setMethodType] = useState<"card" | "bank_account" | "wallet">("card");
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Card details (simulated - in production, use Stripe Elements)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCvc] = useState("");

  // Bank account details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");

  // Billing details (shared)
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddressLine1, setBillingAddressLine1] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("US");

  const resetForm = () => {
    setCardNumber("");
    setCardExpiry("");
    setCvc("");
    setBankName("");
    setAccountNumber("");
    setRoutingNumber("");
    setBillingName("");
    setBillingEmail("");
    setBillingAddressLine1("");
    setBillingCity("");
    setBillingState("");
    setBillingPostalCode("");
    setBillingCountry("US");
    setSetAsDefault(false);
  };

  const handleSubmit = async () => {
    try {
      let request: AddPaymentMethodRequest;

      if (methodType === "card") {
        // In production: Use Stripe.js to tokenize card
        // const { token } = await stripe.createToken(cardElement);

        // Simulated token for demo purposes
        const simulatedCardToken = `tok_${Math.random().toString(36).substring(7)}`;

        request = {
          method_type: "card",
          card_token: simulatedCardToken,
          billing_name: billingName,
          billing_email: billingEmail,
          billing_address_line1: billingAddressLine1,
          billing_city: billingCity,
          billing_state: billingState,
          billing_postal_code: billingPostalCode,
          billing_country: billingCountry,
          set_as_default: setAsDefault,
        };
      } else if (methodType === "bank_account") {
        // In production: Use Stripe.js to tokenize bank account
        // const { token } = await stripe.createToken('bank_account', { ... });

        // Simulated token for demo purposes
        const simulatedBankToken = `btok_${Math.random().toString(36).substring(7)}`;

        request = {
          method_type: "bank_account",
          bank_account_token: simulatedBankToken,
          bank_name: bankName,
          bank_account_type: accountType,
          billing_name: billingName,
          billing_email: billingEmail,
          set_as_default: setAsDefault,
        };
      } else {
        // Wallet integration would use Stripe Payment Request Button
        throw new Error("Wallet payments not yet implemented");
      }

      await onAddPaymentMethod(request);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      logger.error(
        "Failed to add payment method",
        err instanceof Error ? err : new Error(String(err)),
        { methodType },
      );
    }
  };

  const isFormValid = () => {
    if (!billingName || !billingEmail) return false;

    if (methodType === "card") {
      return cardNumber.length >= 13 && cardExpiry.length >= 4 && cardCvc.length >= 3;
    }

    if (methodType === "bank_account") {
      return bankName && accountNumber.length >= 4 && routingNumber.length >= 9;
    }

    return false;
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a new payment method to your account. Your information is encrypted and secure.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={methodType} onValueChange={(value) => setMethodType(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Card
            </TabsTrigger>
            <TabsTrigger value="bank_account" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Bank Account
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2" disabled>
              <Wallet className="w-4 h-4" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Card Payment Tab */}
          <TabsContent value="card" className="space-y-4">
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                In production, this would use Stripe Elements for PCI-compliant card collection.
                Card data is tokenized client-side and never touches your server.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={formatCardNumber(cardNumber)}
                onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, "").substring(0, 16))}
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardExpiry">Expiration (MM/YY)</Label>
                <Input
                  id="cardExpiry"
                  placeholder="12/25"
                  value={formatExpiry(cardExpiry)}
                  onChange={(e) => setCardExpiry(e.target.value.replace(/\D/g, "").substring(0, 4))}
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardCvc">CVC</Label>
                <Input
                  id="cardCvc"
                  type="password"
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").substring(0, 4))}
                  maxLength={4}
                />
              </div>
            </div>
          </TabsContent>

          {/* Bank Account Tab */}
          <TabsContent value="bank_account" className="space-y-4">
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                <strong>Bank account verification required:</strong> After adding, you&apos;ll
                receive 2 small deposits within 1-2 business days. Verify these amounts to activate
                the account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="Chase Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routingNumber">Routing Number</Label>
              <Input
                id="routingNumber"
                placeholder="021000021"
                value={routingNumber}
                onChange={(e) =>
                  setRoutingNumber(e.target.value.replace(/\D/g, "").substring(0, 9))
                }
                maxLength={9}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                type="password"
                placeholder="000123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === "checking"}
                    onChange={() => setAccountType("checking")}
                  />
                  <span>Checking</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === "savings"}
                    onChange={() => setAccountType("savings")}
                  />
                  <span>Savings</span>
                </label>
              </div>
            </div>
          </TabsContent>

          {/* Wallet Tab (Placeholder) */}
          <TabsContent value="wallet" className="space-y-4">
            <div className="rounded-md bg-gray-500/10 border border-gray-500/20 p-6 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Digital wallet integration coming soon.
                <br />
                (Apple Pay, Google Pay, etc.)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Billing Details (Shared) */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Billing Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingName">Full Name *</Label>
              <Input
                id="billingName"
                placeholder="John Doe"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Email *</Label>
              <Input
                id="billingEmail"
                type="email"
                placeholder="john@example.com"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingAddressLine1">Address</Label>
            <Input
              id="billingAddressLine1"
              placeholder="123 Main St"
              value={billingAddressLine1}
              onChange={(e) => setBillingAddressLine1(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingCity">City</Label>
              <Input
                id="billingCity"
                placeholder="San Francisco"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingState">State</Label>
              <Input
                id="billingState"
                placeholder="CA"
                value={billingState}
                onChange={(e) => setBillingState(e.target.value)}
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPostalCode">ZIP Code</Label>
              <Input
                id="billingPostalCode"
                placeholder="94102"
                value={billingPostalCode}
                onChange={(e) => setBillingPostalCode(e.target.value)}
                maxLength={10}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="setAsDefault"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
            />
            <label
              htmlFor="setAsDefault"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Set as default payment method
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isAdding || !isFormValid()}>
            {isAdding ? "Adding..." : "Add Payment Method"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
