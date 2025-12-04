"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Card, CardContent } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { useBankAccountSummary } from "@/hooks/useBankAccounts";
import { Building2, DollarSign, TrendingUp, Calendar } from "lucide-react";

interface BankAccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number | null;
}

export function BankAccountDetailsDialog({
  open,
  onOpenChange,
  accountId,
}: BankAccountDetailsDialogProps) {
  const { data: summary, isLoading } = useBankAccountSummary(accountId);

  if (!accountId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bank Account Details</DialogTitle>
          <DialogDescription>View account information and statistics</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {summary.account.account_nickname || summary.account.account_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{summary.account.bank_name}</p>
                  </div>
                  <Badge>
                    {summary.account.status.charAt(0).toUpperCase() +
                      summary.account.status.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Account Number</span>
                    <p className="font-mono">****{summary.account.account_number_last_four}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account Type</span>
                    <p className="capitalize">{summary.account.account_type.replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Currency</span>
                    <p>{summary.account.currency}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country</span>
                    <p>{summary.account.bank_country}</p>
                  </div>
                  {summary.account.routing_number && (
                    <div>
                      <span className="text-muted-foreground">Routing</span>
                      <p className="font-mono">{summary.account.routing_number}</p>
                    </div>
                  )}
                  {summary.account.swift_code && (
                    <div>
                      <span className="text-muted-foreground">SWIFT</span>
                      <p className="font-mono">{summary.account.swift_code}</p>
                    </div>
                  )}
                  {summary.account.iban && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">IBAN</span>
                      <p className="font-mono">{summary.account.iban}</p>
                    </div>
                  )}
                </div>

                {summary.account.notes && (
                  <div className="border-t pt-4">
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm mt-1">{summary.account.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">MTD Deposits</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {summary.account.currency} {summary.total_deposits_mtd.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">YTD Deposits</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {summary.account.currency} {summary.total_deposits_ytd.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Pending Payments</span>
                  </div>
                  <p className="text-2xl font-bold">{summary.pending_payments}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Last Reconciled</span>
                  </div>
                  <p className="text-sm font-medium">
                    {summary.last_reconciliation
                      ? new Date(summary.last_reconciliation).toLocaleDateString()
                      : "Never"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {summary.current_balance !== null && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Balance</span>
                    <p className="text-xl font-bold">
                      {summary.account.currency} {summary.current_balance.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Account not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
