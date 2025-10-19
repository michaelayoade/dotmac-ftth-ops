"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { usePartnerCommissions } from "@/hooks/usePartnerPortal";
import { DollarSign, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react";

export default function PartnerCommissionsPage() {
  const { data: commissions, isLoading, error } = usePartnerCommissions();

  const STATUS_COLORS = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    disputed: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-muted/10 text-muted-foreground border-border",
  };

  const STATUS_ICONS = {
    pending: Clock,
    approved: AlertCircle,
    paid: CheckCircle,
    disputed: XCircle,
    cancelled: XCircle,
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading commissions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400">Failed to load commissions</div>
          <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  const commissionList = commissions || [];
  const totalEarned = commissionList.reduce(
    (sum, c) => sum + c.commission_amount,
    0
  );
  const totalPaid = commissionList
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const totalPending = commissionList
    .filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + c.commission_amount, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Commissions</h1>
        <p className="text-muted-foreground mt-1">
          Track your commission earnings and payments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Earned</div>
              <div className="text-3xl font-bold text-foreground">
                ${totalEarned.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {commissionList.length} events
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Paid</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                ${totalPaid.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Received</div>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Pending</div>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                ${totalPending.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Awaiting payout</div>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Commissions Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {commissionList.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No commissions yet</p>
            <p className="text-sm text-muted-foreground">
              Commissions will appear here when your referrals convert
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Payment Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissionList.map((commission) => {
                  const StatusIcon = STATUS_ICONS[commission.status];

                  return (
                    <tr
                      key={commission.id}
                      className="hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        {new Date(commission.event_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {commission.customer_id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        ${commission.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(commission.commission_rate * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        ${commission.commission_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded border flex items-center gap-1 w-fit ${
                            STATUS_COLORS[commission.status]
                          }`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {commission.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {commission.payment_date
                          ? new Date(commission.payment_date).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Information */}
      <div className="mt-6 bg-card p-6 rounded-lg border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Payment Information
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Commissions are typically paid monthly on the 15th</p>
          <p>
            • Minimum payout threshold: $100 (pending commissions below this
            amount will roll over to the next month)
          </p>
          <p>
            • Payment method can be configured in{" "}
            <a href="/portal/settings" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
              Settings
            </a>
          </p>
          <p>
            • For questions about commissions, contact{" "}
            <a
              href="mailto:partners@dotmac.com"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              partners@dotmac.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
