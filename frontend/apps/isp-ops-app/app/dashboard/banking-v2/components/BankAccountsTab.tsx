"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import {
  Plus,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MoreVertical,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import {
  useBankAccounts,
  useVerifyBankAccount,
  useDeactivateBankAccount,
} from "@/hooks/useBankAccounts";
import type { CompanyBankAccountResponse } from "@/lib/services/bank-accounts-service";
import { BankAccountDialog } from "./BankAccountDialog";
import { BankAccountDetailsDialog } from "./BankAccountDetailsDialog";
import { useConfirmDialog } from "@dotmac/ui";

export function BankAccountsTab() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CompanyBankAccountResponse | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data: accounts, isLoading } = useBankAccounts(includeInactive);
  const verifyAccount = useVerifyBankAccount();
  const deactivateAccount = useDeactivateBankAccount();
  const confirmDialog = useConfirmDialog();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      verified: "default",
      pending: "secondary",
      failed: "destructive",
      suspended: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleViewDetails = (account: CompanyBankAccountResponse) => {
    setSelectedAccount(account);
    setShowDetailsDialog(true);
  };

  const handleEdit = (account: CompanyBankAccountResponse) => {
    setSelectedAccount(account);
    setShowAddDialog(true);
  };

  const handleVerify = async (accountId: number) => {
    await verifyAccount.mutateAsync({
      accountId,
      notes: "Verified via banking dashboard",
    });
  };

  const handleDeactivate = async (accountId: number) => {
    const confirmed = await confirmDialog({
      title: "Deactivate bank account",
      description: "Are you sure you want to deactivate this bank account?",
      confirmText: "Deactivate",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    await deactivateAccount.mutateAsync(accountId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Bank Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage company bank accounts for receiving payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIncludeInactive(!includeInactive)}>
            {includeInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
          <Button
            onClick={() => {
              setSelectedAccount(null);
              setShowAddDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {!accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Bank Accounts</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add your company bank accounts to start accepting manual payments
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Bank Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className={!account.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.status)}
                    <CardTitle className="text-base">
                      {account.account_nickname || account.account_name}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Open actions menu">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(account)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(account)}>
                        Edit Account
                      </DropdownMenuItem>
                      {account.status === "pending" && (
                        <DropdownMenuItem onClick={() => handleVerify(account.id)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify Account
                        </DropdownMenuItem>
                      )}
                      {account.is_active && (
                        <DropdownMenuItem
                          onClick={() => handleDeactivate(account.id)}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="text-xs">
                  {account.bank_name} • {account.bank_country}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Account</span>
                  <span className="text-sm font-mono">****{account.account_number_last_four}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <Badge variant="outline" className="text-xs">
                    {account.account_type.replace("_", " ")}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Currency</span>
                  <span className="text-sm">{account.currency}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  {getStatusBadge(account.status)}
                </div>

                {account.is_primary && (
                  <Badge variant="default" className="w-full justify-center">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Primary Account
                  </Badge>
                )}

                {!account.is_active && (
                  <Badge variant="outline" className="w-full justify-center">
                    Inactive
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BankAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        account={selectedAccount}
        onSuccess={() => {
          setShowAddDialog(false);
          setSelectedAccount(null);
        }}
      />

      <BankAccountDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        accountId={selectedAccount?.id || null}
      />
    </div>
  );
}
