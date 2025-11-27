/**
 * Shared Invoice Detail Modal
 *
 * Pure UI component for displaying invoice details with action callbacks.
 * Apps provide data and action handlers via props.
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Send,
  Download,
  Printer,
  XCircle,
  DollarSign,
  Calendar,
  User,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Bell,
  Receipt,
} from "lucide-react";
import { useState } from "react";

import { type Invoice, InvoiceStatus } from "../types";
import { formatCurrency } from "../utils";

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
}

export interface CustomerInfo {
  name?: string;
  full_name?: string;
  company_name?: string;
}

export interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  companyInfo: CompanyInfo | null;
  customerInfo: CustomerInfo | null;

  // Action handlers
  onSendEmail?: () => Promise<void>;
  onVoid?: () => Promise<void>;
  onSendReminder?: () => Promise<void>;
  onDownloadPDF?: () => Promise<void>;
  onPrint?: () => void;
  onRecordPayment?: () => void;
  onCreateCreditNote?: () => void;
  onUpdate?: () => void;

  // Loading states
  isProcessing?: boolean;
  isActionLoading?: boolean;

  // Child components (passed from app)
  RecordPaymentModal?: React.ComponentType<any>;
  CreateCreditNoteModal?: React.ComponentType<any>;
  showPaymentModal?: boolean;
  setShowPaymentModal?: (show: boolean) => void;
  showCreditNoteModal?: boolean;
  setShowCreditNoteModal?: (show: boolean) => void;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoice,
  companyInfo,
  customerInfo,
  onSendEmail,
  onVoid,
  onSendReminder,
  onDownloadPDF,
  onPrint,
  onRecordPayment,
  onCreateCreditNote,
  onUpdate,
  isProcessing = false,
  isActionLoading = false,
  RecordPaymentModal,
  CreateCreditNoteModal,
  showPaymentModal = false,
  setShowPaymentModal,
  showCreditNoteModal = false,
  setShowCreditNoteModal,
}: InvoiceDetailModalProps) {
  if (!invoice) return null;

  const isOverdue =
    invoice.status !== InvoiceStatus.PAID &&
    invoice.status !== InvoiceStatus.VOID &&
    new Date(invoice.due_date) < new Date();

  const daysUntilDue = Math.ceil(
    (new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const statusConfig = {
      draft: {
        label: "Draft",
        className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
        icon: FileText,
      },
      open: {
        label: "Open",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: Clock,
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
    } satisfies Record<InvoiceStatus, { label: string; className: string; icon: LucideIcon }>;

    const {
      label,
      className,
      icon: Icon,
    } = statusConfig[status] ?? statusConfig[InvoiceStatus.DRAFT];

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
                    invoice.status !== InvoiceStatus.PAID &&
                    invoice.status !== InvoiceStatus.VOID &&
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
            {invoice.status !== InvoiceStatus.PAID &&
              invoice.status !== InvoiceStatus.VOID &&
              onRecordPayment && (
                <Button
                  size="sm"
                  onClick={onRecordPayment}
                  disabled={isProcessing || isActionLoading}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              )}
            {invoice.status === InvoiceStatus.FINALIZED && onSendEmail && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSendEmail}
                disabled={isProcessing || isActionLoading}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            )}
            {isOverdue &&
              invoice.status !== InvoiceStatus.PAID &&
              invoice.status !== InvoiceStatus.VOID &&
              onSendReminder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSendReminder}
                  disabled={isProcessing || isActionLoading}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Send Reminder
                </Button>
              )}
            {onDownloadPDF && (
              <Button size="sm" variant="outline" onClick={onDownloadPDF} disabled={isProcessing}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={isProcessing}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {invoice.status !== InvoiceStatus.VOID && onCreateCreditNote && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCreateCreditNote}
                disabled={isProcessing || isActionLoading}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Credit Note
              </Button>
            )}
            {invoice.status !== InvoiceStatus.PAID &&
              invoice.status !== InvoiceStatus.VOID &&
              onVoid && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onVoid}
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
                  {(invoice as any).paid_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="text-emerald-400">
                        {new Date((invoice as any).paid_date).toLocaleDateString()}
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
                    {invoice.line_items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency((item as any).unit_price || item.unit_amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            (item as any).total_price ||
                              item.amount ||
                              item.quantity * ((item as any).unit_price || item.unit_amount),
                          )}
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
                {(invoice as any).subtotal !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency((invoice as any).subtotal)}</span>
                  </div>
                )}
                {(invoice as any).discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-emerald-400">
                      -{formatCurrency((invoice as any).discount_amount)}
                    </span>
                  </div>
                )}
                {(invoice as any).tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span>{formatCurrency((invoice as any).tax_amount)}</span>
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
            {((invoice as any).payment_terms || invoice.notes || (invoice as any).terms) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Additional Information</h3>
                <div className="border rounded-lg p-4 space-y-3">
                  {(invoice as any).payment_terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Payment Terms:
                      </p>
                      <p className="text-sm">{(invoice as any).payment_terms}</p>
                    </div>
                  )}
                  {invoice.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Notes:</p>
                      <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}
                  {(invoice as any).terms && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Terms & Conditions:
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{(invoice as any).terms}</p>
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
                      {(invoice as any).paid_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date((invoice as any).paid_date).toLocaleDateString()} at{" "}
                          {new Date((invoice as any).paid_date).toLocaleTimeString()}
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
                {(invoice as any).subscription_id && (
                  <div>
                    <p className="text-muted-foreground">Subscription ID</p>
                    <p className="font-mono text-xs">{(invoice as any).subscription_id}</p>
                  </div>
                )}
                {(invoice as any).order_id && (
                  <div>
                    <p className="text-muted-foreground">Order ID</p>
                    <p className="font-mono text-xs">{(invoice as any).order_id}</p>
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
      {RecordPaymentModal && showPaymentModal && setShowPaymentModal && (
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
      {CreateCreditNoteModal && showCreditNoteModal && setShowCreditNoteModal && (
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
