"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useReconciliations, useReconciliationSummary } from "@/hooks/useReconciliation";
import { ReconciliationWizard } from "./ReconciliationWizard";

export function ReconciliationTab() {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: new Date(new Date().setDate(1)).toISOString().slice(0, 10), // First day of month
    end: new Date().toISOString().slice(0, 10), // Today
  });

  const { data: reconciliations, isLoading: isLoadingReconciliations } = useReconciliations({
    start_date: selectedPeriod.start,
    end_date: selectedPeriod.end,
  });

  const { data: summary, isLoading: isLoadingSummary } = useReconciliationSummary();

  const getStatusBadge = (status: string) => {
    const variants = {
      in_progress: { variant: "secondary" as const, icon: Clock },
      completed: { variant: "default" as const, icon: CheckCircle2 },
      cancelled: { variant: "outline" as const, icon: AlertCircle },
    };

    const config = variants[status as keyof typeof variants] || {
      variant: "outline" as const,
      icon: AlertCircle,
    };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ").charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoadingReconciliations || isLoadingSummary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Match manual payments with bank statements to ensure accuracy
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Start Reconciliation
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">{summary.total_reconciliations}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">{summary.completed_reconciliations}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Discrepancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold">${summary.avg_discrepancy.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Discrepancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-2xl font-bold">${summary.total_discrepancy.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reconciliation Sessions Table */}
      {!reconciliations ||
      !reconciliations.reconciliations ||
      reconciliations.reconciliations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reconciliation Sessions</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Start your first reconciliation session to match payments with bank statements.
            </p>
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Start Reconciliation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reconciliation Sessions</CardTitle>
            <CardDescription>All reconciliation sessions for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Discrepancies</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.reconciliations.map((session: any) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(session.period_start).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              to {new Date(session.period_end).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {session.bank_account.account_nickname ||
                              session.bank_account.account_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ****{session.bank_account.account_number_last_four}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {session.payments_reconciled_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {session.total_amount_reconciled.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.discrepancies_count > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {session.discrepancies_count}
                          </Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{session.created_by_user_id}</span>
                      </TableCell>
                      <TableCell>
                        {session.completed_at ? (
                          <span className="text-sm">
                            {new Date(session.completed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <Badge variant="secondary">In Progress</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ReconciliationWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => setShowWizard(false)}
      />
    </div>
  );
}
