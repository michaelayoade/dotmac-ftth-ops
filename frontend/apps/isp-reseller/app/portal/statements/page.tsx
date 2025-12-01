"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/primitives";
import { FileText, Download, Loader2 } from "lucide-react";
import { usePartnerStatements, usePartnerPayoutHistory } from "@/hooks/useResellerPortal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  ready: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  processing: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  completed: "bg-green-500/10 text-green-500 border-green-500/30",
  failed: "bg-red-500/10 text-red-500 border-red-500/30",
  cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/30",
};

export default function StatementsPage() {
  const { data: statements, isLoading: statementsLoading } = usePartnerStatements();
  const { data: payouts, isLoading: payoutsLoading } = usePartnerPayoutHistory();

  const isLoading = statementsLoading || payoutsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading statements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statements</h1>
        <p className="text-muted-foreground">
          View your commission statements and payout history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Commission Statements
          </CardTitle>
          <CardDescription>Monthly commission summaries</CardDescription>
        </CardHeader>
        <CardContent>
          {!statements || statements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No statements yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Statements will be generated at the end of each billing period
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {statements.map((statement) => (
                <div
                  key={statement.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(statement.period_start).toLocaleDateString()} -{" "}
                      {new Date(statement.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Revenue: {formatCurrency(statement.revenue_total)} • Commission:{" "}
                      {formatCurrency(statement.commission_total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={statusColors[statement.status] || statusColors["pending"]}
                    >
                      {statement.status}
                    </Badge>
                    {statement.download_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={statement.download_url} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Record of all commission payouts</CardDescription>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No payouts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {formatCurrency(payout.total_amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payout.commission_count} commissions • {payout.payment_method}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(payout.payout_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[payout.status] || statusColors["pending"]}
                  >
                    {payout.status}
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
