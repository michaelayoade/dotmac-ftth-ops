"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Receipt, DollarSign, Calendar } from "lucide-react";
import Link from "next/link";

interface BillingSummaryCardProps {
  billing: {
    summary: {
      balance?: number;
      lastPayment?: string;
    } | null;
    totalInvoices: number;
    unpaidInvoices: number;
  };
  customerId: string;
}

export function BillingSummaryCard({ billing, customerId }: BillingSummaryCardProps) {
  const balance = billing.summary?.balance ?? 0;
  const isOverdue = balance < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Billing Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Balance
          </span>
          <span className={`text-2xl font-bold ${isOverdue ? "text-red-600" : "text-foreground"}`}>
            ${Math.abs(balance).toFixed(2)}
          </span>
        </div>
        {isOverdue && (
          <Badge variant="destructive" className="w-full justify-center">
            Overdue
          </Badge>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Invoices</span>
            <span className="font-medium">{billing.totalInvoices}</span>
          </div>
          {billing.unpaidInvoices > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Unpaid</span>
              <Badge variant="secondary">{billing.unpaidInvoices}</Badge>
            </div>
          )}
          {billing.summary?.lastPayment && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last Payment
              </span>
              <span className="text-xs">
                {new Date(billing.summary.lastPayment).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        <div className="pt-2 border-t">
          <Link
            href={`/dashboard/operations/customers/${customerId}/billing`}
            className="text-sm text-primary hover:underline"
          >
            View Billing Details →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
