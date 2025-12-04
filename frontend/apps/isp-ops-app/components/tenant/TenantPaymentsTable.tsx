"use client";

import { format } from "date-fns";
import { Badge } from "@dotmac/ui";
import { formatCurrency } from "@/lib/utils/currency";
import type { Payment, PaymentStatus } from "@/types/billing";

interface TenantPaymentsTableProps {
  payments: Payment[];
}

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "secondary",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
  refunded: "outline",
  partial_refund: "outline",
};

export default function TenantPaymentsTable({ payments }: TenantPaymentsTableProps) {
  if (!payments || payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No payment activity captured yet.</p>;
  }

  return (
    <div className="overflow-x-auto" data-testid="payments-table">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr className="text-left">
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Processed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-muted/40" data-testid="payments-row">
              <td className="px-3 py-2 font-medium text-foreground">
                {payment.transactionId ?? payment.id.slice(0, 8)}
              </td>
              <td className="px-3 py-2 text-foreground">
                {formatCurrency(
                  (payment.amount?.amount ?? 0) /
                    (payment.amount?.minor_unit ?? payment.amount?.minorUnit ?? 100),
                  payment.amount?.currency ?? "USD",
                )}
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant[payment.status]}>
                  {payment.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{payment.method}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {payment.processedAt ? format(new Date(payment.processedAt), "MMM d, yyyy p") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
