"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { DollarSign, Loader2 } from "lucide-react";
import { usePartnerCommissions } from "@/hooks/useResellerPortal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  approved: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  paid: "bg-green-500/10 text-green-500 border-green-500/30",
  disputed: "bg-red-500/10 text-red-500 border-red-500/30",
  cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/30",
};

export default function CommissionsPage() {
  const { data: commissions, isLoading } = usePartnerCommissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading commissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground">
          Track your commission earnings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Commission History
          </CardTitle>
          <CardDescription>
            All commissions earned from your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!commissions || commissions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No commissions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Commissions will appear here as your referrals generate revenue
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {commissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {formatCurrency(commission.commission_amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {commission.commission_rate * 100}% of{" "}
                      {formatCurrency(commission.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(commission.event_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      statusColors[commission.status] || statusColors["pending"]
                    }
                  >
                    {commission.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
