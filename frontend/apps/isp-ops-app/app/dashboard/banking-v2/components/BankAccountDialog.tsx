"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Loader2 } from "lucide-react";
import { useCreateBankAccount, useUpdateBankAccount } from "@/hooks/useBankAccounts";
import type {
  CompanyBankAccountCreate,
  CompanyBankAccountResponse,
  AccountType,
} from "@/lib/services/bank-accounts-service";

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: CompanyBankAccountResponse | null;
  onSuccess?: () => void;
}

export function BankAccountDialog({
  open,
  onOpenChange,
  account,
  onSuccess,
}: BankAccountDialogProps) {
  const isEdit = !!account;
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();

  const [formData, setFormData] = useState<CompanyBankAccountCreate>({
    account_name: "",
    account_nickname: "",
    bank_name: "",
    bank_address: "",
    bank_country: "US",
    account_type: "business",
    currency: "USD",
    account_number: "",
    routing_number: "",
    swift_code: "",
    iban: "",
    is_primary: false,
    accepts_deposits: true,
    notes: "",
  });

  useEffect(() => {
    if (account) {
      setFormData({
        account_name: account.account_name,
        account_nickname: account.account_nickname || "",
        bank_name: account.bank_name,
        bank_address: account.bank_address || "",
        bank_country: account.bank_country,
        account_type: account.account_type,
        currency: account.currency,
        account_number: "", // Never pre-fill account number
        routing_number: account.routing_number || "",
        swift_code: account.swift_code || "",
        iban: account.iban || "",
        is_primary: account.is_primary,
        accepts_deposits: account.accepts_deposits,
        notes: account.notes || "",
      });
    } else {
      // Reset form when creating new
      setFormData({
        account_name: "",
        account_nickname: "",
        bank_name: "",
        bank_address: "",
        bank_country: "US",
        account_type: "business",
        currency: "USD",
        account_number: "",
        routing_number: "",
        swift_code: "",
        iban: "",
        is_primary: false,
        accepts_deposits: true,
        notes: "",
      });
    }
  }, [account, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit && account) {
      // For edit, only send update fields (no account_number)
      await updateAccount.mutateAsync({
        accountId: account.id,
        data: {
          account_nickname: formData.account_nickname || null,
          bank_address: formData.bank_address || null,
          is_primary: formData.is_primary ?? null,
          accepts_deposits: formData.accepts_deposits ?? null,
          notes: formData.notes || null,
        },
      });
    } else {
      // For create, send all fields
      await createAccount.mutateAsync(formData);
    }

    onSuccess?.();
  };

  const isPending = createAccount.isPending || updateAccount.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update bank account information. Account number cannot be changed."
              : "Add a new company bank account for receiving payments."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_name">Account Holder Name *</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                required
                disabled={isEdit}
                placeholder="Acme Corporation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_nickname">Nickname (optional)</Label>
              <Input
                id="account_nickname"
                value={formData.account_nickname ?? ""}
                onChange={(e) => setFormData({ ...formData, account_nickname: e.target.value })}
                placeholder="Operating Account"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name *</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                required
                disabled={isEdit}
                placeholder="First National Bank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_country">Bank Country *</Label>
              <Input
                id="bank_country"
                value={formData.bank_country}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_country: e.target.value.toUpperCase(),
                  })
                }
                required
                disabled={isEdit}
                maxLength={2}
                placeholder="US"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank_address">Bank Address</Label>
            <Input
              id="bank_address"
              value={formData.bank_address ?? ""}
              onChange={(e) => setFormData({ ...formData, bank_address: e.target.value })}
              placeholder="123 Main St, City, State, ZIP"
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                type="password"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                required
                placeholder="Full account number"
              />
              <p className="text-xs text-muted-foreground">
                Only the last 4 digits will be stored and displayed
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_type">Account Type *</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    account_type: value as AccountType,
                  })
                }
                disabled={isEdit}
              >
                <SelectTrigger id="account_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="money_market">Money Market</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currency: e.target.value.toUpperCase(),
                  })
                }
                required
                disabled={isEdit}
                maxLength={3}
                placeholder="USD"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="routing_number">Routing Number</Label>
              <Input
                id="routing_number"
                value={formData.routing_number ?? ""}
                onChange={(e) => setFormData({ ...formData, routing_number: e.target.value })}
                disabled={isEdit}
                placeholder="123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="swift_code">SWIFT/BIC Code</Label>
              <Input
                id="swift_code"
                value={formData.swift_code ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    swift_code: e.target.value.toUpperCase(),
                  })
                }
                disabled={isEdit}
                maxLength={11}
                placeholder="ABCDUS33XXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={formData.iban ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    iban: e.target.value.toUpperCase(),
                  })
                }
                disabled={isEdit}
                maxLength={34}
                placeholder="GB82WEST..."
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_primary">Primary Account</Label>
                <p className="text-xs text-muted-foreground">
                  Use this account as the primary payout account
                </p>
              </div>
              <Switch
                id="is_primary"
                checked={Boolean(formData.is_primary)}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="accepts_deposits">Accepts Deposits</Label>
                <p className="text-xs text-muted-foreground">
                  Can this account receive customer payments
                </p>
              </div>
              <Switch
                id="accepts_deposits"
                checked={Boolean(formData.accepts_deposits)}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, accepts_deposits: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes ?? ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any internal notes about this account..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Update Account" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
