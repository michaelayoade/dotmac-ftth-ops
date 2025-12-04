"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  Receipt as ReceiptIcon,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  Plus,
  Calendar,
  Loader2,
  Mail,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { Receipt, ReceiptSearchParams } from "@/types/billing";
import { formatCurrency } from "@/lib/utils/currency";

interface ReceiptListResponse {
  receipts: Receipt[];
  total: number;
  page: number;
  limit: number;
}

interface ReceiptGeneratePayload {
  payment_id?: string;
  invoice_id?: string;
  include_pdf?: boolean;
  include_html?: boolean;
  send_email?: boolean;
  payment_details?: {
    amount: number;
    payment_method: string;
    payment_reference?: string;
  };
}

export default function ReceiptsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Generate receipt dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateType, setGenerateType] = useState<"payment" | "invoice">("payment");
  const [paymentId, setPaymentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [includePdf, setIncludePdf] = useState(true);
  const [includeHtml, setIncludeHtml] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);

  // Build search params
  const searchParams: ReceiptSearchParams = {
    limit,
    offset: (page - 1) * limit,
  };

  if (dateFrom) searchParams.from_date = dateFrom;
  if (dateTo) searchParams.to_date = dateTo;

  // Fetch receipts
  const {
    data: receiptsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["receipts", searchParams],
    queryFn: async () => {
      const response = await apiClient.get<ReceiptListResponse>("/billing/receipts/", {
        params: searchParams,
      });
      return response.data;
    },
  });

  // Filter receipts based on search query
  const filteredReceipts = React.useMemo(() => {
    if (!receiptsData?.receipts) return [];

    if (!searchQuery) return receiptsData.receipts;

    const query = searchQuery.toLowerCase();
    return receiptsData.receipts.filter(
      (receipt) =>
        receipt.receipt_number.toLowerCase().includes(query) ||
        (receipt["customer_name"] ?? "").toLowerCase().includes(query) ||
        (receipt.customer_email ?? "").toLowerCase().includes(query) ||
        (receipt.payment_id ?? "").toLowerCase().includes(query),
    );
  }, [receiptsData, searchQuery]);

  // Calculate statistics
  const statistics = React.useMemo(() => {
    if (!receiptsData?.receipts) {
      return { totalReceipts: 0, totalAmount: 0, thisMonth: 0, thisMonthAmount: 0 };
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthReceipts = receiptsData.receipts.filter(
      (r) => new Date(r.issue_date) >= firstDayOfMonth,
    );

    return {
      totalReceipts: receiptsData.receipts.length,
      totalAmount: receiptsData.receipts.reduce((sum, r) => sum + r.total_amount, 0),
      thisMonth: thisMonthReceipts.length,
      thisMonthAmount: thisMonthReceipts.reduce((sum, r) => sum + r.total_amount, 0),
    };
  }, [receiptsData]);

  // Generate receipt mutation
  const generateReceiptMutation = useMutation({
    mutationFn: async (payload: ReceiptGeneratePayload) => {
      const endpoint =
        generateType === "payment"
          ? "/billing/receipts/generate/payment"
          : "/billing/receipts/generate/invoice";

      const response = await apiClient.post(endpoint, payload);
      return response.data;
    },
    onSuccess: (data) => {
      logger.info("Receipt generated successfully", { receipt: data });
      toast({
        title: "Success",
        description: "Receipt generated successfully",
      });
      setGenerateDialogOpen(false);
      resetGenerateForm();
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
    onError: (error) => {
      logger.error("Failed to generate receipt", error);
      handleApiError(error, {
        userMessage: "Failed to generate receipt. Please try again.",
      });
    },
  });

  const handleGenerateReceipt = async () => {
    if (generateType === "payment" && !paymentId) {
      toast({
        title: "Error",
        description: "Please enter a payment ID",
        variant: "destructive",
      });
      return;
    }

    if (generateType === "invoice" && !invoiceId) {
      toast({
        title: "Error",
        description: "Please enter an invoice ID",
        variant: "destructive",
      });
      return;
    }

    const payload: ReceiptGeneratePayload = {
      include_pdf: includePdf,
      include_html: includeHtml,
      send_email: sendEmail,
    };

    if (generateType === "payment") {
      payload.payment_id = paymentId;
    } else {
      payload.invoice_id = invoiceId;
    }

    generateReceiptMutation.mutate(payload);
  };

  const resetGenerateForm = () => {
    setPaymentId("");
    setInvoiceId("");
    setIncludePdf(true);
    setIncludeHtml(true);
    setSendEmail(false);
    setGenerateType("payment");
  };

  const handleExport = async (exportFormat: "csv" | "pdf") => {
    try {
      const response = await apiClient.get("/billing/receipts/export", {
        params: {
          format: exportFormat,
          ...searchParams,
        },
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = format(new Date(), "yyyy-MM-dd");
      link.setAttribute("download", `receipts-${exportFormat}-${dateStr}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      logger.info("Receipts exported", { format: exportFormat });

      toast({
        title: "Success",
        description: `Receipts exported to ${exportFormat.toUpperCase()} successfully`,
      });
    } catch (error) {
      logger.error("Failed to export receipts", error);
      handleApiError(error, {
        userMessage: "Failed to export receipts. Please try again.",
      });
    }
  };

  const getEmailStatusBadge = (emailSent: boolean) => {
    if (emailSent) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Sent
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Not Sent
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Receipts</h1>
          <p className="text-muted-foreground">Manage payment receipts and documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={() => setGenerateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Receipt
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
              Total Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalReceipts}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.totalAmount, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">All receipts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Receipts issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Month Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.thisMonthAmount, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>All Receipts</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search receipts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Input
                type="date"
                placeholder="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
              <Input
                type="date"
                placeholder="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading receipts...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load receipts. Please try again.
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No receipts found for the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Email Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
                  <TableRow key={receipt.receipt_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{receipt.receipt_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{receipt.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {receipt.customer_email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {receipt.payment_id ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {receipt.payment_id.slice(0, 8)}...
                          </span>
                        </div>
                      ) : receipt["invoice_id"] ? (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {receipt.invoice_id.slice(0, 8)}...
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(receipt.total_amount, receipt.currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(receipt.issue_date), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(receipt.issue_date), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>{getEmailStatusBadge(!!receipt.sent_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/dashboard/billing-revenue/receipts/${receipt.receipt_id}`)
                        }
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {receiptsData && receiptsData.total > limit && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, receiptsData.total)} of{" "}
                {receiptsData.total} receipts
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= receiptsData.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Receipt Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Receipt</DialogTitle>
            <DialogDescription>Create a new receipt for a payment or invoice</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Receipt Type</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={generateType === "payment" ? "default" : "outline"}
                  onClick={() => setGenerateType("payment")}
                  className="flex-1"
                >
                  Payment
                </Button>
                <Button
                  type="button"
                  variant={generateType === "invoice" ? "default" : "outline"}
                  onClick={() => setGenerateType("invoice")}
                  className="flex-1"
                >
                  Invoice
                </Button>
              </div>
            </div>

            {generateType === "payment" ? (
              <div>
                <Label htmlFor="payment_id">Payment ID</Label>
                <Input
                  id="payment_id"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="Enter payment ID"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="invoice_id">Invoice ID</Label>
                <Input
                  id="invoice_id"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  placeholder="Enter invoice ID"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include_pdf"
                  checked={includePdf}
                  onChange={(e) => setIncludePdf(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="include_pdf" className="cursor-pointer">
                  Generate PDF
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include_html"
                  checked={includeHtml}
                  onChange={(e) => setIncludeHtml(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="include_html" className="cursor-pointer">
                  Generate HTML
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send_email"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="send_email" className="cursor-pointer">
                  Send email to customer
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGenerateDialogOpen(false);
                resetGenerateForm();
              }}
              disabled={generateReceiptMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateReceipt} disabled={generateReceiptMutation.isPending}>
              {generateReceiptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Receipt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
