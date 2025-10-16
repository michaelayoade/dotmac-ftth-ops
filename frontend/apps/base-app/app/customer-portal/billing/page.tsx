"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useCustomerInvoices, useCustomerPayments } from "@/hooks/useCustomerPortal";
import { useToast } from "@/components/ui/use-toast";

export default function CustomerBillingPage() {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const { invoices, loading: invoicesLoading, refetch: refetchInvoices } = useCustomerInvoices();
  const { payments, loading: paymentsLoading, makePayment } = useCustomerPayments();

  const loading = invoicesLoading || paymentsLoading;

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

  // Calculate current balance from unpaid invoices
  const currentBalance = {
    amount: invoices?.filter((inv) => inv.status !== "paid").reduce((sum, inv) => sum + inv.amount_due, 0) || 0,
    dueDate: invoices?.find((inv) => inv.status !== "paid")?.due_date || null,
    status: invoices?.some((inv) => inv.status !== "paid") ? "pending" : "paid",
  };

  // Mock payment methods (would come from API in production)
  const paymentMethods = [
    {
      id: "pm-1",
      type: "card",
      brand: "Visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2026,
      isDefault: true,
    },
  ];

  const handlePayNow = async () => {
    if (!invoices || invoices.length === 0) {
      toast({
        title: "No Invoices",
        description: "There are no invoices to pay.",
        variant: "destructive",
      });
      return;
    }

    const unpaidInvoice = invoices.find((inv) => inv.status !== "paid");
    if (!unpaidInvoice) {
      toast({
        title: "No Pending Invoices",
        description: "All your invoices are paid.",
      });
      return;
    }

    try {
      await makePayment(unpaidInvoice.invoice_id, unpaidInvoice.amount_due, "pm-1");
      toast({
        title: "Payment Successful",
        description: `Payment of ${formatCurrency(unpaidInvoice.amount_due)} has been processed.`,
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

  const handleDownloadInvoice = (invoiceId: string) => {
    // TODO: Implement invoice download
    toast({
      title: "Download Started",
      description: "Your invoice is being downloaded.",
    });
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
      <Badge className={statusConfig.className}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
        <p className="text-muted-foreground">
          Manage your invoices and payment methods
        </p>
      </div>

      {/* Current Balance Card */}
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
              <p className="text-4xl font-bold">
                {formatCurrency(currentBalance.amount)}
              </p>
              {currentBalance.dueDate && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due on {new Date(currentBalance.dueDate).toLocaleDateString()}
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

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoices
              </CardTitle>
              <CardDescription>
                View and download your invoices
              </CardDescription>
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
                          <TableCell className="font-medium">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>{invoice.description}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.amount)}
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status)}
                          </TableCell>
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

        {/* Payment History Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Payment History
              </CardTitle>
              <CardDescription>
                Your recent payment transactions
              </CardDescription>
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
                          <TableCell>
                            {new Date(payment.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.invoice_number}
                          </TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell className="text-right font-medium text-green-500">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              payment.status === "success"
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : payment.status === "pending"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : "bg-red-500/20 text-red-300 border-red-500/30"
                            }>
                              <CheckCircle className="h-3 w-3 mr-1" />
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

        {/* Payment Methods Tab */}
        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>
                    Manage your saved payment methods
                  </CardDescription>
                </div>
                <Button>
                  Add Payment Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {method.brand} •••• {method.last4}
                          </p>
                          {method.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.exp_month}/{method.exp_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <Button variant="outline" size="sm">
                          Set as Default
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Auto-Pay Card */}
          <Card>
            <CardHeader>
              <CardTitle>AutoPay</CardTitle>
              <CardDescription>
                Set up automatic payments for your monthly bills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AutoPay Status</p>
                  <p className="text-sm text-muted-foreground">
                    Currently disabled
                  </p>
                </div>
                <Button variant="outline">
                  Enable AutoPay
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
