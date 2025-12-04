/**
 * Shared Receipt Detail Modal
 *
 * Displays receipt details in a modal dialog with actions for download, email, and print.
 */

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Download, Mail, Printer, FileText, Calendar, CreditCard, User } from "lucide-react";

import { Receipt } from "../types";
import { formatCurrency } from "../utils";

import { PaymentStatusBadge } from "./PaymentStatusBadge";

export interface ReceiptDetailModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (receipt: Receipt) => void;
  onEmail?: (receipt: Receipt) => void;
  onPrint?: (receipt: Receipt) => void;
}

export function ReceiptDetailModal({
  receipt,
  isOpen,
  onClose,
  onDownload,
  onEmail,
  onPrint,
}: ReceiptDetailModalProps) {
  if (!receipt) return null;

  const issueDate = new Date(receipt.issue_date);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Receipt {receipt.receipt_number}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onPrint && (
                <Button variant="outline" size="sm" onClick={() => onPrint(receipt)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              )}
              {onEmail && (
                <Button variant="outline" size="sm" onClick={() => onEmail(receipt)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              )}
              {onDownload && (
                <Button size="sm" onClick={() => onDownload(receipt)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Receipt Header */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Customer Information
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{receipt.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{receipt.customer_email}</span>
                  </div>
                  {receipt.billing_address && Object.keys(receipt.billing_address).length > 0 && (
                    <div className="text-sm text-muted-foreground mt-2">
                      {receipt.billing_address["street"] && (
                        <div>{receipt.billing_address["street"]}</div>
                      )}
                      {receipt.billing_address["city"] && (
                        <div>
                          {receipt.billing_address["city"]}
                          {receipt.billing_address["state"] &&
                            `, ${receipt.billing_address["state"]}`}
                          {receipt.billing_address["postal_code"] &&
                            ` ${receipt.billing_address["postal_code"]}`}
                        </div>
                      )}
                      {receipt.billing_address["country"] && (
                        <div>{receipt.billing_address["country"]}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Receipt Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Issue Date:</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {issueDate.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <span className="capitalize">{receipt.payment_method.replace("_", " ")}</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <PaymentStatusBadge status={receipt.payment_status} />
                  </div>
                  {receipt.invoice_id && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Invoice ID:</span>
                      <span className="font-mono text-xs">{receipt.invoice_id}</span>
                    </div>
                  )}
                  {receipt.payment_id && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment ID:</span>
                      <span className="font-mono text-xs">{receipt.payment_id}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.line_items.map((item, index) => (
                  <TableRow key={item.line_item_id || index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.description}</div>
                        {item.sku && (
                          <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.tax_rate > 0 ? (
                        <div>
                          <div>{formatCurrency(item.tax_amount, receipt.currency)}</div>
                          <div className="text-xs text-muted-foreground">({item.tax_rate}%)</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_price, receipt.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(receipt.subtotal, receipt.currency)}</span>
              </div>
              {receipt.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(receipt.tax_amount, receipt.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(receipt.total_amount, receipt.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{receipt.notes}</p>
              </div>
            </>
          )}

          {/* Metadata */}
          {receipt.sent_at && (
            <>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <div>Sent: {new Date(receipt.sent_at).toLocaleString()}</div>
                {receipt.delivery_method && <div>via {receipt.delivery_method}</div>}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
