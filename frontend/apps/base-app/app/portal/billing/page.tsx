"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePartnerPayoutHistory, usePartnerStatements } from "@/hooks/usePartnerPortal";
import {
  DollarSign,
  Download,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function PartnerBillingPage() {
  const [payoutLimit] = useState(20);
  const [payoutOffset] = useState(0);
  const [statementLimit] = useState(20);
  const [statementOffset] = useState(0);

  const {
    data: payouts,
    isLoading: payoutsLoading,
    error: payoutsError,
  } = usePartnerPayoutHistory(payoutLimit, payoutOffset);

  const {
    data: statements,
    isLoading: statementsLoading,
    error: statementsError,
  } = usePartnerStatements(statementLimit, statementOffset);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "completed":
        return "text-green-600 bg-green-100 dark:bg-green-950/20";
      case "pending":
      case "processing":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-950/20";
      case "failed":
      case "cancelled":
        return "text-red-600 bg-red-100 dark:bg-red-950/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-950/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
      case "processing":
        return <Clock className="w-4 h-4" />;
      case "failed":
      case "cancelled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Billing & Payouts</h1>
        <p className="text-muted-foreground mt-1">
          View your payout history and commission statements
        </p>
      </div>

      {/* Payout History Section */}
      <div className="bg-card p-6 rounded-lg border border-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payout History
          </h2>
        </div>

        {payoutsLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading payouts...</div>
        ) : payoutsError ? (
          <div className="text-center py-8">
            <div className="text-red-400">Failed to load payout history</div>
            <div className="text-sm text-muted-foreground mt-2">
              {payoutsError?.message || "Please try again"}
            </div>
          </div>
        ) : !payouts || payouts.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <div className="text-muted-foreground">No payout history yet</div>
            <div className="text-sm text-muted-foreground mt-1">
              Payouts will appear here once you start earning commissions
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Method
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout: any) => (
                  <tr key={payout.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">
                          {new Date(payout.payout_date || payout.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-semibold text-foreground">
                        ${payout.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-muted-foreground">
                        {payout.payment_method || "Bank Transfer"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(payout.status)}`}
                        >
                          {getStatusIcon(payout.status)}
                          {payout.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-muted-foreground font-mono">
                        {payout.reference_number || payout.id.substring(0, 8)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission Statements Section */}
      <div className="bg-card p-6 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Commission Statements
          </h2>
        </div>

        {statementsLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading statements...</div>
        ) : statementsError ? (
          <div className="text-center py-8">
            <div className="text-red-400">Failed to load statements</div>
            <div className="text-sm text-muted-foreground mt-2">
              {statementsError?.message || "Please try again"}
            </div>
          </div>
        ) : !statements || statements.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <div className="text-muted-foreground">No statements available yet</div>
            <div className="text-sm text-muted-foreground mt-1">
              Monthly commission statements will appear here
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Period
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Total Earned
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Customers
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement: any) => (
                  <tr key={statement.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">
                          {new Date(statement.period_start).toLocaleDateString()} -{" "}
                          {new Date(statement.period_end).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-semibold text-foreground">
                        ${statement.total_commission.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-muted-foreground">
                        {statement.customer_count || 0}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(statement.status)}`}
                        >
                          {getStatusIcon(statement.status)}
                          {statement.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        onClick={() => {
                          // In production: Download statement PDF
                          console.log("Download statement:", statement.id);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Banner */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-foreground mb-1">About Payouts</div>
            <div className="text-muted-foreground space-y-1">
              <p>• Payouts are processed monthly on the 15th of each month</p>
              <p>• Minimum payout threshold: $100</p>
              <p>
                • Commissions are calculated based on actual customer payments received
              </p>
              <p>• Allow 3-5 business days for bank transfers to complete</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
