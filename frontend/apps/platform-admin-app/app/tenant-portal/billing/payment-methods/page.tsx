"use client";

import React, { useState } from "react";
import {
  useTenantPaymentMethods,
  VerifyPaymentMethodRequest,
  type AddPaymentMethodRequest,
} from "@/hooks/useTenantPaymentMethods";
import { PaymentMethodCard } from "@/components/tenant/billing/PaymentMethodCard";
import { AddPaymentMethodModal } from "@/components/tenant/billing/AddPaymentMethodModal";
import { PaymentMethodsPageSkeleton } from "@/components/tenant/billing/SkeletonLoaders";
import { Card, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { AlertCircle, CreditCard, Plus, Shield, Lock } from "lucide-react";

export default function PaymentMethodsPage() {
  const {
    paymentMethods,
    defaultPaymentMethod,
    loading,
    error,
    addPaymentMethod,
    setDefaultPaymentMethod,
    removePaymentMethod,
    verifyPaymentMethod,
  } = useTenantPaymentMethods();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Verification state
  const [paymentMethodToVerify, setPaymentMethodToVerify] = useState<string | null>(null);
  const [microdeposit1, setMicrodeposit1] = useState("");
  const [microdeposit2, setMicrodeposit2] = useState("");

  // Remove state
  const [paymentMethodToRemove, setPaymentMethodToRemove] = useState<string | null>(null);

  const handleAddPaymentMethod = async (request: unknown) => {
    setIsAdding(true);
    setModalError(null);

    try {
      await addPaymentMethod(request as AddPaymentMethodRequest);
      setAddModalOpen(false);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setModalError(e.message || "Failed to add payment method");
      throw err;
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setIsUpdating(true);
    try {
      await setDefaultPaymentMethod(paymentMethodId);
    } catch (err: unknown) {
      console.error("Failed to set default payment method:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = (paymentMethodId: string) => {
    setPaymentMethodToRemove(paymentMethodId);
    setRemoveModalOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!paymentMethodToRemove) return;

    setIsUpdating(true);
    try {
      await removePaymentMethod(paymentMethodToRemove);
      setRemoveModalOpen(false);
      setPaymentMethodToRemove(null);
    } catch (err: unknown) {
      console.error("Failed to remove payment method:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerify = (paymentMethodId: string) => {
    setPaymentMethodToVerify(paymentMethodId);
    setMicrodeposit1("");
    setMicrodeposit2("");
    setVerifyModalOpen(true);
  };

  const handleConfirmVerify = async () => {
    if (!paymentMethodToVerify) return;

    setIsUpdating(true);
    setModalError(null);

    try {
      const request: VerifyPaymentMethodRequest = {
        verification_amounts: [parseFloat(microdeposit1), parseFloat(microdeposit2)],
        verification_code1: microdeposit1,
        verification_code2: microdeposit2,
      };
      await verifyPaymentMethod(paymentMethodToVerify, request);
      setVerifyModalOpen(false);
      setPaymentMethodToVerify(null);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setModalError(e.message || "Verification failed. Please check the amounts and try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading && paymentMethods.length === 0) {
    return <PaymentMethodsPageSkeleton />;
  }

  if (error && paymentMethods.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="text-muted-foreground">
            Manage your payment methods and billing information.
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Payment Method
        </Button>
      </div>

      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>
              <strong>Secure Payment Processing:</strong> All payment information is encrypted and
              securely processed. We never store your full card number or CVV.
            </span>
          </div>
        </AlertDescription>
      </Alert>

      {/* Payment Methods List */}
      {paymentMethods.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentMethods.map((method) => (
              <PaymentMethodCard
                key={method.payment_method_id}
                paymentMethod={method}
                onSetDefault={handleSetDefault}
                onRemove={handleRemove}
                onVerify={handleVerify}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Payment Methods</h3>
            <p className="text-muted-foreground mb-6">
              Add a payment method to manage your subscription and make purchases.
            </p>
            <Button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Your First Payment Method
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Default Payment Method Info */}
      {defaultPaymentMethod && (
        <Alert>
          <AlertDescription>
            <strong>Default Payment Method:</strong> Your{" "}
            {defaultPaymentMethod.method_type === "card" ? "card" : "bank account"} ending in{" "}
            {defaultPaymentMethod.method_type === "card"
              ? defaultPaymentMethod.card_last4
              : defaultPaymentMethod.bank_account_last4}{" "}
            will be used for automatic billing.
          </AlertDescription>
        </Alert>
      )}

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAddPaymentMethod={handleAddPaymentMethod}
        isAdding={isAdding}
        error={modalError}
      />

      {/* Verify Payment Method Modal */}
      <Dialog open={verifyModalOpen} onOpenChange={setVerifyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Bank Account</DialogTitle>
            <DialogDescription>
              Check your bank statement for 2 small deposits (typically less than $1.00) and enter
              the exact amounts below.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="microdeposit1">First Deposit Amount (e.g., 0.32)</Label>
              <Input
                id="microdeposit1"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="0.00"
                value={microdeposit1}
                onChange={(e) => setMicrodeposit1(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="microdeposit2">Second Deposit Amount (e.g., 0.45)</Label>
              <Input
                id="microdeposit2"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="0.00"
                value={microdeposit2}
                onChange={(e) => setMicrodeposit2(e.target.value)}
              />
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                These deposits typically appear within 1-2 business days. If you don&apos;t see them
                yet, please check again later.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVerifyModalOpen(false);
                setPaymentMethodToVerify(null);
                setModalError(null);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmVerify}
              disabled={isUpdating || !microdeposit1 || !microdeposit2}
            >
              {isUpdating ? "Verifying..." : "Verify Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Payment Method Modal */}
      <Dialog open={removeModalOpen} onOpenChange={setRemoveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              If this is your only payment method, you may need to add a new one before your next
              billing cycle.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveModalOpen(false);
                setPaymentMethodToRemove(null);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove} disabled={isUpdating}>
              {isUpdating ? "Removing..." : "Remove Payment Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
