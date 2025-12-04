"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  CreditCard,
  Download,
  Eye,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Receipt,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@dotmac/features/billing";
import {
  useCustomerInvoices,
  useCustomerPayments,
  useCustomerPaymentMethods,
} from "@/hooks/useCustomerPortal";
import { useToast } from "@dotmac/ui";
import { AddPaymentMethodModal } from "@/components/tenant/billing/AddPaymentMethodModal";
import { PaymentMethodCard } from "@/components/tenant/billing/PaymentMethodCard";
import { useApiConfig } from "@/hooks/useApiConfig";
import type { AddPaymentMethodRequest } from "@/hooks/useTenantPaymentMethods";
import {
  CUSTOMER_PORTAL_TOKEN_KEY,
  getPortalAuthToken,
  setPortalAuthToken,
} from "../../../../../shared/utils/operatorAuth";

export default function CustomerBillingPage() {
  const { toast } = useToast();
  const [, setSelectedInvoice] = useState<string | null>(null);
  const { invoices, loading: invoicesLoading, refetch: refetchInvoices } = useCustomerInvoices();
  const { payments, loading: paymentsLoading, makePayment } = useCustomerPayments();
  const {
    paymentMethods,
    defaultPaymentMethod,
    autoPayPaymentMethod,
    loading: paymentMethodsLoading,
    error: paymentMethodsError,
    addPaymentMethod,
    setDefaultPaymentMethod,
    removePaymentMethod,
    toggleAutoPay,
  } = useCustomerPaymentMethods();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [addMethodError, setAddMethodError] = useState<string | null>(null);
  const [isUpdatingMethod, setIsUpdatingMethod] = useState(false);

  const loading = invoicesLoading || paymentsLoading || paymentMethodsLoading;
  const { apiBaseUrl } = useApiConfig();

  const outstandingInvoice = useMemo(
    () => invoices?.find((inv) => inv.status !== "paid") ?? null,
    [invoices],
  );

  const currentBalanceAmount =
    invoices
      ?.filter((inv) => inv.status !== "paid")
      .reduce((sum, inv) => sum + inv.amount_due, 0) || 0;

  const currentBalanceStatus = invoices?.some((inv) => inv.status !== "paid") ? "pending" : "paid";

  const defaultMethodId =
    defaultPaymentMethod?.payment_method_id ||
    paymentMethods.find((method: { is_default: boolean }) => method.is_default)
      ?.payment_method_id ||
    paymentMethods[0]?.payment_method_id ||
    null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const handlePayNow = async () => {
    if (!outstandingInvoice) {
      toast({
        title: "No Pending Invoices",
        description: "All of your invoices are paid.",
      });
      return;
    }

    if (!defaultMethodId) {
      toast({
        title: "Add Payment Method",
        description: "Please add a payment method before paying your invoice.",
        variant: "destructive",
      });
      setAddModalOpen(true);
      return;
    }

    try {
      await makePayment({
        invoiceId: outstandingInvoice.invoice_id,
        amount: outstandingInvoice.amount_due,
        paymentMethodId: defaultMethodId,
      });
      toast({
        title: "Payment Successful",
        description: `Payment of ${formatCurrency(outstandingInvoice.amount_due)} has been processed.`,
      });
      refetchInvoices();
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const invoice = invoices?.find((inv) => inv.invoice_id === invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      toast({
        title: "Download Started",
        description: "Your invoice is being downloaded.",
      });

      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      const storedToken = getPortalAuthToken({
        tokenKey: CUSTOMER_PORTAL_TOKEN_KEY,
        required: false,
      });
      const token = urlToken || storedToken;
      if (!token) {
        throw new Error("Customer session expired");
      }
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/portal/customer/invoices/${invoiceId}/download`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/pdf",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (urlToken) {
        setPortalAuthToken(urlToken, CUSTOMER_PORTAL_TOKEN_KEY);
      }

      if (!response.ok) {
        throw new Error(`Failed to download invoice: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `Invoice ${invoice.invoice_number} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download invoice",
        variant: "destructive",
      });
    }
  };

  const handleAddPaymentMethod = async (request: AddPaymentMethodRequest) => {
    try {
      setIsAddingMethod(true);
      setAddMethodError(null);
      await addPaymentMethod(request);
      toast({
        title: "Payment Method Added",
        description: "Your payment method has been added successfully.",
      });
      setAddModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add payment method";
      setAddMethodError(message);
      toast({
        title: "Add Payment Method Failed",
        description: message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsAddingMethod(false);
    }
  };

  const handleSetDefaultMethod = async (paymentMethodId: string) => {
    try {
      setIsUpdatingMethod(true);
      await setDefaultPaymentMethod(paymentMethodId);
      toast({
        title: "Default Updated",
        description: "Your default payment method has been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to Update Default",
        description: error instanceof Error ? error.message : "Could not update default method",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMethod(false);
    }
  };

  const handleRemoveMethod = async (paymentMethodId: string) => {
    try {
      setIsUpdatingMethod(true);
      await removePaymentMethod(paymentMethodId);
      toast({
        title: "Payment Method Removed",
        description: "The payment method has been removed.",
      });
    } catch (error) {
      toast({
        title: "Remove Payment Method Failed",
        description: error instanceof Error ? error.message : "Could not remove payment method",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMethod(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      paid: {
        label: "Paid",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
        icon: CheckCircle,
      },
      pending: {
        label: "Pending",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: Clock,
      },
      overdue: {
        label: "Overdue",
        className: "bg-red-500/20 text-red-300 border-red-500/30",
        icon: AlertCircle,
      },
    };

    const statusConfig = config[status as keyof typeof config] || config.pending;
    const Icon = statusConfig.icon;

    return (
      <Badge variant="outline" className={statusConfig.className}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
        <p className="text-muted-foreground">Manage your invoices and payment methods</p>
      </div>

      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Current Balance
          </CardTitle>
          <CardDescription>Your outstanding balance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold">{formatCurrency(currentBalanceAmount)}</p>
              {outstandingInvoice?.due_date && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due on {new Date(outstandingInvoice.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button size="lg" onClick={handlePayNow}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoices
              </CardTitle>
              <CardDescription>View and download your invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices && invoices.length > 0 ? (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.invoice_id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.description}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.amount)}
                          </TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedInvoice(invoice.invoice_id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadInvoice(invoice.invoice_id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {invoice.status !== "paid" && (
                                <Button size="sm" onClick={handlePayNow}>
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Payment History
              </CardTitle>
              <CardDescription>Your recent payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments && payments.length > 0 ? (
                      payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell className="text-right font-medium text-green-500">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                payment.status === "success"
                                  ? "bg-green-500/20 text-green-300 border-green-500/30"
                                  : payment.status === "pending"
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    : "bg-red-500/20 text-red-300 border-red-500/30"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No payment history found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>Manage your saved payment methods</CardDescription>
                </div>
                <Button onClick={() => setAddModalOpen(true)}>Add Payment Method</Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentMethodsError && (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {paymentMethodsError}
                </div>
              )}

              {paymentMethods.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map((method) => (
                    <PaymentMethodCard
                      key={method.payment_method_id}
                      paymentMethod={method}
                      onSetDefault={() => handleSetDefaultMethod(method.payment_method_id)}
                      onRemove={() => handleRemoveMethod(method.payment_method_id)}
                      isUpdating={isUpdatingMethod}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-md">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a payment method to quickly pay your invoices.
                  </p>
                  <Button onClick={() => setAddModalOpen(true)}>Add Payment Method</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AutoPay</CardTitle>
              <CardDescription>Set up automatic payments for your monthly bills</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AutoPay Status</p>
                  <p className="text-sm text-muted-foreground">
                    {autoPayPaymentMethod
                      ? `Enabled on ${autoPayPaymentMethod.method_type === "card" ? `${autoPayPaymentMethod.card_brand} ending in ${autoPayPaymentMethod.card_last4}` : autoPayPaymentMethod.method_type === "bank_account" ? `${autoPayPaymentMethod.bank_name} ending in ${autoPayPaymentMethod.bank_account_last4}` : autoPayPaymentMethod.method_type}`
                      : "Currently disabled"}
                  </p>
                </div>
                {defaultPaymentMethod && (
                  <Button
                    variant={autoPayPaymentMethod ? "destructive" : "outline"}
                    onClick={async () => {
                      try {
                        await toggleAutoPay(defaultPaymentMethod.payment_method_id);
                        toast({
                          title: autoPayPaymentMethod ? "AutoPay Disabled" : "AutoPay Enabled",
                          description: autoPayPaymentMethod
                            ? "AutoPay has been disabled"
                            : "AutoPay has been enabled on your default payment method",
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description:
                            error instanceof Error ? error.message : "Failed to toggle AutoPay",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {autoPayPaymentMethod ? "Disable AutoPay" : "Enable AutoPay"}
                  </Button>
                )}
                {!defaultPaymentMethod && (
                  <p className="text-sm text-muted-foreground">Add a payment method first</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddPaymentMethodModal
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) {
            setAddMethodError(null);
          }
        }}
        onAddPaymentMethod={handleAddPaymentMethod}
        isAdding={isAddingMethod}
        error={addMethodError}
      />
    </div>
  );
}
