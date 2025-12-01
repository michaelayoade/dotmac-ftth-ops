"use client";

import { usePartnerCommissions } from "@/hooks/usePlatformPartner";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@dotmac/ui";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  disputed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function CommissionsPage() {
  const { data: commissions, isLoading, error } = usePartnerCommissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load commissions</p>
      </div>
    );
  }

  const totalPending = commissions
    ?.filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + c.commission_amount, 0) ?? 0;

  const totalPaid = commissions
    ?.filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commission_amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Commissions</h2>
        <p className="text-gray-600 mt-1">
          Track your earnings from referred tenants
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Total Commissions</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalPending + totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Pending Payout</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {formatCurrency(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Paid Out</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(totalPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {commissions && commissions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Commission History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-gray-500">Date</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Invoice Amount</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Rate</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Commission</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="pb-3 text-sm font-medium text-gray-500">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="border-b last:border-0">
                      <td className="py-4 text-sm">
                        {new Date(commission.event_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-sm">
                        {formatCurrency(commission.amount)}
                      </td>
                      <td className="py-4 text-sm">
                        {formatPercent(commission.commission_rate)}
                      </td>
                      <td className="py-4 text-sm font-medium">
                        {formatCurrency(commission.commission_amount)}
                      </td>
                      <td className="py-4">
                        <Badge className={statusColors[commission.status] || "bg-gray-100 text-gray-800"}>
                          {commission.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm text-gray-500">
                        {commission.payment_date
                          ? new Date(commission.payment_date).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No commissions yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Commissions will appear here when your referred tenants generate revenue
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
