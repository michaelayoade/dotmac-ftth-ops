"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@dotmac/ui";
import { Button } from "@dotmac/primitives";
import { CreditCard, FileText, Puzzle, Loader2 } from "lucide-react";
import { useTenantSubscription, useTenantInvoices } from "@/hooks/useTenantPortal";

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function BillingPage() {
  const { data: subscription, isLoading: subLoading } = useTenantSubscription();
  const { data: invoices, isLoading: invLoading } = useTenantInvoices();

  const isLoading = subLoading || invLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const recentInvoices = invoices?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and invoices
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{subscription?.plan_name}</p>
              <p className="text-muted-foreground">
                {formatCurrency(subscription?.price_amount ?? 0)} /{" "}
                {subscription?.billing_cycle}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Next billing:{" "}
                {subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Badge
                variant={subscription?.status === "active" ? "default" : "secondary"}
                className="capitalize"
              >
                {subscription?.status}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/portal/billing/subscription">Change Plan</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/portal/billing/payment-methods">Manage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/portal/billing/addons">Browse</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/portal/billing/receipts">View All</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
          <CardDescription>Your latest billing statements</CardDescription>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No invoices yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </p>
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
