"use client";

import { useState } from "react";
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
import { Loader2, Upload, X } from "lucide-react";
import {
  useRecordCashPayment,
  useRecordCheckPayment,
  useRecordBankTransferPayment,
  useRecordMobileMoneyPayment,
  useBankAccounts,
} from "@/hooks/useBankAccounts";
import type {
  CashPaymentCreate,
  CheckPaymentCreate,
  BankTransferCreate,
  ManualPaymentBase,
  MobileMoneyCreate,
} from "@/lib/services/bank-accounts-service";

interface PaymentRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type PaymentMethod = "cash" | "check" | "bank_transfer" | "mobile_money";

interface CommonPaymentFormData {
  customer_id: string;
  invoice_id: string;
  amount: string;
  currency: string;
  payment_date: string;
  notes: string;
}

interface CashPaymentFormData {
  cash_register_id: string;
  denomination_breakdown: string;
  cashier_name: string;
}

interface CheckPaymentFormData {
  check_number: string;
  bank_name: string;
  check_date: string;
}

interface BankTransferFormData {
  bank_account_id: string;
  sender_account_name: string;
  sender_account_number: string;
  sender_bank_name: string;
  transaction_reference: string;
}

interface MobileMoneyFormData {
  provider: string;
  sender_phone: string;
  transaction_id: string;
}

export function PaymentRecordDialog({ open, onOpenChange, onSuccess }: PaymentRecordDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Hooks
  const { data: bankAccounts } = useBankAccounts(false);
  const recordCash = useRecordCashPayment();
  const recordCheck = useRecordCheckPayment();
  const recordBankTransfer = useRecordBankTransferPayment();
  const recordMobileMoney = useRecordMobileMoneyPayment();

  // Common form data
  const [commonData, setCommonData] = useState<CommonPaymentFormData>({
    customer_id: "",
    invoice_id: "",
    amount: "",
    currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Cash-specific data
  const [cashData, setCashData] = useState<CashPaymentFormData>({
    cash_register_id: "",
    denomination_breakdown: "",
    cashier_name: "",
  });

  // Check-specific data
  const [checkData, setCheckData] = useState<CheckPaymentFormData>({
    check_number: "",
    bank_name: "",
    check_date: new Date().toISOString().slice(0, 10),
  });

  // Bank transfer-specific data
  const [bankTransferData, setBankTransferData] = useState<BankTransferFormData>({
    bank_account_id: "",
    sender_account_name: "",
    sender_account_number: "",
    sender_bank_name: "",
    transaction_reference: "",
  });

  // Mobile money-specific data
  const [mobileMoneyData, setMobileMoneyData] = useState<MobileMoneyFormData>({
    provider: "",
    sender_phone: "",
    transaction_id: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
  };

  const buildBasePayment = (): Omit<ManualPaymentBase, "payment_method"> | null => {
    const amountValue = Number.parseFloat(commonData.amount);
    if (Number.isNaN(amountValue)) {
      return null;
    }

    const base: Omit<ManualPaymentBase, "payment_method"> = {
      customer_id: commonData.customer_id.trim(),
      invoice_id: commonData["invoice_id"] ? commonData.invoice_id.trim() : null,
      amount: amountValue,
      payment_date: commonData.payment_date,
      notes: commonData.notes ? commonData.notes : null,
    };

    if (commonData.currency) {
      base.currency = commonData.currency;
    }

    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const basePayment = buildBasePayment();
    if (!basePayment) {
      return;
    }

    try {
      switch (paymentMethod) {
        case "cash": {
          const cashPayment: CashPaymentCreate = {
            ...basePayment,
            payment_method: "cash",
            cash_register_id: cashData.cash_register_id ? cashData.cash_register_id : null,
            cashier_name: cashData.cashier_name ? cashData.cashier_name : null,
          };
          await recordCash.mutateAsync(cashPayment);
          break;
        }

        case "check": {
          const checkPayment: CheckPaymentCreate = {
            ...basePayment,
            payment_method: "check",
            received_date: checkData.check_date,
            check_number: checkData.check_number,
            check_bank_name: checkData.bank_name || null,
          };
          await recordCheck.mutateAsync(checkPayment);
          break;
        }

        case "bank_transfer": {
          const bankTransferPayment: BankTransferCreate = {
            ...basePayment,
            payment_method: "bank_transfer",
            bank_account_id: bankTransferData.bank_account_id
              ? Number.parseInt(bankTransferData.bank_account_id, 10)
              : null,
            sender_name: bankTransferData.sender_account_name
              ? bankTransferData.sender_account_name
              : null,
            sender_bank: bankTransferData.sender_bank_name
              ? bankTransferData.sender_bank_name
              : null,
            sender_account_last_four: bankTransferData.sender_account_number
              ? bankTransferData.sender_account_number.slice(-4)
              : null,
            external_reference: bankTransferData.transaction_reference
              ? bankTransferData.transaction_reference
              : null,
          };
          await recordBankTransfer.mutateAsync(bankTransferPayment);
          break;
        }

        case "mobile_money": {
          const mobileMoneyPayment: MobileMoneyCreate = {
            ...basePayment,
            payment_method: "mobile_money",
            mobile_provider: mobileMoneyData.provider,
            mobile_number: mobileMoneyData.sender_phone,
            external_reference: mobileMoneyData.transaction_id
              ? mobileMoneyData.transaction_id
              : null,
          };
          await recordMobileMoney.mutateAsync(mobileMoneyPayment);
          break;
        }
      }

      onSuccess?.();
      resetForm();
    } catch (error) {
      // Error handled by hooks
    }
  };

  const resetForm = () => {
    setCommonData({
      customer_id: "",
      invoice_id: "",
      amount: "",
      currency: "USD",
      payment_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setCashData({
      cash_register_id: "",
      denomination_breakdown: "",
      cashier_name: "",
    });
    setCheckData({
      check_number: "",
      bank_name: "",
      check_date: new Date().toISOString().slice(0, 10),
    });
    setBankTransferData({
      bank_account_id: "",
      sender_account_name: "",
      sender_account_number: "",
      sender_bank_name: "",
      transaction_reference: "",
    });
    setMobileMoneyData({ provider: "", sender_phone: "", transaction_id: "" });
    setReceiptFile(null);
  };

  const isPending =
    recordCash.isPending ||
    recordCheck.isPending ||
    recordBankTransfer.isPending ||
    recordMobileMoney.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Manual Payment</DialogTitle>
          <DialogDescription>
            Record a payment received outside of automated payment systems
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method *</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <SelectTrigger id="paymentMethod">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Common Fields */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Payment Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Customer ID *</Label>
                <Input
                  id="customer_id"
                  type="number"
                  value={commonData.customer_id}
                  onChange={(e) =>
                    setCommonData({
                      ...commonData,
                      customer_id: e.target.value,
                    })
                  }
                  required
                  placeholder="12345"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_id">Invoice ID (optional)</Label>
                <Input
                  id="invoice_id"
                  type="number"
                  value={commonData.invoice_id}
                  onChange={(e) => setCommonData({ ...commonData, invoice_id: e.target.value })}
                  placeholder="67890"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={commonData.amount}
                  onChange={(e) => setCommonData({ ...commonData, amount: e.target.value })}
                  required
                  placeholder="100.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Input
                  id="currency"
                  value={commonData.currency}
                  onChange={(e) =>
                    setCommonData({
                      ...commonData,
                      currency: e.target.value.toUpperCase(),
                    })
                  }
                  required
                  maxLength={3}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={commonData.payment_date}
                onChange={(e) => setCommonData({ ...commonData, payment_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={commonData.notes}
                onChange={(e) => setCommonData({ ...commonData, notes: e.target.value })}
                placeholder="Add any additional information about this payment..."
                rows={3}
              />
            </div>
          </div>

          {/* Method-Specific Fields */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">
              {paymentMethod === "cash" && "Cash Payment Details"}
              {paymentMethod === "check" && "Check Details"}
              {paymentMethod === "bank_transfer" && "Bank Transfer Details"}
              {paymentMethod === "mobile_money" && "Mobile Money Details"}
            </h3>

            {paymentMethod === "cash" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cash_register_id">Cash Register ID (optional)</Label>
                  <Input
                    id="cash_register_id"
                    type="number"
                    value={cashData.cash_register_id}
                    onChange={(e) =>
                      setCashData({
                        ...cashData,
                        cash_register_id: e.target.value,
                      })
                    }
                    placeholder="123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="denomination_breakdown">
                    Denomination Breakdown (optional, JSON)
                  </Label>
                  <Textarea
                    id="denomination_breakdown"
                    value={cashData.denomination_breakdown}
                    onChange={(e) =>
                      setCashData({
                        ...cashData,
                        denomination_breakdown: e.target.value,
                      })
                    }
                    placeholder='{"100": 5, "50": 2, "20": 10}'
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter as JSON object with denomination as key and count as value
                  </p>
                </div>
              </>
            )}

            {paymentMethod === "check" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="check_number">Check Number *</Label>
                  <Input
                    id="check_number"
                    value={checkData.check_number}
                    onChange={(e) =>
                      setCheckData({
                        ...checkData,
                        check_number: e.target.value,
                      })
                    }
                    required
                    placeholder="1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="check_bank_name">Bank Name *</Label>
                  <Input
                    id="check_bank_name"
                    value={checkData.bank_name}
                    onChange={(e) => setCheckData({ ...checkData, bank_name: e.target.value })}
                    required
                    placeholder="First National Bank"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="check_date">Check Date *</Label>
                  <Input
                    id="check_date"
                    type="date"
                    value={checkData.check_date}
                    onChange={(e) => setCheckData({ ...checkData, check_date: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            {paymentMethod === "bank_transfer" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_id">Receiving Bank Account *</Label>
                  <Select
                    value={bankTransferData.bank_account_id}
                    onValueChange={(value) =>
                      setBankTransferData({
                        ...bankTransferData,
                        bank_account_id: value,
                      })
                    }
                  >
                    <SelectTrigger id="bank_account_id">
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.account_nickname || account.account_name} (****
                          {account.account_number_last_four})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender_account_name">Sender Account Name *</Label>
                  <Input
                    id="sender_account_name"
                    value={bankTransferData.sender_account_name}
                    onChange={(e) =>
                      setBankTransferData({
                        ...bankTransferData,
                        sender_account_name: e.target.value,
                      })
                    }
                    required
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender_account_number">Sender Account Number (optional)</Label>
                  <Input
                    id="sender_account_number"
                    value={bankTransferData.sender_account_number}
                    onChange={(e) =>
                      setBankTransferData({
                        ...bankTransferData,
                        sender_account_number: e.target.value,
                      })
                    }
                    placeholder="1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender_bank_name">Sender Bank Name (optional)</Label>
                  <Input
                    id="sender_bank_name"
                    value={bankTransferData.sender_bank_name}
                    onChange={(e) =>
                      setBankTransferData({
                        ...bankTransferData,
                        sender_bank_name: e.target.value,
                      })
                    }
                    placeholder="Second National Bank"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction_reference">Transaction Reference (optional)</Label>
                  <Input
                    id="transaction_reference"
                    value={bankTransferData.transaction_reference}
                    onChange={(e) =>
                      setBankTransferData({
                        ...bankTransferData,
                        transaction_reference: e.target.value,
                      })
                    }
                    placeholder="TXN123456789"
                  />
                </div>
              </>
            )}

            {paymentMethod === "mobile_money" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider">Mobile Money Provider *</Label>
                  <Input
                    id="provider"
                    value={mobileMoneyData.provider}
                    onChange={(e) =>
                      setMobileMoneyData({
                        ...mobileMoneyData,
                        provider: e.target.value,
                      })
                    }
                    required
                    placeholder="M-Pesa, MTN Mobile Money, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender_phone">Sender Phone Number *</Label>
                  <Input
                    id="sender_phone"
                    type="tel"
                    value={mobileMoneyData.sender_phone}
                    onChange={(e) =>
                      setMobileMoneyData({
                        ...mobileMoneyData,
                        sender_phone: e.target.value,
                      })
                    }
                    required
                    placeholder="+1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction_id">Transaction ID *</Label>
                  <Input
                    id="transaction_id"
                    value={mobileMoneyData.transaction_id}
                    onChange={(e) =>
                      setMobileMoneyData({
                        ...mobileMoneyData,
                        transaction_id: e.target.value,
                      })
                    }
                    required
                    placeholder="MM123456789"
                  />
                </div>
              </>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Receipt / Proof of Payment (optional)</h3>

            {receiptFile ? (
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <span className="text-sm flex-1">{receiptFile.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
                </div>
              </div>
            )}
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
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
