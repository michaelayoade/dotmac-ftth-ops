"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Send,
  Download,
  Printer,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Building,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Bell,
  Receipt,
} from "lucide-react";
import { type Invoice, InvoiceStatuses } from "@/types/billing";
import { formatCurrency } from "@/lib/utils";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { InvoicePDFGenerator } from "@/lib/pdf/invoice-pdf";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";
import { CreateCreditNoteModal } from "./CreateCreditNoteModal";
import { apiClient } from "@/lib/api/client";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onUpdate?: () => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoice,
  onUpdate,
  onRecordPayment,
}: InvoiceDetailModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  // Invoice actions hook
  const {
    sendInvoiceEmail,
    voidInvoice,
    sendPaymentReminder,
    createCreditNote,
    isLoading: isActionLoading,
  } = useInvoiceActions();

  // Fetch company info from settings
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await apiClient.get("/settings/company");
        if (response.data) {
          setCompanyInfo(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch company info:", error);
        // Use fallback data if API fails
        setCompanyInfo({
          name: "Your ISP Company",
          address: "123 Main Street",
          city: "Your City",
          state: "ST",
          zip: "12345",
          phone: "(555) 123-4567",
          email: "billing@yourisp.com",
          website: "www.yourisp.com",
        });
      }
    };

    if (isOpen && invoice) {
      fetchCompanyInfo();
    }
  }, [isOpen, invoice]);

  // Fetch customer info
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (!invoice?.customer_id) return;

      try {
        const response = await apiClient.get(`/customers/${invoice.customer_id}`);
        if (response.data) {
          setCustomerInfo(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch customer info:", error);
        // Fallback to just customer ID
        setCustomerInfo({ name: `Customer ${invoice.customer_id}` });
      }
    };

    if (isOpen && invoice) {
      fetchCustomerInfo();
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const isOverdue =
    invoice.status !== InvoiceStatuses.PAID &&
    invoice.status !== InvoiceStatuses.VOID &&
    new Date(invoice.due_date) < new Date();

  const daysUntilDue = Math.ceil(
    (new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );

  const handleSendEmail = async () => {
    await sendInvoiceEmail.mutateAsync({
      invoiceId: invoice.invoice_id,
      email: invoice.billing_email,
    });
    if (onUpdate) onUpdate();
  };

  const handleVoid = async () => {
    const reason = prompt(
      `Are you sure you want to void invoice ${invoice.invoice_number}?\n\nThis action cannot be undone. Please provide a reason:`,
    );
    if (!reason) return;

    await voidInvoice.mutateAsync({
      invoiceId: invoice.invoice_id,
      reason,
    });
    if (onUpdate) onUpdate();
  };

  const handleSendReminder = async () => {
    await sendPaymentReminder.mutateAsync({
      invoiceId: invoice.invoice_id,
    });
    if (onUpdate) onUpdate();
  };

  const handleCreateCreditNote = () => {
    setShowCreditNoteModal(true);
  };

  const handleDownloadPDF = async () => {
    setIsProcessing(true);
    try {
      const generator = new InvoicePDFGenerator();

      // Use fetched company info or fallback
      const company = companyInfo || {
        name: "Your ISP Company",
        address: "123 Main Street",
        city: "Your City",
        state: "ST",
        zip: "12345",
        phone: "(555) 123-4567",
        email: "billing@yourisp.com",
        website: "www.yourisp.com",
      };

      // Use fetched customer info or fallback
      const customerName =
        customerInfo?.name ||
        customerInfo?.full_name ||
        customerInfo?.company_name ||
        `Customer ${invoice.customer_id}`;

      await generator.downloadInvoicePDF({
        company,
        invoice: invoice,
        customerName,
      });

      toast({
        title: "PDF Downloaded",
        description: `Invoice ${invoice.invoice_number} has been downloaded as PDF.`,
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string; icon: any }> = {
      draft: {
        label: "Draft",
        className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
        icon: FileText,
      },
      finalized: {
        label: "Finalized",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: CheckCircle,
      },
      paid: {
        label: "Paid",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        icon: CheckCircle,
      },
      void: {
        label: "Void",
        className: "bg-red-500/20 text-red-300 border-red-500/30",
        icon: XCircle,
      },
      uncollectible: {
        label: "Uncollectible",
        className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: AlertTriangle,
      },
    };

    const { label, className, icon: Icon } = (config[status] || config.draft)!;

    return (
      <Badge className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Invoice {invoice.invoice_number}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  {getStatusBadge(invoice.status)}
                  {isOverdue && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Overdue by {Math.abs(daysUntilDue)} days
                    </Badge>
                  )}
                  {!isOverdue &&
                    invoice.status !== InvoiceStatuses.PAID &&
                    invoice.status !== InvoiceStatuses.VOID &&
                    daysUntilDue <= 7 &&
                    daysUntilDue >= 0 && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Due in {daysUntilDue} days
                      </Badge>
                    )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 border-b pb-4">
            {invoice.status !== InvoiceStatuses.PAID && invoice.status !== InvoiceStatuses.VOID && (
              <Button
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                disabled={isProcessing || isActionLoading}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
            {invoice.status === InvoiceStatuses.FINALIZED && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendEmail}
                disabled={isProcessing || isActionLoading}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            )}
            {isOverdue &&
              invoice.status !== InvoiceStatuses.PAID &&
              invoice.status !== InvoiceStatuses.VOID && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendReminder}
                  disabled={isProcessing || isActionLoading}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Send Reminder
                </Button>
              )}
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={isProcessing}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={isProcessing}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {invoice.status !== InvoiceStatuses.VOID && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateCreditNote}
                disabled={isProcessing || isActionLoading}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Credit Note
              </Button>
            )}
            {invoice.status !== InvoiceStatuses.PAID && invoice.status !== InvoiceStatuses.VOID && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleVoid}
                disabled={isProcessing || isActionLoading}
                className="text-red-400 hover:text-red-300"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Void Invoice
              </Button>
            )}
          </div>

          {/* Invoice Content */}
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Bill To
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Customer ID: {invoice.customer_id}</p>
                  {invoice.billing_email && (
                    <p className="text-muted-foreground">{invoice.billing_email}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Invoice Details
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>
                      {formatDistanceToNow(new Date(invoice.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
                  </div>
                  {invoice.paid_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="text-emerald-400">
                        {new Date(invoice.paid_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Line Items
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.line_items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total_price || item.quantity * item.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Invoice Totals
              </h3>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-emerald-400">
                      -{formatCurrency(invoice.discount_amount)}
                    </span>
                  </div>
                )}
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span>{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-xl font-bold">{formatCurrency(invoice.total_amount)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span className="text-emerald-400">
                        -{formatCurrency(invoice.amount_paid)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Amount Due:</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(invoice.amount_due)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment Terms & Notes */}
            {(invoice.payment_terms || invoice.notes || invoice.terms) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Additional Information</h3>
                <div className="border rounded-lg p-4 space-y-3">
                  {invoice.payment_terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Payment Terms:
                      </p>
                      <p className="text-sm">{invoice.payment_terms}</p>
                    </div>
                  )}
                  {invoice.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Notes:</p>
                      <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Terms & Conditions:
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment History */}
            {invoice.amount_paid > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </h3>
                <div className="border rounded-lg p-4 bg-emerald-500/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-400">Payment Received</p>
                      {invoice.paid_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(invoice.paid_date).toLocaleDateString()} at{" "}
                          {new Date(invoice.paid_date).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatCurrency(invoice.amount_paid)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice Metadata */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {invoice.subscription_id && (
                  <div>
                    <p className="text-muted-foreground">Subscription ID</p>
                    <p className="font-mono text-xs">{invoice.subscription_id}</p>
                  </div>
                )}
                {invoice.order_id && (
                  <div>
                    <p className="text-muted-foreground">Order ID</p>
                    <p className="font-mono text-xs">{invoice.order_id}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p className="font-medium">{invoice.currency || "USD"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>
                    {formatDistanceToNow(new Date(invoice.updated_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Recording Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          invoices={[invoice]}
          onSuccess={() => {
            setShowPaymentModal(false);
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {/* Credit Note Creation Modal */}
      {showCreditNoteModal && (
        <CreateCreditNoteModal
          isOpen={showCreditNoteModal}
          onClose={() => setShowCreditNoteModal(false)}
          invoice={invoice}
          onSuccess={() => {
            setShowCreditNoteModal(false);
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </>
  );
}
