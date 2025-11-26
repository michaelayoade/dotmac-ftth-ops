/**
 * Bank Accounts Service
 * Handles API calls for bank account and manual payment management
 */

import { platformConfig } from "../config";

// ============================================
// Types matching backend models
// ============================================

export type BankAccountStatus = "pending" | "verified" | "failed" | "suspended";
export type AccountType = "checking" | "savings" | "business" | "money_market";
export type PaymentMethodType =
  | "bank_transfer"
  | "wire_transfer"
  | "ach"
  | "cash"
  | "check"
  | "money_order"
  | "mobile_money"
  | "crypto"
  | "other";

export interface CompanyBankAccountCreate {
  account_name: string;
  account_nickname?: string | null;
  bank_name: string;
  bank_address?: string | null;
  bank_country: string; // ISO 2-letter code
  account_type: AccountType;
  currency: string; // 3-letter code
  account_number: string;
  routing_number?: string | null;
  swift_code?: string | null;
  iban?: string | null;
  is_primary?: boolean;
  accepts_deposits?: boolean;
  notes?: string | null;
}

export interface CompanyBankAccountUpdate {
  account_nickname?: string | null;
  bank_address?: string | null;
  is_primary?: boolean | null;
  accepts_deposits?: boolean | null;
  notes?: string | null;
}

export interface CompanyBankAccountResponse {
  id: number;
  account_name: string;
  account_nickname: string | null;
  bank_name: string;
  bank_address: string | null;
  bank_country: string;
  account_number_last_four: string;
  account_type: AccountType;
  currency: string;
  routing_number: string | null;
  swift_code: string | null;
  iban: string | null;
  status: BankAccountStatus;
  is_primary: boolean;
  is_active: boolean;
  accepts_deposits: boolean;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  metadata: Record<string, any>;
}

export interface BankAccountSummary {
  account: CompanyBankAccountResponse;
  total_deposits_mtd: number;
  total_deposits_ytd: number;
  pending_payments: number;
  last_reconciliation: string | null;
  current_balance: number | null;
}

export interface ManualPaymentBase {
  customer_id: string;
  invoice_id?: string | null;
  bank_account_id?: number | null;
  payment_method: PaymentMethodType;
  amount: number;
  currency?: string;
  payment_date: string; // ISO datetime
  received_date?: string | null;
  external_reference?: string | null;
  notes?: string | null;
}

export interface CashPaymentCreate extends ManualPaymentBase {
  payment_method: "cash";
  cash_register_id?: string | null;
  cashier_name?: string | null;
}

export interface CheckPaymentCreate extends ManualPaymentBase {
  payment_method: "check";
  check_number: string;
  check_bank_name?: string | null;
}

export interface BankTransferCreate extends ManualPaymentBase {
  payment_method: "bank_transfer";
  sender_name?: string | null;
  sender_bank?: string | null;
  sender_account_last_four?: string | null;
}

export interface MobileMoneyCreate extends ManualPaymentBase {
  payment_method: "mobile_money";
  mobile_number: string;
  mobile_provider: string;
}

export interface ManualPaymentResponse {
  id: number;
  payment_reference: string;
  external_reference: string | null;
  customer_id: string;
  invoice_id: string | null;
  bank_account_id: number | null;
  payment_method: PaymentMethodType;
  amount: number;
  currency: string;
  payment_date: string;
  received_date: string | null;
  cleared_date: string | null;
  cash_register_id: string | null;
  cashier_name: string | null;
  check_number: string | null;
  check_bank_name: string | null;
  sender_name: string | null;
  sender_bank: string | null;
  sender_account_last_four: string | null;
  mobile_number: string | null;
  mobile_provider: string | null;
  status: string;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  notes: string | null;
  receipt_url: string | null;
  attachments: string[];
  recorded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface PaymentSearchFilters {
  customer_id?: string | null;
  invoice_id?: string | null;
  payment_method?: PaymentMethodType | null;
  status?: string | null;
  payment_status?: string | null;
  search?: string | null;
  reconciled?: boolean | null;
  date_from?: string | null;
  date_to?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
}

export interface ReconcilePaymentRequest {
  payment_ids: number[];
  reconciliation_notes?: string | null;
}

// ============================================
// Service Class
// ============================================

class BankAccountsService {
  private buildUrl(path: string): string {
    const builder = platformConfig.api?.buildUrl;
    if (builder) {
      return builder(path);
    }

    const baseUrl = platformConfig.api?.baseUrl ?? "";
    const prefix = platformConfig.api?.prefix ?? "";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPrefix = prefix
      ? prefix.startsWith("/")
        ? prefix.replace(/\/$/, "")
        : `/${prefix.replace(/\/$/, "")}`
      : "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${normalizedBase}${normalizedPrefix}${normalizedPath}` || normalizedPath;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // ==================== Bank Accounts ====================

  async createBankAccount(data: CompanyBankAccountCreate): Promise<CompanyBankAccountResponse> {
    const response = await fetch(this.buildUrl("/billing/bank-accounts"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to create bank account");
    }

    return response.json();
  }

  async listBankAccounts(includeInactive: boolean = false): Promise<CompanyBankAccountResponse[]> {
    const params = new URLSearchParams();
    if (includeInactive) params.append("include_inactive", "true");

    const response = await fetch(this.buildUrl(`/billing/bank-accounts?${params.toString()}`), {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to list bank accounts");
    }

    return response.json();
  }

  async getBankAccount(accountId: number): Promise<CompanyBankAccountResponse> {
    const response = await fetch(this.buildUrl(`/billing/bank-accounts/${accountId}`), {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get bank account");
    }

    return response.json();
  }

  async getBankAccountSummary(accountId: number): Promise<BankAccountSummary> {
    const response = await fetch(this.buildUrl(`/billing/bank-accounts/${accountId}/summary`), {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to get bank account summary");
    }

    return response.json();
  }

  async updateBankAccount(
    accountId: number,
    data: CompanyBankAccountUpdate,
  ): Promise<CompanyBankAccountResponse> {
    const response = await fetch(this.buildUrl(`/billing/bank-accounts/${accountId}`), {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to update bank account");
    }

    return response.json();
  }

  async verifyBankAccount(accountId: number, notes?: string): Promise<CompanyBankAccountResponse> {
    const params = new URLSearchParams();
    if (notes) params.append("notes", notes);

    const response = await fetch(
      this.buildUrl(`/billing/bank-accounts/${accountId}/verify?${params.toString()}`),
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to verify bank account");
    }

    return response.json();
  }

  async deactivateBankAccount(accountId: number): Promise<CompanyBankAccountResponse> {
    const response = await fetch(this.buildUrl(`/billing/bank-accounts/${accountId}`), {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to deactivate bank account");
    }

    return response.json();
  }

  // ==================== Manual Payments ====================

  async recordCashPayment(data: CashPaymentCreate): Promise<ManualPaymentResponse> {
    const response = await fetch(this.buildUrl("/billing/payments/cash"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to record cash payment");
    }

    return response.json();
  }

  async recordCheckPayment(data: CheckPaymentCreate): Promise<ManualPaymentResponse> {
    const response = await fetch(this.buildUrl("/billing/payments/check"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to record check payment");
    }

    return response.json();
  }

  async recordBankTransfer(data: BankTransferCreate): Promise<ManualPaymentResponse> {
    const response = await fetch(this.buildUrl("/billing/payments/bank-transfer"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to record bank transfer");
    }

    return response.json();
  }

  async recordMobileMoney(data: MobileMoneyCreate): Promise<ManualPaymentResponse> {
    const response = await fetch(this.buildUrl("/billing/payments/mobile-money"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to record mobile money payment");
    }

    return response.json();
  }

  async searchPayments(
    filters: PaymentSearchFilters,
    limit: number = 100,
    offset: number = 0,
  ): Promise<ManualPaymentResponse[]> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.max(0, limit)));
    params.set("offset", String(Math.max(0, offset)));

    const response = await fetch(this.buildUrl(`/billing/payments/search?${params.toString()}`), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to search payments");
    }

    return response.json();
  }

  async verifyPayment(paymentId: number, notes?: string): Promise<ManualPaymentResponse> {
    const params = new URLSearchParams();
    if (notes) params.append("notes", notes);

    const response = await fetch(
      this.buildUrl(`/billing/payments/${paymentId}/verify?${params.toString()}`),
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to verify payment");
    }

    return response.json();
  }

  async reconcilePayments(request: ReconcilePaymentRequest): Promise<ManualPaymentResponse[]> {
    const response = await fetch(this.buildUrl("/billing/payments/reconcile"), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to reconcile payments");
    }

    return response.json();
  }

  async uploadPaymentAttachment(paymentId: number, file: File): Promise<any> {
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(this.buildUrl(`/billing/payments/${paymentId}/attachments`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to upload attachment");
    }

    return response.json();
  }
}

export const bankAccountsService = new BankAccountsService();
