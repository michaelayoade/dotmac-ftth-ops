"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { PaymentMethod } from "@/hooks/useTenantPaymentMethods";
import { CustomerPaymentMethod } from "@/hooks/useCustomerPortal";
import { CreditCard, Building2, Wallet, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod | CustomerPaymentMethod;
  onSetDefault?: (paymentMethodId: string) => void;
  onRemove?: (paymentMethodId: string) => void;
  onVerify?: (paymentMethodId: string) => void;
  isUpdating?: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  pending_verification: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  verification_failed: "bg-red-500/10 text-red-500 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const getCardBrandIcon = (brand?: string) => {
  // Return emoji or use actual brand icons
  const icons: Record<string, string> = {
    visa: "💳",
    mastercard: "💳",
    amex: "💳",
    discover: "💳",
    diners: "💳",
    jcb: "💳",
    unionpay: "💳",
    unknown: "💳",
  };
  return icons[brand || "unknown"] || "💳";
};

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  paymentMethod,
  onSetDefault,
  onRemove,
  onVerify,
  isUpdating = false,
}) => {
  const getMethodIcon = () => {
    switch (paymentMethod.method_type) {
      case "card":
        return <CreditCard className="w-5 h-5" />;
      case "bank_account":
        return <Building2 className="w-5 h-5" />;
      case "wallet":
        return <Wallet className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const getMethodDisplay = () => {
    if (paymentMethod.method_type === "card") {
      return {
        title: `${paymentMethod.card_brand?.toUpperCase() || "Card"} •••• ${paymentMethod.card_last4}`,
        subtitle:
          paymentMethod.card_exp_month && paymentMethod.card_exp_year
            ? `Expires ${String(paymentMethod.card_exp_month).padStart(2, "0")}/${paymentMethod.card_exp_year}`
            : null,
        icon: getCardBrandIcon(paymentMethod.card_brand),
      };
    }

    if (paymentMethod.method_type === "bank_account") {
      return {
        title: `${paymentMethod.bank_name || "Bank Account"} •••• ${paymentMethod.bank_account_last4}`,
        subtitle: paymentMethod.bank_account_type
          ? paymentMethod.bank_account_type.charAt(0).toUpperCase() +
            paymentMethod.bank_account_type.slice(1)
          : null,
        icon: "🏦",
      };
    }

    if (paymentMethod.method_type === "wallet") {
      return {
        title: paymentMethod.wallet_type || "Digital Wallet",
        subtitle: null,
        icon: "📱",
      };
    }

    return {
      title: paymentMethod.method_type.replace("_", " ").toUpperCase(),
      subtitle: null,
      icon: "💳",
    };
  };

  const display = getMethodDisplay();
  const statusColor = statusColors[paymentMethod.status] || statusColors["active"];

  const needsVerification =
    paymentMethod.status === "pending_verification" && paymentMethod.method_type === "bank_account";

  return (
    <Card variant="default" className={paymentMethod.is_default ? "ring-2 ring-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
              {display.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{display.title}</p>
                {paymentMethod.is_default && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">Default</Badge>
                )}
              </div>
              {display.subtitle && (
                <p className="text-sm text-muted-foreground">{display.subtitle}</p>
              )}
            </div>
          </div>

          <Badge className={statusColor}>
            {paymentMethod.status === "pending_verification" ? (
              <Clock className="w-3 h-3 mr-1" />
            ) : paymentMethod.status === "verification_failed" ? (
              <AlertCircle className="w-3 h-3 mr-1" />
            ) : paymentMethod.is_verified ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : null}
            {paymentMethod.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Billing Details */}
        {paymentMethod.billing_name && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Billing Information</p>
            <p className="text-sm">{paymentMethod.billing_name}</p>
            {paymentMethod.billing_email && (
              <p className="text-sm text-muted-foreground">{paymentMethod.billing_email}</p>
            )}
            {paymentMethod.billing_address_line1 && (
              <p className="text-sm text-muted-foreground">
                {paymentMethod.billing_address_line1}
                {paymentMethod.billing_city && `, ${paymentMethod.billing_city}`}
                {paymentMethod.billing_state && `, ${paymentMethod.billing_state}`}
                {paymentMethod.billing_postal_code && ` ${paymentMethod.billing_postal_code}`}
              </p>
            )}
          </div>
        )}

        {/* Verification Notice */}
        {needsVerification && (
          <div className="mt-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              <strong>Verification Required:</strong> Check your bank statement for 2 small deposits
              and verify this account.
            </p>
          </div>
        )}

        {/* Verification Failed */}
        {paymentMethod.status === "verification_failed" && (
          <div className="mt-3 rounded-md bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-600 dark:text-red-500">
              Verification failed. Please try again or contact support.
            </p>
          </div>
        )}

        {/* Expired Notice */}
        {paymentMethod.status === "expired" && (
          <div className="mt-3 rounded-md bg-gray-500/10 border border-gray-500/20 p-3">
            <p className="text-sm text-muted-foreground">
              This payment method has expired. Please add a new one.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {needsVerification && onVerify && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onVerify(paymentMethod.payment_method_id)}
            disabled={isUpdating}
            className="flex-1"
          >
            Verify Account
          </Button>
        )}

        {!paymentMethod.is_default && paymentMethod.status === "active" && onSetDefault && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetDefault(paymentMethod.payment_method_id)}
            disabled={isUpdating}
            className="flex-1"
          >
            {isUpdating ? "Setting..." : "Set as Default"}
          </Button>
        )}

        {onRemove && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(paymentMethod.payment_method_id)}
            disabled={isUpdating || paymentMethod.is_default}
            className="flex-1"
          >
            {isUpdating ? "Removing..." : "Remove"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
