"use client";

import { useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Receipt as ReceiptIcon,
  Calendar,
  User,
  DollarSign,
  Download,
  RefreshCw,
  FileText,
  Mail,
  Printer,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Receipt } from "@/types/billing";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { formatCurrency } from "@dotmac/features/billing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { handleApiError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { sanitizeRichHtml } from "@dotmac/primitives";

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const receiptId = params["id"] as string;

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch receipt details
  const {
    data: receipt,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["receipt", receiptId],
    queryFn: async () => {
      const response = await apiClient.get<Receipt>(`/billing/receipts/${receiptId}`);
      return response.data;
    },
  });

  const sanitizedReceiptHtml = useMemo(
    () => sanitizeRichHtml(receipt?.html_content ?? ""),
    [receipt?.html_content],
  );

  // Download PDF
  const handleDownloadPdf = async () => {
    try {
      setActionLoading(true);
      const response = await apiClient.get(`/billing/receipts/${receiptId}/pdf`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt-${receipt?.receipt_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      logger.info("Receipt PDF downloaded", { receiptId });

      toast({
        title: "Success",
        description: "Receipt PDF downloaded successfully",
      });
    } catch (error) {
      logger.error("Failed to download receipt PDF", error);
      handleApiError(error, {
        userMessage: "Failed to download PDF. Please try again.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Download HTML
  const handleDownloadHtml = async () => {
    try {
      setActionLoading(true);
      const response = await apiClient.get(`/billing/receipts/${receiptId}/html`);

      const htmlContent = response.data.html_content || response.data;
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt-${receipt?.receipt_number}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      logger.info("Receipt HTML downloaded", { receiptId });

      toast({
        title: "Success",
        description: "Receipt HTML downloaded successfully",
      });
    } catch (error) {
      logger.error("Failed to download receipt HTML", error);
      handleApiError(error, {
        userMessage: "Failed to download HTML. Please try again.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Resend email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/billing/receipts/${receiptId}/email`, {
        email: receipt?.customer_email,
      });
      return response.data;
    },
    onSuccess: () => {
      logger.info("Receipt email sent", { receiptId });
      toast({
        title: "Success",
        description: `Receipt sent to ${receipt?.customer_email}`,
      });
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
    },
    onError: (error) => {
      logger.error("Failed to send receipt email", error);
      handleApiError(error, {
        userMessage: "Failed to send email. Please try again.",
      });
    },
  });

  const handleResendEmail = () => {
    resendEmailMutation.mutate();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading receipt...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
          <div className="text-red-600 dark:text-red-400">
            {error ? "Failed to load receipt" : "Receipt not found"}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => refetch()}
              className="text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
            >
              Try again
            </button>
            <button
              onClick={() => router.push("/dashboard/billing-revenue/receipts")}
              className="text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
            >
              Back to receipts
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/billing-revenue/receipts")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{receipt.receipt_number}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="default">
              <CheckCircle className="h-3 w-3 mr-1" />
              {receipt.payment_status || "Completed"}
            </Badge>
            {receipt.sent_at ? (
              <Badge variant="default">
                <Mail className="h-3 w-3 mr-1" />
                Email Sent
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Email Not Sent
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={actionLoading || !receipt.pdf_url}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadHtml}
            disabled={actionLoading || !receipt.html_content}
          >
            <FileText className="h-4 w-4 mr-2" />
            Download HTML
          </Button>
          <Button
            variant="outline"
            onClick={handleResendEmail}
            disabled={resendEmailMutation.isPending}
          >
            {resendEmailMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Resend Email
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Receipt Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt Preview */}
          <Card ref={printRef}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ReceiptIcon className="h-6 w-6" />
                    Receipt
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{receipt.receipt_number}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Issue Date</div>
                  <div className="font-medium">
                    {format(new Date(receipt.issue_date), "MMM d, yyyy")}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Bill To
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{receipt.customer_name}</div>
                  <div className="text-muted-foreground">{receipt.customer_email}</div>
                  {receipt.billing_address && (
                    <div className="text-muted-foreground mt-2">
                      {Object.entries(receipt.billing_address).map(([key, value]) => (
                        <div key={key}>
                          {key}: {value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Payment Method</div>
                    <div className="font-medium">{receipt.payment_method || "N/A"}</div>
                  </div>
                  {receipt.payment_id && (
                    <div>
                      <div className="text-muted-foreground">Payment ID</div>
                      <div className="font-medium font-mono text-xs">{receipt.payment_id}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Reference */}
              {receipt.invoice_id && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Invoice Reference
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Invoice ID</div>
                        <div className="font-medium font-mono text-sm">{receipt.invoice_id}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/dashboard/billing-revenue/invoices/${receipt.invoice_id}`)
                        }
                      >
                        View Invoice
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Line Items */}
              <div>
                <h3 className="font-semibold mb-3">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.line_items.map((item, index) => (
                      <TableRow key={item.line_item_id || index}>
                        <TableCell>
                          <div className="font-medium">{item.description}</div>
                          {item.sku && (
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price, receipt.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_price, receipt.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Amount Breakdown */}
              <div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(receipt.subtotal, receipt.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      {formatCurrency(receipt.tax_amount, receipt.currency)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(receipt.total_amount, receipt.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {receipt.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                      {receipt.notes}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Actions */}
        <div className="space-y-6">
          {/* Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Amount Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(receipt.subtotal, receipt.currency)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tax</span>
                <span className="font-medium">
                  {formatCurrency(receipt.tax_amount, receipt.currency)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="font-bold text-lg">
                  {formatCurrency(receipt.total_amount, receipt.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5" />
                Receipt Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Receipt Number</div>
                <div className="font-medium text-sm">{receipt.receipt_number}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Issue Date</div>
                <div className="font-medium text-sm">
                  {format(new Date(receipt.issue_date), "MMM d, yyyy h:mm a")}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Currency</div>
                <div className="font-medium text-sm">{receipt.currency}</div>
              </div>
              {receipt.payment_status && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Payment Status</div>
                    <div className="font-medium text-sm">{receipt.payment_status}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Email Status</div>
                <div className="font-medium text-sm">
                  {receipt.sent_at ? (
                    <span className="text-green-600 dark:text-green-400">Sent</span>
                  ) : (
                    <span className="text-muted-foreground">Not Sent</span>
                  )}
                </div>
              </div>
              {receipt.sent_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Sent At</div>
                    <div className="font-medium text-sm">
                      {format(new Date(receipt.sent_at), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                </>
              )}
              {receipt.delivery_method && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Delivery Method</div>
                    <div className="font-medium text-sm">{receipt.delivery_method}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Created At</div>
                <div className="text-sm font-medium">
                  {format(new Date(receipt.created_at), "MMM d, yyyy h:mm a")}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <div className="text-sm font-medium">
                  {format(new Date(receipt.updated_at), "MMM d, yyyy h:mm a")}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* HTML Content Preview (if available) */}
      {receipt.html_content && (
        <Card>
          <CardHeader>
            <CardTitle>Receipt Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-lg p-4 bg-white text-black"
              dangerouslySetInnerHTML={{ __html: sanitizedReceiptHtml }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
