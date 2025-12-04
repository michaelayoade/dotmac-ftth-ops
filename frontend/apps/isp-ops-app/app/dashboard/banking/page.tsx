"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Banknote,
  Receipt,
  Smartphone,
  Link,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Eye,
  EyeOff,
  Shield,
  FileText,
  CheckSquare,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

// Types
interface BankAccount {
  id: number;
  account_name: string;
  account_nickname: string | null;
  bank_name: string;
  bank_country: string;
  account_number_last_four: string;
  account_type: "checking" | "savings" | "business" | "money_market";
  currency: string;
  routing_number: string | null;
  swift_code: string | null;
  iban: string | null;
  status: "pending" | "verified" | "failed" | "suspended";
  is_primary: boolean;
  is_active: boolean;
  accepts_deposits: boolean;
  verified_at: string | null;
  created_at: string;
}

interface ManualPayment {
  id: number;
  payment_reference: string;
  customer_id: string;
  customer_name?: string;
  invoice_id: string | null;
  payment_method: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: string;
  reconciled: boolean;
  notes: string | null;
}

interface BankAccountSummary {
  account: BankAccount;
  total_deposits_mtd: number;
  total_deposits_ytd: number;
  pending_payments: number;
  last_reconciliation: string | null;
}

const tabs = [
  { id: "accounts", label: "Bank Accounts", icon: Building2 },
  { id: "payments", label: "Manual Payments", icon: Receipt },
  { id: "reconciliation", label: "Reconciliation", icon: CheckSquare },
];

const paymentMethods = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: FileText },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "wire_transfer", label: "Wire Transfer", icon: Link },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
];

export default function BankingPage() {
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;
  const [activeTab, setActiveTab] = useState("accounts");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccountSummary | null>(null);
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [showAccountNumber, setShowAccountNumber] = useState<number | null>(null);

  // Form states
  const [accountForm, setAccountForm] = useState({
    account_name: "",
    account_nickname: "",
    bank_name: "",
    bank_address: "",
    bank_country: "US",
    account_number: "",
    account_type: "business",
    currency: "USD",
    routing_number: "",
    swift_code: "",
    iban: "",
    is_primary: false,
    accepts_deposits: true,
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    customer_id: "",
    invoice_id: "",
    bank_account_id: null as number | null,
    amount: 0,
    currency: "USD",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
    // Method-specific fields
    cash_register_id: "",
    cashier_name: "",
    check_number: "",
    check_bank_name: "",
    sender_name: "",
    sender_bank: "",
    sender_account_last_four: "",
    mobile_number: "",
    mobile_provider: "",
  });

  const loadBankAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/bank-accounts`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data);
      } else if (response.status === 401) {
        window.location.href = "/login";
      }
    } catch (error) {
      logger.error("Failed to load bank accounts", error);
      toast({
        title: "Error",
        description: "Failed to load bank accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, toast]);

  const loadAccountSummary = useCallback(
    async (accountId: number) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/billing/bank-accounts/${accountId}/summary`,
          {
            credentials: "include",
          },
        );

        if (response.ok) {
          const data = await response.json();
          setSelectedAccount(data);
        } else if (response.status === 401) {
          window.location.href = "/login";
        }
      } catch (error) {
        logger.error("Failed to load account summary", error);
        toast({
          title: "Error",
          description: "Failed to load account summary",
          variant: "destructive",
        });
      }
    },
    [apiBaseUrl, toast],
  );

  const loadManualPayments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/payments/search`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        setManualPayments(data);
      } else if (response.status === 401) {
        window.location.href = "/login";
      }
    } catch (error) {
      logger.error("Failed to load manual payments", error);
      toast({
        title: "Error",
        description: "Failed to load manual payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, toast]);

  useEffect(() => {
    if (activeTab === "accounts") {
      loadBankAccounts();
    } else if (activeTab === "payments") {
      loadManualPayments();
    }
  }, [activeTab, loadBankAccounts, loadManualPayments]);

  const handleCreateAccount = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/bank-accounts`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountForm),
      });

      if (response.ok) {
        logger.info("Bank account created", {
          bankName: accountForm.bank_name,
          accountType: accountForm.account_type,
        });
        await loadBankAccounts();
        setShowAddAccount(false);
        resetAccountForm();
        toast({
          title: "Success",
          description: "Bank account added successfully",
        });
      }
    } catch (error) {
      logger.error("Failed to create bank account", error);
      toast({
        title: "Error",
        description: "Failed to create bank account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRecordPayment = async () => {
    try {
      const endpoint = `${apiBaseUrl}/api/v1/billing/payments/${selectedPaymentMethod.replace("_", "-")}`;

      const paymentData = {
        ...paymentForm,
        payment_method: selectedPaymentMethod,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      if (response.ok) {
        logger.info("Manual payment recorded", {
          paymentMethod: selectedPaymentMethod,
          amount: paymentForm.amount,
          customerId: paymentForm.customer_id,
        });
        await loadManualPayments();
        setShowRecordPayment(false);
        resetPaymentForm();
        toast({
          title: "Success",
          description: "Payment recorded successfully",
        });
      }
    } catch (error) {
      logger.error("Failed to record payment", error);
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyAccount = async (accountId: number) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/bank-accounts/${accountId}/verify`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: "Verified via admin panel" }),
        },
      );

      if (response.ok) {
        logger.info("Bank account verified", { accountId });
        await loadBankAccounts();
        toast({
          title: "Success",
          description: "Bank account verified successfully",
        });
      }
    } catch (error) {
      logger.error("Failed to verify account", error);
      toast({
        title: "Error",
        description: "Failed to verify bank account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyPayment = async (paymentId: number) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/payments/${paymentId}/verify`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        logger.info("Payment verified", { paymentId });
        await loadManualPayments();
        toast({
          title: "Success",
          description: "Payment verified successfully",
        });
      }
    } catch (error) {
      logger.error("Failed to verify payment", error);
      toast({
        title: "Error",
        description: "Failed to verify payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetAccountForm = () => {
    setAccountForm({
      account_name: "",
      account_nickname: "",
      bank_name: "",
      bank_address: "",
      bank_country: "US",
      account_number: "",
      account_type: "business",
      currency: "USD",
      routing_number: "",
      swift_code: "",
      iban: "",
      is_primary: false,
      accepts_deposits: true,
      notes: "",
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      customer_id: "",
      invoice_id: "",
      bank_account_id: null,
      amount: 0,
      currency: "USD",
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
      cash_register_id: "",
      cashier_name: "",
      check_number: "",
      check_bank_name: "",
      sender_name: "",
      sender_bank: "",
      sender_account_last_four: "",
      mobile_number: "",
      mobile_provider: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      verified: "bg-emerald-500/10 text-emerald-400",
      pending: "bg-amber-500/10 text-amber-400",
      failed: "bg-rose-500/10 text-rose-400",
      suspended: "bg-muted/10 text-muted-foreground",
      reconciled: "bg-sky-500/10 text-sky-400",
    };

    const icons = {
      verified: <CheckCircle className="h-3 w-3" />,
      pending: <Clock className="h-3 w-3" />,
      failed: <XCircle className="h-3 w-3" />,
      suspended: <AlertCircle className="h-3 w-3" />,
      reconciled: <CheckSquare className="h-3 w-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${styles[status as keyof typeof styles] || styles.pending}`}
      >
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  const renderBankAccounts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Company Bank Accounts</h3>
        <button
          onClick={() => setShowAddAccount(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Bank Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : bankAccounts.length === 0 ? (
        <div className="text-center py-12 bg-accent/50 rounded-lg border border-border">
          <Building2 className="h-12 w-12 text-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No bank accounts configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your company bank accounts to receive payments
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bankAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-accent/50 border border-border rounded-lg p-4 hover:bg-accent/70 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-medium text-foreground">
                      {account.account_nickname || account.account_name}
                    </h4>
                    {account.is_primary && (
                      <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full">
                        Primary
                      </span>
                    )}
                    {getStatusBadge(account.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Bank</div>
                      <div className="text-muted-foreground">{account.bank_name}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Account</div>
                      <div className="text-muted-foreground font-mono flex items-center gap-2">
                        {showAccountNumber === account["id"] ? (
                          <>
                            ****{account.account_number_last_four}
                            <button onClick={() => setShowAccountNumber(null)}>
                              <EyeOff className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </>
                        ) : (
                          <>
                            ••••{account.account_number_last_four}
                            <button onClick={() => setShowAccountNumber(account.id)}>
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Type</div>
                      <div className="text-muted-foreground capitalize">{account.account_type}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Currency</div>
                      <div className="text-muted-foreground">{account.currency}</div>
                    </div>
                  </div>

                  {account.routing_number && (
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                      <span>Routing: {account.routing_number}</span>
                      {account.swift_code && <span>SWIFT: {account.swift_code}</span>}
                      {account.iban && <span>IBAN: {account.iban}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {account.status === "pending" && (
                    <button
                      onClick={() => handleVerifyAccount(account.id)}
                      className="px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20"
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => loadAccountSummary(account.id)}
                    className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-accent"
                  >
                    View Details
                  </button>
                  <button className="text-muted-foreground hover:text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAccount && (
        <div className="mt-6 p-4 bg-card/50 border border-border rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-4">Account Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Month-to-Date</div>
              <div className="text-lg font-semibold text-foreground">
                ${selectedAccount.total_deposits_mtd.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Year-to-Date</div>
              <div className="text-lg font-semibold text-foreground">
                ${selectedAccount.total_deposits_ytd.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending Payments</div>
              <div className="text-lg font-semibold text-amber-400">
                {selectedAccount.pending_payments}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last Reconciled</div>
              <div className="text-sm text-muted-foreground">
                {selectedAccount.last_reconciliation
                  ? new Date(selectedAccount.last_reconciliation).toLocaleDateString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderManualPayments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Manual Payment Records</h3>
        <button
          onClick={() => setShowRecordPayment(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search payments..."
            className="w-full pl-10 pr-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <button className="px-4 py-2 bg-accent border border-border text-muted-foreground rounded-lg hover:bg-muted flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <button className="px-4 py-2 bg-accent border border-border text-muted-foreground rounded-lg hover:bg-muted flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
      ) : manualPayments.length === 0 ? (
        <div className="text-center py-12 bg-accent/50 rounded-lg border border-border">
          <Receipt className="h-12 w-12 text-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No manual payments recorded</p>
          <p className="text-sm text-muted-foreground mt-1">
            Record cash, check, and other manual payments here
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4">Reference</th>
                <th className="text-left py-3 px-4">Customer</th>
                <th className="text-left py-3 px-4">Method</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {manualPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-accent/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono text-sm text-muted-foreground">
                      {payment.payment_reference}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted-foreground">
                      {payment.customer_name || payment.customer_id}
                    </div>
                    {payment.invoice_id && (
                      <div className="text-xs text-muted-foreground">
                        Invoice: {payment.invoice_id}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {payment.payment_method === "cash" && <Banknote className="h-4 w-4" />}
                      {payment.payment_method === "check" && <FileText className="h-4 w-4" />}
                      {payment.payment_method === "bank_transfer" && (
                        <Building2 className="h-4 w-4" />
                      )}
                      {payment.payment_method === "mobile_money" && (
                        <Smartphone className="h-4 w-4" />
                      )}
                      <span className="capitalize">{payment.payment_method.replace("_", " ")}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-foreground">
                      {payment.currency} {payment.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted-foreground">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(payment.status)}
                      {payment.reconciled && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckSquare className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {payment.status === "pending" && (
                        <button
                          onClick={() => handleVerifyPayment(payment.id)}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button className="text-muted-foreground hover:text-muted-foreground">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderReconciliation = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Payment Reconciliation</h3>
        <button className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors">
          Start Reconciliation
        </button>
      </div>

      <div className="bg-accent/50 border border-border rounded-lg p-6">
        <div className="text-center">
          <CheckSquare className="h-12 w-12 text-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Reconciliation helps match payments with bank statements
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Upload bank statements or manually reconcile payments to ensure accurate records
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-accent flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Statement
            </button>
            <button className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent">
              Manual Reconciliation
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Banking & Payments</h1>
          <p className="text-muted-foreground mt-1">
            Manage bank accounts and record manual payments
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-colors text-sm font-medium ${
                  activeTab === tab["id"]
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          {activeTab === "accounts" && renderBankAccounts()}
          {activeTab === "payments" && renderManualPayments()}
          {activeTab === "reconciliation" && renderReconciliation()}
        </div>

        {/* Add Bank Account Modal */}
        {showAddAccount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-foreground mb-4">Add Bank Account</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={accountForm.account_name}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          account_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Company Name on Account"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Nickname
                    </label>
                    <input
                      type="text"
                      value={accountForm.account_nickname}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          account_nickname: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Main Operating Account"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={accountForm.bank_name}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          bank_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Chase Bank"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={accountForm.account_number}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          account_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Account Type
                    </label>
                    <select
                      value={accountForm.account_type}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          account_type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="business">Business</option>
                      <option value="money_market">Money Market</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Currency
                    </label>
                    <select
                      value={accountForm.currency}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          currency: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Country
                    </label>
                    <select
                      value={accountForm.bank_country}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          bank_country: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="EU">European Union</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={accountForm.routing_number}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          routing_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="021000021"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      SWIFT Code
                    </label>
                    <input
                      type="text"
                      value={accountForm.swift_code}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          swift_code: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="CHASUS33"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      IBAN
                    </label>
                    <input
                      type="text"
                      value={accountForm.iban}
                      onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="GB33BUKB20201555555555"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accountForm.is_primary}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          is_primary: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border bg-accent text-sky-500"
                    />
                    <span className="text-sm text-muted-foreground">Set as primary account</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accountForm.accepts_deposits}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          accepts_deposits: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border bg-accent text-sky-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      Accept deposits to this account
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={accountForm.notes}
                    onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    rows={3}
                    placeholder="Internal notes about this account"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddAccount(false);
                    resetAccountForm();
                  }}
                  className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAccount}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg"
                >
                  Add Bank Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {showRecordPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-foreground mb-4">Record Manual Payment</h3>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setSelectedPaymentMethod(method.value)}
                      className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                        selectedPaymentMethod === method.value
                          ? "border-sky-500 bg-sky-500/10 text-sky-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <method.icon className="h-5 w-5" />
                      <span className="text-xs">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Customer ID *
                    </label>
                    <input
                      type="text"
                      value={paymentForm.customer_id}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          customer_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="CUST-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Invoice ID
                    </label>
                    <input
                      type="text"
                      value={paymentForm.invoice_id}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          invoice_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="INV-001 (optional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Currency
                    </label>
                    <select
                      value={paymentForm.currency}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          currency: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          payment_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Method-specific fields */}
                {selectedPaymentMethod === "cash" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Register ID
                      </label>
                      <input
                        type="text"
                        value={paymentForm.cash_register_id}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            cash_register_id: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="REG-001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Cashier Name
                      </label>
                      <input
                        type="text"
                        value={paymentForm.cashier_name}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            cashier_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "check" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Check Number *
                      </label>
                      <input
                        type="text"
                        value={paymentForm.check_number}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            check_number: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="1234"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={paymentForm.check_bank_name}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            check_bank_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="Wells Fargo"
                      />
                    </div>
                  </div>
                )}

                {(selectedPaymentMethod === "bank_transfer" ||
                  selectedPaymentMethod === "wire_transfer") && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={paymentForm.sender_name}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            sender_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="Company Name / Individual"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Sender Bank
                        </label>
                        <input
                          type="text"
                          value={paymentForm.sender_bank}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              sender_bank: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="Bank of America"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Account Last 4
                        </label>
                        <input
                          type="text"
                          value={paymentForm.sender_account_last_four}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              sender_account_last_four: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                          placeholder="1234"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "mobile_money" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Mobile Number *
                      </label>
                      <input
                        type="text"
                        value={paymentForm.mobile_number}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            mobile_number: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="+254700000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Provider *
                      </label>
                      <input
                        type="text"
                        value={paymentForm.mobile_provider}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            mobile_provider: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="M-Pesa"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Deposit To Account
                  </label>
                  <select
                    value={paymentForm.bank_account_id || ""}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        bank_account_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Select bank account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_nickname || account.account_name} - ••••
                        {account.account_number_last_four}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                    rows={3}
                    placeholder="Additional payment details or notes"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRecordPayment(false);
                    resetPaymentForm();
                  }}
                  className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
