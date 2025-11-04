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
