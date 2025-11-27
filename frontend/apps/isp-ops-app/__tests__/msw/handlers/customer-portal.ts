/**
 * MSW Handlers for Customer Portal API
 * Mocks customer portal operations for customer self-service
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let profile: any = null;
let service: any = null;
let invoices: any[] = [];
let payments: any[] = [];
let usage: any = null;
let tickets: any[] = [];
let settings: any = null;
let paymentMethods: any[] = [];
let nextTicketId = 1;
let nextPaymentId = 1;
let nextPaymentMethodId = 1;

// Factory functions for mock data
function createMockProfile(data: Partial<any> = {}): any {
  return {
    id: data.id || "profile-1",
    customer_id: data.customer_id || "cust-1",
    account_number: data.account_number || "ACC-001",
    first_name: data.first_name || "John",
    last_name: data.last_name || "Doe",
    email: data.email || "john@example.com",
    phone: data.phone || "+1234567890",
    service_address: data.service_address || "123 Main St",
    service_city: data.service_city || "City",
    service_state: data.service_state || "State",
    service_zip: data.service_zip || "12345",
    status: data.status || "active",
    ...data,
  };
}

function createMockService(data: Partial<any> = {}): any {
  return {
    id: data.id || "service-1",
    plan_name: data.plan_name || "Basic Plan",
    plan_id: data.plan_id || "plan-1",
    speed_down: data.speed_down || "100 Mbps",
    speed_up: data.speed_up || "10 Mbps",
    monthly_price: data.monthly_price ?? 49.99,
    installation_date: data.installation_date || "2024-01-01",
    billing_cycle: data.billing_cycle || "monthly",
    next_billing_date: data.next_billing_date || "2024-02-01",
    status: data.status || "active",
    ...data,
  };
}

function createMockInvoice(data: Partial<any> = {}): any {
  return {
    invoice_id: data.invoice_id || `inv-${Date.now()}`,
    invoice_number:
      data.invoice_number || `INV-${String(Math.floor(Math.random() * 1000)).padStart(6, "0")}`,
    amount: data.amount ?? 49.99,
    amount_due: data.amount_due ?? data.amount ?? 49.99,
    amount_paid: data.amount_paid ?? 0,
    status: data.status || "finalized",
    due_date: data.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paid_date: data.paid_date,
    created_at: data.created_at || new Date().toISOString(),
    description: data.description || "Monthly service",
    line_items: data.line_items || [],
    ...data,
  };
}

function createMockPayment(data: Partial<any> = {}): any {
  return {
    id: data.id || `payment-${nextPaymentId++}`,
    amount: data.amount ?? 49.99,
    date: data.date || new Date().toISOString(),
    method: data.method || "card",
    invoice_number: data.invoice_number || "INV-001",
    status: data.status || "success",
    ...data,
  };
}

function createMockUsage(data: Partial<any> = {}): any {
  return {
    upload_gb: data.upload_gb ?? 50,
    download_gb: data.download_gb ?? 200,
    total_gb: data.total_gb ?? 250,
    limit_gb: data.limit_gb ?? 1000,
    period_start: data.period_start || "2024-01-01T00:00:00Z",
    period_end: data.period_end || "2024-01-31T23:59:59Z",
    ...data,
  };
}

function createMockTicket(data: Partial<any> = {}): any {
  const ticketId = data.id || `ticket-${nextTicketId++}`;
  return {
    id: ticketId,
    ticket_number: data.ticket_number || `T-${String(nextTicketId).padStart(5, "0")}`,
    subject: data.subject || "Support request",
    description: data.description || "Need assistance",
    status: data.status || "open",
    priority: data.priority || "normal",
    category: data.category || "general",
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    ...data,
  };
}

function createMockSettings(data: Partial<any> = {}): any {
  return {
    notifications_enabled: data.notifications_enabled ?? true,
    email_notifications: data.email_notifications ?? true,
    sms_notifications: data.sms_notifications ?? false,
    auto_pay_enabled: data.auto_pay_enabled ?? false,
    ...data,
  };
}

function createMockPaymentMethod(data: Partial<any> = {}): any {
  return {
    payment_method_id: data.payment_method_id || `pm-${nextPaymentMethodId++}`,
    method_type: data.method_type || "card",
    status: data.status || "active",
    is_default: data.is_default ?? false,
    card_brand: data.card_brand,
    card_last4: data.card_last4,
    card_exp_month: data.card_exp_month,
    card_exp_year: data.card_exp_year,
    bank_name: data.bank_name,
    bank_account_last4: data.bank_account_last4,
    bank_account_type: data.bank_account_type,
    wallet_type: data.wallet_type,
    billing_name: data.billing_name,
    billing_email: data.billing_email,
    billing_address_line1: data.billing_address_line1,
    billing_city: data.billing_city,
    billing_state: data.billing_state,
    billing_postal_code: data.billing_postal_code,
    is_verified: data.is_verified ?? true,
    created_at: data.created_at || new Date().toISOString(),
    auto_pay_enabled: data.auto_pay_enabled ?? false,
    ...data,
  };
}

// Seed functions
export function seedCustomerPortalProfile(data: any): void {
  profile = createMockProfile(data);
}

export function seedCustomerPortalService(data: any): void {
  service = createMockService(data);
}

export function seedCustomerPortalInvoices(data: any[]): void {
  invoices = data.map(createMockInvoice);
}

export function seedCustomerPortalPayments(data: any[]): void {
  payments = data.map(createMockPayment);
}

export function seedCustomerPortalUsage(data: any): void {
  usage = createMockUsage(data);
}

export function seedCustomerPortalTickets(data: any[]): void {
  tickets = data.map(createMockTicket);
  if (tickets.length > 0) {
    nextTicketId =
      tickets.reduce((max, t) => {
        const num = parseInt(t.id.replace("ticket-", ""));
        return isNaN(num) ? max : Math.max(max, num);
      }, 0) + 1;
  }
}

export function seedCustomerPortalSettings(data: any): void {
  settings = createMockSettings(data);
}

export function seedCustomerPortalPaymentMethods(data: any[]): void {
  paymentMethods = data.map(createMockPaymentMethod);
  if (paymentMethods.length > 0) {
    nextPaymentMethodId =
      paymentMethods.reduce((max, pm) => {
        const num = parseInt(pm.payment_method_id.replace("pm-", ""));
        return isNaN(num) ? max : Math.max(max, num);
      }, 0) + 1;
  }
}

export function clearCustomerPortalData(): void {
  profile = null;
  service = null;
  invoices = [];
  payments = [];
  usage = null;
  tickets = [];
  settings = null;
  paymentMethods = [];
  nextTicketId = 1;
  nextPaymentId = 1;
  nextPaymentMethodId = 1;
}

export const customerPortalHandlers = [
  // GET /customer/profile - Get customer profile
  http.get("*/api/v1/customer/profile", ({ request }) => {
    if (!profile) {
      profile = createMockProfile();
    }
    return HttpResponse.json(profile);
  }),

  // PUT /customer/profile - Update customer profile
  http.put("*/api/v1/customer/profile", async (req) => {
    const updates = await req.json<any>();
    profile = { ...profile, ...updates };
    return HttpResponse.json(profile);
  }),

  // GET /customer/service - Get customer service
  http.get("*/api/v1/customer/service", ({ request }) => {
    if (!service) {
      service = createMockService();
    }
    return HttpResponse.json(service);
  }),

  // POST /customer/service/upgrade - Upgrade plan
  http.post("*/api/v1/customer/service/upgrade", async (req) => {
    const { plan_id } = await req.json<any>();
    service = {
      ...service,
      plan_id,
      plan_name: `Upgraded Plan ${plan_id}`,
      speed_down: "500 Mbps",
      speed_up: "50 Mbps",
      monthly_price: 99.99,
    };
    return HttpResponse.json(service);
  }),

  // GET /customer/invoices - Get invoices
  http.get("*/api/v1/customer/invoices", ({ request }) => {
    return HttpResponse.json(invoices);
  }),

  // GET /customer/payments - Get payments
  http.get("*/api/v1/customer/payments", ({ request }) => {
    return HttpResponse.json(payments);
  }),

  // POST /customer/payments - Make payment
  http.post("*/api/v1/customer/payments", async (req) => {
    const data = await req.json<any>();
    const newPayment = createMockPayment({
      amount: data.amount,
      invoice_number: data.invoice_id,
      method: "card",
      status: "success",
    });
    payments.push(newPayment);
    return HttpResponse.json(newPayment);
  }),

  // GET /customer/usage - Get usage
  http.get("*/api/v1/customer/usage", ({ request }) => {
    if (!usage) {
      usage = createMockUsage();
    }
    return HttpResponse.json(usage);
  }),

  // GET /customer/tickets - Get tickets
  http.get("*/api/v1/customer/tickets", ({ request }) => {
    return HttpResponse.json(tickets);
  }),

  // POST /customer/tickets - Create ticket
  http.post("*/api/v1/customer/tickets", async (req) => {
    const data = await req.json<any>();
    const newTicket = createMockTicket({
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      category: data.category,
    });
    tickets.push(newTicket);
    return HttpResponse.json(newTicket);
  }),

  // GET /customer/settings - Get settings
  http.get("*/api/v1/customer/settings", ({ request }) => {
    if (!settings) {
      settings = createMockSettings();
    }
    return HttpResponse.json(settings);
  }),

  // PUT /customer/settings - Update settings
  http.put("*/api/v1/customer/settings", async (req) => {
    const updates = await req.json<any>();
    settings = { ...settings, ...updates };
    return HttpResponse.json(settings);
  }),

  // POST /customer/change-password - Change password
  http.post("*/api/v1/customer/change-password", async (req) => {
    const { current_password, new_password } = await req.json<any>();
    // In a real scenario, you'd verify current_password
    return HttpResponse.json({ success: true, message: "Password changed successfully" });
  }),

  // GET /customer/payment-methods - Get payment methods
  http.get("*/api/v1/customer/payment-methods", ({ request }) => {
    return HttpResponse.json(paymentMethods);
  }),

  // POST /customer/payment-methods - Add payment method
  http.post("*/api/v1/customer/payment-methods", async (req) => {
    const data = await req.json<any>();
    const newMethod = createMockPaymentMethod({
      ...data,
      is_default: paymentMethods.length === 0,
    });
    paymentMethods.push(newMethod);
    return HttpResponse.json(newMethod);
  }),

  // POST /customer/payment-methods/:id/set-default - Set default payment method
  http.post("*/api/v1/customer/payment-methods/:id/set-default", ({ params }) => {
    const id = params.id as string;
    paymentMethods = paymentMethods.map((pm) => ({
      ...pm,
      is_default: pm.payment_method_id === id,
    }));
    return new HttpResponse(null, { status: 200 });
  }),

  // DELETE /customer/payment-methods/:id - Remove payment method
  http.delete("*/api/v1/customer/payment-methods/:id", ({ params }) => {
    const id = params.id as string;
    paymentMethods = paymentMethods.filter((pm) => pm.payment_method_id !== id);
    return new HttpResponse(null, { status: 200 });
  }),

  // PUT /customer/payment-methods/:id/auto-pay - Toggle auto pay
  http.put("*/api/v1/customer/payment-methods/:id/auto-pay", async (req) => {
    const { id } = req.params;
    const { enabled } = await req.json<any>();
    paymentMethods = paymentMethods.map((pm) =>
      pm.payment_method_id === id ? { ...pm, auto_pay_enabled: enabled } : pm,
    );
    return new HttpResponse(null, { status: 200 });
  }),
];
