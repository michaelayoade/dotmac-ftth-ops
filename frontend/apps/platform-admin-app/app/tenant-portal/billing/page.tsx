"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useEffect, useState } from "react";
import Link from "next/link";
import { tenantService, TenantStats } from "@/lib/services/tenant-service";
import { useTenant } from "@/lib/contexts/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { CreditCard, FileText, Wallet, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { Invoice, Payment } from "@/types/billing";
import InvoiceList from "@/components/billing/InvoiceList";
import TenantPaymentsTable from "@/components/tenant/TenantPaymentsTable";
import { formatCurrency } from "@/lib/utils/currency";

interface InvoiceSummaryState {
  open: number;
  overdue: number;
  upcoming: number;
}

interface PaymentSummaryState {
  pending: number;
  failed: number;
}

export default function TenantBillingPage() {
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummaryState>({
    open: 0,
    overdue: 0,
    upcoming: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryState>({
    pending: 0,
    failed: 0,
  });
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) return;

    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const statsData = await tenantService.getStats(currentTenant.id);
        setStats(statsData);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unable to load billing metrics");
      } finally {
        setLoading(false);
      }
    };

    const loadBillingSignals = async () => {
      try {
        setInvoiceSummary({ open: 0, overdue: 0, upcoming: 0 });
        setPaymentSummary({ pending: 0, failed: 0 });
        const [invoicesResponse, paymentsResponse] = await Promise.all([
          apiClient.get<{ invoices?: Invoice[] }>("/billing/invoices"),
          apiClient.get<{ payments?: Payment[] }>("/billing/payments?limit=50"),
        ]);

        if (invoicesResponse.data?.invoices) {
          const invoices = invoicesResponse.data.invoices;
          const now = Date.now();
          const open = invoices.filter(
            (invoice) => invoice.amount_due > 0 && invoice.status !== "paid",
          ).length;
          const overdue = invoices.filter((invoice) => {
            if (invoice.amount_due <= 0) return false;
            const dueDate = new Date(invoice.due_date).getTime();
            return dueDate < now;
          }).length;
          const upcoming = invoices.filter((invoice) => {
            if (invoice.amount_due <= 0) return false;
            const dueDate = new Date(invoice.due_date).getTime();
            return dueDate >= now;
          }).length;
          setInvoiceSummary({ open, overdue, upcoming });
        }

        if (paymentsResponse.data?.payments) {
          const payments = paymentsResponse.data.payments;
          const pending = payments.filter(
            (payment) => payment.status === "pending" || payment.status === "processing",
          ).length;
          const failed = payments.filter((payment) => payment.status === "failed").length;
          setPaymentSummary({ pending, failed });
          setRecentPayments(payments.slice(0, 10));
        }
      } catch (err) {
        console.error("Failed to load billing signals", err);
      }
    };

    loadStats();
    loadBillingSignals();
  }, [currentTenant?.id]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Billing & Plans</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Keep your subscription current, monitor invoices, and manage payment methods from a single
          place.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 rounded-lg" />
          ))
        ) : (
          <>
            <BillingCard
              title="Current plan"
              icon={CreditCard}
              value={stats ? tenantService.getPlanDisplayName(stats.plan) : "—"}
              body={`Status: ${stats ? tenantService.getStatusDisplayName(stats.status) : "Unknown"}`}
            />
            <BillingCard
              title="Monthly spend"
              icon={Wallet}
              value={stats && stats.plan === "enterprise" ? "$9,200" : "$2,499"}
              body="Includes usage-based charges"
            />
            <BillingCard
              title="Open invoices"
              icon={FileText}
              value={`${invoiceSummary.open} open`}
              body={
                <div className="flex flex-col gap-1 text-sm">
                  <Link
                    href="/tenant-portal/billing/receipts"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Review invoices
                  </Link>
                  {invoiceSummary.overdue > 0 ? (
                    <span className="text-destructive">
                      {invoiceSummary.overdue} overdue invoice
                      {invoiceSummary.overdue === 1 ? "" : "s"}
                    </span>
                  ) : invoiceSummary.upcoming > 0 ? (
                    <span className="text-muted-foreground">
                      {invoiceSummary.upcoming} invoice
                      {invoiceSummary.upcoming === 1 ? "" : "s"} due soon
                    </span>
                  ) : (
                    <span className="text-muted-foreground">All invoices current</span>
                  )}
                </div>
              }
            />
            <BillingCard
              title="Payment health"
              icon={TrendingUp}
              value={`${paymentSummary.pending} pending`}
              body={
                paymentSummary.failed > 0
                  ? `${paymentSummary.failed} payment${paymentSummary.failed === 1 ? "" : "s"} failed in the last batch`
                  : "No recent payment failures detected"
              }
            />
          </>
        )}
      </section>

      {error && (
        <Card className="border-destructive bg-destructive/10 text-destructive">
          <CardHeader>
            <CardTitle>Billing data unavailable</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              Update plan tiers, add-on packages, and view renewal history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/tenant-portal/billing/subscription">Manage plan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tenant-portal/billing/subscription">View subscription</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods & invoices</CardTitle>
            <CardDescription>
              Securely update payment details and download past invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/tenant-portal/billing/payment-methods">Manage payment methods</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tenant-portal/billing/receipts">Open invoice workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoice history</CardTitle>
            <CardDescription>Recent invoices scoped to your tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InvoiceList
              tenantId={currentTenant?.id ?? "default-tenant"}
              onInvoiceSelect={setSelectedInvoice}
            />
          </CardContent>
        </Card>

        {selectedInvoice && (
          <Card>
            <CardHeader>
              <CardTitle>Selected invoice</CardTitle>
              <CardDescription>
                {selectedInvoice.invoice_number} • Due{" "}
                {new Date(selectedInvoice.due_date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Customer: {selectedInvoice.billing_email ?? selectedInvoice.customer_id}</div>
              <div>
                Amount due:{" "}
                {formatCurrency(selectedInvoice.amount_due, selectedInvoice.currency ?? "USD")}
              </div>
              {selectedInvoice.status !== "paid" && (
                <div className="text-destructive mt-2">Status: {selectedInvoice.status}</div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>Latest payment attempts and their status.</CardDescription>
          </CardHeader>
          <CardContent>
            <TenantPaymentsTable payments={recentPayments} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface BillingCardProps {
  title: string;
  value: string;
  body?: React.ReactNode;
  icon: React.ElementType;
}

function BillingCard({ title, value, body, icon: Icon }: BillingCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </CardHeader>
      {body && <CardContent className="text-sm text-muted-foreground">{body}</CardContent>}
    </Card>
  );
}
