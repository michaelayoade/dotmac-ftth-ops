"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  usePartnerDashboard,
  usePartnerPayoutHistory,
  usePartnerStatements,
  type PartnerStatement,
  type PartnerPayoutStatus,
} from "@/hooks/usePartnerPortal";
import { useCreditNotes } from "@/hooks/useCreditNotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BadgeCheck, Download, Inbox, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const STATEMENT_STATUS: Record<
  PartnerPayoutStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  ready: { label: "Ready to payout", variant: "outline" },
  processing: { label: "Processing", variant: "outline" },
  completed: { label: "Paid", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const PAYOUT_STATUS: Record<
  PartnerPayoutStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  ready: { label: "Queued", variant: "outline" },
  processing: { label: "Processing", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const CREDIT_NOTE_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  issued: { label: "Issued", variant: "default" },
  partially_applied: { label: "Partially Applied", variant: "outline" },
  applied: { label: "Applied", variant: "outline" },
  voided: { label: "Voided", variant: "destructive" },
};

const formatUsd = (amount: number) => formatCurrency(amount, "USD");

const getStatementStatus = (status: PartnerPayoutStatus) =>
  STATEMENT_STATUS[status] ?? STATEMENT_STATUS.pending;

const getPayoutStatus = (status: PartnerPayoutStatus) =>
  PAYOUT_STATUS[status] ?? PAYOUT_STATUS.pending;

const formatMinorCurrency = (amountMinor: number, currency: string) =>
  formatCurrency(amountMinor / 100, currency || "USD");

export default function PartnerBillingPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = usePartnerDashboard();

  // Pagination for statements
  const statementsPagination = usePagination(10);
  const {
    data: statements,
    isLoading: statementsLoading,
    error: statementsError,
  } = usePartnerStatements(statementsPagination.limit, statementsPagination.offset);

  // Pagination for payouts
  const payoutsPagination = usePagination(10);
  const {
    data: payouts,
    isLoading: payoutsLoading,
    error: payoutsError,
  } = usePartnerPayoutHistory(payoutsPagination.limit, payoutsPagination.offset);

  const {
    data: creditNotes,
    isLoading: creditNotesLoading,
    error: creditNotesError,
  } = useCreditNotes(5);

  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  useEffect(() => {
    if (statements && statements.length > 0) {
      setSelectedStatementId((previous) => {
        if (previous && statements.some((statement) => statement.id === previous)) {
          return previous;
        }
        return statements[0]?.id ?? null;
      });
    } else {
      setSelectedStatementId(null);
    }
  }, [statements]);

  const selectedStatement =
    statements?.find((statement) => statement.id === selectedStatementId) ?? null;

  const statementRows = statements ?? [];
  const payoutRows = payouts ?? [];
  const statementsTotal = statementRows.length;
  const payoutsTotal = payoutRows.length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Partner Billing</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Review referral revenue share, track payouts, and download statements that support
          your finance reconciliation process.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 rounded-lg" />
          ))
        ) : (
          <>
            <MetricCard
              title="Current partner tier"
              value={stats?.current_tier ? stats.current_tier.replace("_", " ") : "—"}
              icon={BadgeCheck}
              helper={
                stats?.commission_model
                  ? `Commission model • ${stats.commission_model.replace("_", " ")}`
                  : undefined
              }
            />
            <MetricCard
              title="Pending commissions"
              value={stats ? formatUsd(stats.pending_commissions) : "—"}
              icon={Wallet}
              helper={
                stats ? `${formatUsd(stats.total_commissions_paid)} paid to date` : undefined
              }
            />
            <MetricCard
              title="Revenue share (YTD)"
              value={stats ? formatUsd(stats.total_revenue_generated) : "—"}
              icon={TrendingUp}
              helper={stats ? `${stats.total_customers} customers sourced` : undefined}
            />
            <MetricCard
              title="Conversion rate"
              value={stats ? `${(stats.conversion_rate || 0).toFixed(1)}%` : "—"}
              icon={ShieldCheck}
              helper={
                stats ? `${stats.converted_referrals} of ${stats.total_referrals} referrals converted` : undefined
              }
            />
          </>
        )}
      </section>

      {statsError && (
        <Alert variant="destructive">
          <AlertTitle>Billing metrics unavailable</AlertTitle>
          <AlertDescription>
            {statsError instanceof Error
              ? statsError.message
              : "We could not load partner billing metrics right now. Please retry or contact partner support."}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manage payouts</CardTitle>
            <CardDescription>Update payout preferences, contacts, and thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/partner/support">Contact finance operations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner/resources">View payout policies</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statements & reporting</CardTitle>
            <CardDescription>Download signed statements or export detailed commission reports.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/partner/resources#reports">Download statement template</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner/tenants">Review tenant impact</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Monthly statements</CardTitle>
            <CardDescription>
              Statements summarize recognized revenue, eligible commissions, and adjustments per
              month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statementsError ? (
              <Alert variant="warning">
                <AlertTitle>Unable to load statements</AlertTitle>
                <AlertDescription>
                  {statementsError instanceof Error
                    ? statementsError.message
                    : "No statements are available right now. Try refreshing later."}
                </AlertDescription>
              </Alert>
            ) : statementsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : statementRows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Inbox className="h-4 w-4" />
                No statements generated yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Revenue share</TableHead>
                    <TableHead className="text-right">Net payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementRows.map((statement) => {
                    const statusConfig = getStatementStatus(statement.status);
                    const periodLabel = format(new Date(statement.period_end), "MMMM yyyy");
                    const periodRange = `${format(new Date(statement.period_start), "MMM d")} – ${format(new Date(statement.period_end), "MMM d, yyyy")}`;
                    const issuedAt = format(new Date(statement.issued_at), "MMM d, yyyy");
                    const netPayable = statement.commission_total + statement.adjustments_total;

                    return (
                      <TableRow key={statement.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{periodLabel}</div>
                          <div className="text-xs text-muted-foreground">{periodRange}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatUsd(statement.revenue_total)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatUsd(netPayable)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {issuedAt}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedStatementId(statement.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!statementsLoading && statementsTotal > 0 && (
              <TablePagination
                pageIndex={statementsPagination.pageIndex}
                pageCount={Math.max(1, Math.ceil(statementsTotal / statementsPagination.pageSize))}
                pageSize={statementsPagination.pageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageChange={statementsPagination.onPageChange}
                onPageSizeChange={statementsPagination.onPageSizeChange}
                totalItems={statementsTotal}
                className="mt-4"
              />
            )}
          </CardContent>
        </Card>

        {selectedStatement ? (
          <StatementDetailsCard statement={selectedStatement} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No statement selected</CardTitle>
              <CardDescription>Select a statement to view its breakdown.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent credit notes</CardTitle>
            <CardDescription>Download the latest credits issued to your customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {creditNotesError ? (
              <Alert variant="warning">
                <AlertTitle>Unable to load credit notes</AlertTitle>
                <AlertDescription>
                  {creditNotesError instanceof Error
                    ? creditNotesError.message
                    : "Try refreshing or check with finance operations."}
                </AlertDescription>
              </Alert>
            ) : creditNotesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : (creditNotes ?? []).length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Inbox className="h-4 w-4" />
                No credit notes issued in the recent period.
              </div>
            ) : (
              <div className="space-y-3">
                {(creditNotes ?? []).map((note) => {
                  const statusKey = note.status.toLowerCase();
                  const statusConfig =
                    CREDIT_NOTE_STATUS[statusKey] ?? {
                      label: note.status,
                      variant: "secondary" as const,
                    };
                  return (
                    <div
                      key={note.id}
                      className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{note.number}</span>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {note.invoiceId ? `Invoice ${note.invoiceId}` : "Standalone credit"} ·{" "}
                          {note.issuedAt ? format(new Date(note.issuedAt), "MMM d, yyyy") : "Date pending"}
                        </div>
                        <div className="text-sm text-foreground">
                          {formatMinorCurrency(note.totalAmountMinor, note.currency)}{" "}
                          {note.remainingAmountMinor > 0 && (
                            <span className="text-xs text-muted-foreground">
                              · Remaining {formatMinorCurrency(note.remainingAmountMinor, note.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={note.downloadUrl} prefetch={false}>
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <CardDescription>
              Track ACH payouts released for your partnership. Processing payouts update hourly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payoutsError ? (
              <Alert variant="warning">
                <AlertTitle>Unable to load payout history</AlertTitle>
                <AlertDescription>
                  {payoutsError instanceof Error
                    ? payoutsError.message
                    : "Refresh the page or contact partner support if the issue continues."}
                </AlertDescription>
              </Alert>
            ) : payoutsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : payoutRows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Inbox className="h-4 w-4" />
                No payouts recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payout</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Initiated</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutRows.map((payout) => {
                    const statusConfig = getPayoutStatus(payout.status);
                    const periodRange = `${format(new Date(payout.period_start), "MMM d, yyyy")} – ${format(new Date(payout.period_end), "MMM d, yyyy")}`;
                    const initiatedAt = format(new Date(payout.payout_date), "MMM d, yyyy");
                    const completedAt = payout.completed_at
                      ? format(new Date(payout.completed_at), "MMM d, yyyy")
                      : "—";
                    return (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{payout.id}</div>
                          <div className="text-xs text-muted-foreground">
                            Reference {payout.payment_reference ?? "pending"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {periodRange}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatUsd(payout.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {initiatedAt}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {completedAt}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!payoutsLoading && payoutsTotal > 0 && (
              <TablePagination
                pageIndex={payoutsPagination.pageIndex}
                pageCount={Math.max(1, Math.ceil(payoutsTotal / payoutsPagination.pageSize))}
                pageSize={payoutsPagination.pageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageChange={payoutsPagination.onPageChange}
                onPageSizeChange={payoutsPagination.onPageSizeChange}
                totalItems={payoutsTotal}
                className="mt-4"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatementDetailsCard({ statement }: { statement: PartnerStatement }) {
  const adjustments = statement.adjustments_total;
  const netPayable = statement.commission_total + adjustments;

  const formattedAdjustments = adjustments === 0
    ? formatUsd(0)
    : `${adjustments < 0 ? "-" : ""}${formatUsd(Math.abs(adjustments))}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{format(new Date(statement.period_end), "MMMM yyyy")} statement</CardTitle>
        <CardDescription>
          {statement.id} • Issued {format(new Date(statement.issued_at), "MMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Revenue share">
            {formatUsd(statement.revenue_total)}
          </DetailItem>
          <DetailItem label="Commission due">
            {formatUsd(statement.commission_total)}
          </DetailItem>
          <DetailItem label="Adjustments">
            {formattedAdjustments}
          </DetailItem>
          <DetailItem label="Net payable">
            {formatUsd(netPayable)}
          </DetailItem>
        </div>
        <div className="flex flex-wrap gap-2">
          {statement.download_url ? (
            <Button size="sm" asChild>
              <Link
                href={statement.download_url}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Statement pending
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href="/partner/support">Request adjustment</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  helper?: string;
  icon: ElementType;
}

function MetricCard({ title, value, helper, icon: Icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
          {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
        </div>
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      </CardHeader>
    </Card>
  );
}

interface DetailItemProps {
  label: string;
  children: ReactNode;
}

function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{children}</div>
    </div>
  );
}
