"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  CreditCard,
  Building2,
  Wallet,
  ArrowLeft,
  Star,
  Shield,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MapPin,
  User,
  Mail,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useTenantPaymentMethods, type PaymentMethod } from "@/hooks/useTenantPaymentMethods";
import Link from "next/link";
import { format } from "date-fns";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// Mock transaction history - in production, fetch from API
interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  date: string;
  invoice_id?: string;
}

export default function PaymentMethodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const paymentMethodId = params["id"] as string;

  const {
    paymentMethods,
    loading,
    setDefaultPaymentMethod,
    removePaymentMethod,
    verifyPaymentMethod,
  } = useTenantPaymentMethods();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // Verification amounts
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    return `${format(date, "MMM d, yyyy")} at ${format(date, "h:mm a")}`;
  };

  // Find the payment method
  useEffect(() => {
    const method = paymentMethods.find((m) => m.payment_method_id === paymentMethodId);
    if (method) {
      setPaymentMethod(method);
    }
  }, [paymentMethods, paymentMethodId]);

  // Fetch transaction history
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!paymentMethodId) return;

      setLoadingTransactions(true);
      try {
        // In production, this would be a real API call
        // const response = await apiClient.get(`/billing/payment-methods/${paymentMethodId}/transactions`);
        // setTransactions(response.data);

        // Mock data for now
        setTransactions([
          {
            id: "txn_1",
            amount: 9900,
            currency: "USD",
            status: "succeeded",
            description: "Monthly subscription - Pro Plan",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            invoice_id: "inv_001",
          },
          {
            id: "txn_2",
            amount: 9900,
            currency: "USD",
            status: "succeeded",
            description: "Monthly subscription - Pro Plan",
            date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            invoice_id: "inv_002",
          },
          {
            id: "txn_3",
            amount: 9900,
            currency: "USD",
            status: "succeeded",
            description: "Monthly subscription - Pro Plan",
            date: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
            invoice_id: "inv_003",
          },
        ]);
      } catch (error) {
        logger.error("Failed to fetch transactions", error);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchTransactions();
  }, [paymentMethodId]);

  const handleSetDefault = async () => {
    if (!paymentMethod) return;

    setIsSettingDefault(true);
    try {
      await setDefaultPaymentMethod(paymentMethod.payment_method_id);
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default payment method",
        variant: "destructive",
      });
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleVerify = async () => {
    if (!paymentMethod) return;

    const amt1 = parseFloat(amount1);
    const amt2 = parseFloat(amount2);

    if (isNaN(amt1) || isNaN(amt2)) {
      toast({
        title: "Error",
        description: "Please enter valid amounts",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      await verifyPaymentMethod(paymentMethod.payment_method_id, {
        verification_code1: amount1,
        verification_code2: amount2,
        verification_amounts: [amt1, amt2],
      });
      toast({
        title: "Success",
        description: "Bank account verified successfully",
      });
      setShowVerifyDialog(false);
      setAmount1("");
      setAmount2("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Verification failed. Please check the amounts and try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentMethod) return;

    setIsDeleting(true);
    try {
      await removePaymentMethod(paymentMethod.payment_method_id);
      toast({
        title: "Success",
        description: "Payment method removed successfully",
      });
      router.push("/dashboard/billing-revenue/payment-methods");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove payment method",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case "card":
        return <CreditCard className="h-8 w-8 text-blue-500" />;
      case "bank_account":
        return <Building2 className="h-8 w-8 text-green-500" />;
      case "wallet":
        return <Wallet className="h-8 w-8 text-purple-500" />;
      default:
        return <CreditCard className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (status === "active" && isVerified) {
      return (
        <Badge variant="default" className="flex items-center gap-1 w-fit">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      );
    }
    if (status === "pending_verification") {
      return (
        <Badge variant="outline" className="flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          Pending Verification
        </Badge>
      );
    }
    if (status === "verification_failed") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <XCircle className="h-3 w-3" />
          Verification Failed
        </Badge>
      );
    }
    if (status === "expired") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          <AlertCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  if (loading && !paymentMethod) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment method details...</p>
        </div>
      </div>
    );
  }

  if (!paymentMethod) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Payment method not found</h3>
          <p className="text-muted-foreground mb-4">
            The payment method you are looking for does not exist or has been removed.
          </p>
          <Button asChild>
            <Link href="/dashboard/billing-revenue/payment-methods">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payment Methods
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing-revenue/payment-methods">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payment Method Details</h1>
            <p className="text-muted-foreground">View and manage this payment method</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!paymentMethod.is_default && (
            <Button variant="outline" onClick={handleSetDefault} disabled={isSettingDefault}>
              {isSettingDefault ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting...
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Set as Default
                </>
              )}
            </Button>
          )}
          {paymentMethod.method_type === "bank_account" &&
            !paymentMethod.is_verified &&
            paymentMethod.status === "pending_verification" && (
              <Button onClick={() => setShowVerifyDialog(true)}>
                <Shield className="mr-2 h-4 w-4" />
                Verify Bank Account
              </Button>
            )}
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Payment Method Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="p-4 bg-accent rounded-lg">
              {getPaymentMethodIcon(paymentMethod.method_type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">
                  {paymentMethod.method_type === "card" && (
                    <>
                      {paymentMethod.card_brand?.toUpperCase() || "CARD"} ****{" "}
                      {paymentMethod.card_last4}
                    </>
                  )}
                  {paymentMethod.method_type === "bank_account" && (
                    <>
                      {paymentMethod.bank_name || "Bank Account"} ****{" "}
                      {paymentMethod.bank_account_last4}
                    </>
                  )}
                  {paymentMethod.method_type === "wallet" && (
                    <>{paymentMethod.wallet_type || "Wallet"}</>
                  )}
                </h2>
                {paymentMethod.is_default && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    Default
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mb-4">
                {getStatusBadge(paymentMethod.status, paymentMethod.is_verified)}
                {paymentMethod.method_type === "bank_account" && paymentMethod.is_verified && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <Shield className="h-4 w-4" />
                    <span>Verified</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">
                    {paymentMethod.method_type.replace("_", " ")}
                  </div>
                </div>
                {paymentMethod.method_type === "card" && (
                  <div>
                    <div className="text-muted-foreground">Expiration</div>
                    <div className="font-medium">
                      {String(paymentMethod.card_exp_month).padStart(2, "0")}/
                      {paymentMethod.card_exp_year}
                    </div>
                  </div>
                )}
                {paymentMethod.method_type === "bank_account" && (
                  <div>
                    <div className="text-muted-foreground">Account Type</div>
                    <div className="font-medium capitalize">
                      {paymentMethod.bank_account_type || "Checking"}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-muted-foreground">Added</div>
                  <div className="font-medium">
                    {format(new Date(paymentMethod.created_at), "MMM d, yyyy")}
                  </div>
                </div>
                {paymentMethod.expires_at && (
                  <div>
                    <div className="text-muted-foreground">Expires</div>
                    <div className="font-medium">
                      {format(new Date(paymentMethod.expires_at), "MMM d, yyyy")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethod.billing_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{paymentMethod.billing_name}</span>
              </div>
            )}
            {paymentMethod.billing_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{paymentMethod.billing_email}</span>
              </div>
            )}
            {paymentMethod.billing_address_line1 && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div>{paymentMethod.billing_address_line1}</div>
                  {paymentMethod.billing_address_line2 && (
                    <div>{paymentMethod.billing_address_line2}</div>
                  )}
                  <div>
                    {paymentMethod.billing_city}, {paymentMethod.billing_state}{" "}
                    {paymentMethod.billing_postal_code}
                  </div>
                  <div>{paymentMethod.billing_country}</div>
                </div>
              </div>
            )}
            {!paymentMethod.billing_address_line1 && !paymentMethod.billing_name && (
              <p className="text-sm text-muted-foreground">No billing information available</p>
            )}
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm font-medium">
                {formatTimestamp(paymentMethod.created_at)}
              </span>
            </div>
            {paymentMethod.verified_at && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Verified</span>
                <span className="text-sm font-medium">
                  {formatTimestamp(paymentMethod.verified_at)}
                </span>
              </div>
            )}
            {paymentMethod.expires_at && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="text-sm font-medium">
                  {format(new Date(paymentMethod.expires_at), "MMM d, yyyy")}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium capitalize">{paymentMethod.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for this payment method
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(transaction.date), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] truncate">{transaction.description}</div>
                    </TableCell>
                    <TableCell>
                      {transaction["invoice_id"] ? (
                        <Link
                          href={`/dashboard/billing-revenue/invoices/${transaction.invoice_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {transaction.invoice_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.status === "succeeded" ? "default" : "secondary"}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verify Bank Account Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Bank Account</DialogTitle>
            <DialogDescription>
              Enter the two small deposit amounts (in cents) that were sent to your bank account.
              This usually takes 1-2 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount1">First Deposit Amount (cents)</Label>
              <Input
                id="amount1"
                type="number"
                placeholder="e.g., 32"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                min="1"
                max="99"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount2">Second Deposit Amount (cents)</Label>
              <Input
                id="amount2"
                type="number"
                placeholder="e.g., 45"
                value={amount2}
                onChange={(e) => setAmount2(e.target.value)}
                min="1"
                max="99"
              />
            </div>
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Check your bank statement for two small deposits from our billing system. Enter
                these amounts to verify your account.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={isVerifying || !amount1 || !amount2}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
              {paymentMethod.is_default && (
                <>
                  <br />
                  <br />
                  <strong className="text-yellow-600">
                    Warning: This is your default payment method. You may want to set another
                    payment method as default before removing this one.
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
