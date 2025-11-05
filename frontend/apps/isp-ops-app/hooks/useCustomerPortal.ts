"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createPortalAuthFetch,
  CUSTOMER_PORTAL_TOKEN_KEY,
  PortalAuthError,
} from "../../../shared/utils/operatorAuth";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;
const customerPortalFetch = createPortalAuthFetch(CUSTOMER_PORTAL_TOKEN_KEY);

// ============================================================================
// Types
// ============================================================================

export interface CustomerProfile {
  id: string;
  customer_id: string;
  account_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service_address: string;
  service_city: string;
  service_state: string;
  service_zip: string;
  status: "active" | "suspended" | "cancelled";
}

export interface CustomerService {
  id: string;
  plan_name: string;
  plan_id: string;
  speed_down: string;
  speed_up: string;
  monthly_price: number;
  installation_date: string;
  billing_cycle: string;
  next_billing_date: string;
  status: "active" | "suspended" | "cancelled";
}

export interface CustomerInvoice {
  invoice_id: string;
  invoice_number: string;
  amount: number;
  amount_due: number;
  amount_paid: number;
  status: "draft" | "finalized" | "paid" | "void" | "uncollectible";
  due_date: string;
  paid_date?: string;
  created_at: string;
  description: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface CustomerPayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  invoice_number: string;
  status: "success" | "pending" | "failed";
}

export interface CustomerUsage {
  upload_gb: number;
  download_gb: number;
  total_gb: number;
  limit_gb: number;
  period_start: string;
  period_end: string;
}

export interface CustomerTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// useCustomerProfile Hook
// ============================================================================

export function useCustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/profile`);

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<CustomerProfile>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/profile`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const data = await response.json();
      setProfile(data);
      return data;
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error updating customer profile:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
}

// ============================================================================
// useCustomerService Hook
// ============================================================================

export function useCustomerService() {
  const [service, setService] = useState<CustomerService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchService = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/service`);

      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }

      const data = await response.json();
      setService(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer service:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const upgradePlan = useCallback(async (planId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/service/upgrade`, {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      });

      if (!response.ok) {
        throw new Error("Failed to upgrade plan");
      }

      const data = await response.json();
      setService(data);
      return data;
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error upgrading plan:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  return {
    service,
    loading,
    error,
    refetch: fetchService,
    upgradePlan,
  };
}

// ============================================================================
// useCustomerInvoices Hook
// ============================================================================

export function useCustomerInvoices() {
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/invoices`);

      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      const data = await response.json();
      setInvoices(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer invoices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
  };
}

// ============================================================================
// useCustomerPayments Hook
// ============================================================================

export function useCustomerPayments() {
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/payments`);

      if (!response.ok) {
        throw new Error("Failed to fetch payments");
      }

      const data = await response.json();
      setPayments(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer payments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const makePayment = useCallback(
    async (invoiceId: string, amount: number, paymentMethodId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/payments`, {
          method: "POST",
          body: JSON.stringify({
            invoice_id: invoiceId,
            amount,
            payment_method_id: paymentMethodId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to process payment");
        }

        const data = await response.json();
        await fetchPayments(); // Refresh payments list
        return data;
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error making payment:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPayments],
  );

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return {
    payments,
    loading,
    error,
    refetch: fetchPayments,
    makePayment,
  };
}

// ============================================================================
// useCustomerUsage Hook
// ============================================================================

export function useCustomerUsage() {
  const [usage, setUsage] = useState<CustomerUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/usage`);

      if (!response.ok) {
        throw new Error("Failed to fetch usage");
      }

      const data = await response.json();
      setUsage(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer usage:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
  };
}

// ============================================================================
// useCustomerTickets Hook
// ============================================================================

export function useCustomerTickets() {
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/tickets`);

      if (!response.ok) {
        throw new Error("Failed to fetch tickets");
      }

      const data = await response.json();
      setTickets(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTicket = useCallback(
    async (ticketData: {
      subject: string;
      description: string;
      category: string;
      priority: string;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/tickets`, {
          method: "POST",
          body: JSON.stringify(ticketData),
        });

        if (!response.ok) {
          throw new Error("Failed to create ticket");
        }

        const data = await response.json();
        await fetchTickets(); // Refresh tickets list
        return data;
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error creating ticket:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchTickets],
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
    createTicket,
  };
}

// ============================================================================
// useCustomerSettings Hook
// ============================================================================

export function useCustomerSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/settings`);

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/settings`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      const data = await response.json();
      setSettings(data);
      return data;
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error updating customer settings:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/change-password`, {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to change password");
      }

      return await response.json();
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error changing password:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateSettings,
    changePassword,
  };
}

// ============================================================================
// useCustomerPaymentMethods Hook
// ============================================================================

export interface CustomerPaymentMethod {
  payment_method_id: string;
  method_type: "card" | "bank_account" | "wallet" | "wire_transfer" | "check";
  status: "active" | "pending_verification" | "verification_failed" | "expired" | "inactive";
  is_default: boolean;
  auto_pay_enabled?: boolean;

  // Card details
  card_brand?:
    | "visa"
    | "mastercard"
    | "amex"
    | "discover"
    | "diners"
    | "jcb"
    | "unionpay"
    | "unknown";
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;

  // Bank account details
  bank_name?: string;
  bank_account_last4?: string;
  bank_account_type?: string;

  // Wallet details
  wallet_type?: string;

  // Billing details
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country: string;

  // Verification
  is_verified: boolean;

  // Timestamps
  created_at: string;
  expires_at?: string;
}

export interface AddPaymentMethodRequest {
  method_type: "card" | "bank_account" | "wallet";
  card_token?: string;
  bank_token?: string;
  bank_account_token?: string;
  wallet_token?: string;
  bank_name?: string;
  bank_account_type?: string;
  billing_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;
  set_as_default?: boolean;
}

export function useCustomerPaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/payment-methods`);

      if (!response.ok) {
        throw new Error("Failed to fetch payment methods");
      }

      const data = await response.json();
      setPaymentMethods(data);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : "An error occurred";
      setError(message);
      console.error("Error fetching customer payment methods:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addPaymentMethod = useCallback(
    async (request: AddPaymentMethodRequest) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(`${API_BASE}/api/v1/customer/payment-methods`, {
          method: "POST",
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error("Failed to add payment method");
        }

        const data = await response.json();
        await fetchPaymentMethods();
        return data;
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error adding payment method:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  const setDefaultPaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(
          `${API_BASE}/api/v1/customer/payment-methods/${paymentMethodId}/set-default`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to set default payment method");
        }

        const data = await response.json();
        await fetchPaymentMethods();
        return data;
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error setting default payment method:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  const removePaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(
          `${API_BASE}/api/v1/customer/payment-methods/${paymentMethodId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to remove payment method");
        }

        await fetchPaymentMethods();
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error removing payment method:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  const toggleAutoPay = useCallback(
    async (paymentMethodId: string, enabled: boolean) => {
      try {
        setLoading(true);
        setError(null);

        const response = await customerPortalFetch(
          `${API_BASE}/api/v1/customer/payment-methods/${paymentMethodId}/auto-pay`,
          {
            method: "POST",
            body: JSON.stringify({ enabled }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to toggle auto-pay");
        }

        const data = await response.json();
        await fetchPaymentMethods();
        return data;
      } catch (err) {
        const message =
          err instanceof PortalAuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An error occurred";
        setError(message);
        console.error("Error toggling auto-pay:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPaymentMethods],
  );

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.is_default);
  const autoPayPaymentMethod = paymentMethods.find((pm) => pm.auto_pay_enabled);

  return {
    paymentMethods,
    defaultPaymentMethod,
    autoPayPaymentMethod,
    loading,
    error,
    refetch: fetchPaymentMethods,
    addPaymentMethod,
    setDefaultPaymentMethod,
    removePaymentMethod,
    toggleAutoPay,
  };
}
