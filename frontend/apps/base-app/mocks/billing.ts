// Billing mocks that match FastAPI implementation

export const mockInvoices = [
  {
    invoice_id: "inv_123456789abc",
    invoice_number: "INV-2024-000001",
    customer_id: "cust_abc123def456",
    billing_email: "john.doe@example.com",
    status: "finalized",
    payment_status: "paid",
    currency: "USD",
    subtotal: 100000, // In cents
    tax_amount: 10000,
    discount_amount: 5000,
    total_amount: 105000,
    amount_due: 0,
    amount_paid: 105000,
    due_date: "2024-02-28T00:00:00Z",
    paid_date: "2024-02-15T14:30:00Z",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-02-15T14:30:00Z",
    line_items: [
      {
        item_id: "li_abc123",
        description: "Professional Plan - Monthly",
        quantity: 1,
        unit_price: 50000,
        total_price: 50000,
      },
      {
        item_id: "li_def456",
        description: "Additional Users (10)",
        quantity: 10,
        unit_price: 5000,
        total_price: 50000,
      },
    ],
  },
  {
    invoice_id: "inv_987654321xyz",
    invoice_number: "INV-2024-000002",
    customer_id: "cust_xyz789ghi012",
    billing_email: "jane.smith@company.com",
    status: "finalized",
    payment_status: "pending",
    currency: "USD",
    subtotal: 250000,
    tax_amount: 25000,
    discount_amount: 0,
    total_amount: 275000,
    amount_due: 275000,
    amount_paid: 0,
    due_date: "2024-03-15T00:00:00Z",
    created_at: "2024-02-15T09:00:00Z",
    updated_at: "2024-02-15T09:00:00Z",
    line_items: [
      {
        item_id: "li_xyz123",
        description: "Enterprise Plan - Annual",
        quantity: 1,
        unit_price: 250000,
        total_price: 250000,
      },
    ],
  },
  {
    invoice_id: "inv_draft123456",
    invoice_number: "INV-2024-000003",
    customer_id: "cust_draft789",
    billing_email: "draft@example.com",
    status: "draft",
    payment_status: "pending",
    currency: "USD",
    subtotal: 75000,
    tax_amount: 7500,
    discount_amount: 0,
    total_amount: 82500,
    amount_due: 82500,
    amount_paid: 0,
    due_date: "2024-04-01T00:00:00Z",
    created_at: "2024-03-01T11:00:00Z",
    updated_at: "2024-03-01T11:00:00Z",
  },
];

export const mockBillingSettings = {
  company_info: {
    name: "Acme Corporation",
    legal_name: "Acme Corporation Inc.",
    tax_id: "12-3456789",
    registration_number: "REG123456",
    address_line1: "123 Business St",
    address_line2: "Suite 100",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
    phone: "+1-415-555-0123",
    email: "billing@acme.com",
    website: "https://acme.com",
    logo_url: "https://acme.com/logo.png",
    brand_color: "#0EA5E9",
  },
  tax_settings: {
    calculate_tax: true,
    tax_inclusive_pricing: false,
    tax_registrations: [
      { jurisdiction: "CA", registration_number: "CA-TAX-123456" },
      { jurisdiction: "NY", registration_number: "NY-TAX-789012" },
    ],
    default_tax_rate: 8.75,
    tax_provider: "internal",
  },
  payment_settings: {
    enabled_payment_methods: ["card", "bank_account", "ach"],
    default_currency: "USD",
    supported_currencies: ["USD", "EUR", "GBP"],
    default_payment_terms: 30,
    late_payment_fee: 2.5,
    retry_failed_payments: true,
    max_retry_attempts: 3,
    retry_interval_hours: 24,
  },
  invoice_settings: {
    invoice_number_prefix: "INV",
    invoice_number_format: "{prefix}-{year}-{sequence:06d}",
    default_due_days: 30,
    include_payment_instructions: true,
    payment_instructions: "Please pay via ACH or wire transfer to the account details provided.",
    footer_text: "Thank you for your business!",
    terms_and_conditions: "Payment is due within 30 days. Late payments may incur additional fees.",
    send_invoice_emails: true,
    send_payment_reminders: true,
    reminder_schedule_days: [7, 3, 1],
    logo_on_invoices: true,
    color_scheme: "#0EA5E9",
  },
  notification_settings: {
    send_invoice_notifications: true,
    send_payment_confirmations: true,
    send_overdue_notices: true,
    send_receipt_emails: true,
    webhook_url: "https://api.acme.com/webhooks/billing",
    webhook_events: ["invoice.created", "invoice.paid", "payment.failed"],
    webhook_secret: "whsec_test123456789",
  },
  features_enabled: {
    invoicing: true,
    payments: true,
    credit_notes: true,
    receipts: true,
    tax_calculation: true,
    webhooks: true,
    reporting: true,
  },
};

export const mockPayments = [
  {
    payment_id: "pay_abc123456",
    invoice_id: "inv_123456789abc",
    customer_id: "cust_abc123def456",
    amount: 105000,
    currency: "USD",
    status: "succeeded",
    payment_method: "card",
    payment_method_details: {
      brand: "visa",
      last4: "4242",
    },
    created_at: "2024-02-15T14:30:00Z",
    processed_at: "2024-02-15T14:30:05Z",
  },
  {
    payment_id: "pay_xyz789012",
    invoice_id: "inv_987654321xyz",
    customer_id: "cust_xyz789ghi012",
    amount: 275000,
    currency: "USD",
    status: "pending",
    payment_method: "bank_account",
    created_at: "2024-03-01T10:00:00Z",
  },
];

export const mockSubscriptions = [
  {
    subscription_id: "sub_123456789",
    customer_id: "cust_abc123def456",
    plan_id: "plan_professional",
    plan_name: "Professional Plan",
    status: "active",
    current_period_start: "2024-02-01T00:00:00Z",
    current_period_end: "2024-03-01T00:00:00Z",
    cancel_at_period_end: false,
    trial_end: null,
    quantity: 1,
    price: 50000,
    currency: "USD",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-02-01T00:00:00Z",
  },
  {
    subscription_id: "sub_987654321",
    customer_id: "cust_xyz789ghi012",
    plan_id: "plan_enterprise",
    plan_name: "Enterprise Plan",
    status: "trialing",
    current_period_start: "2024-02-15T00:00:00Z",
    current_period_end: "2024-03-15T00:00:00Z",
    cancel_at_period_end: false,
    trial_end: "2024-03-01T00:00:00Z",
    quantity: 1,
    price: 250000,
    currency: "USD",
    created_at: "2024-02-15T00:00:00Z",
    updated_at: "2024-02-15T00:00:00Z",
  },
];

interface QueryParams {
  status?: string;
  customer_id?: string;
  invoice_id?: string;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

// Mock API handlers for testing
export const billingMockHandlers = {
  // Invoices
  getInvoices: (params?: QueryParams) => {
    let filtered = [...mockInvoices];

    if (params?.status && params.status !== "all") {
      filtered = filtered.filter((inv) => inv.status === params.status);
    }

    if (params?.customer_id) {
      filtered = filtered.filter((inv) => inv.customer_id === params.customer_id);
    }

    // Pagination
    const page = params?.page || 1;
    const page_size = params?.page_size || 10;
    const start = (page - 1) * page_size;
    const end = start + page_size;

    return {
      invoices: filtered.slice(start, end),
      total: filtered.length,
      page,
      page_size,
      total_pages: Math.ceil(filtered.length / page_size),
    };
  },

  getInvoice: (invoiceId: string) => {
    const invoice = mockInvoices.find((inv) => inv.invoice_id === invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice;
  },

  // Payments
  getPayments: (params?: QueryParams) => {
    let filtered = [...mockPayments];

    if (params?.status) {
      filtered = filtered.filter((pay) => pay.status === params.status);
    }

    if (params?.invoice_id) {
      filtered = filtered.filter((pay) => pay.invoice_id === params.invoice_id);
    }

    return {
      payments: filtered,
      total: filtered.length,
    };
  },

  // Subscriptions
  getSubscriptions: (params?: QueryParams) => {
    let filtered = [...mockSubscriptions];

    if (params?.status) {
      filtered = filtered.filter((sub) => sub.status === params.status);
    }

    if (params?.customer_id) {
      filtered = filtered.filter((sub) => sub.customer_id === params.customer_id);
    }

    return {
      subscriptions: filtered,
      total: filtered.length,
    };
  },

  // Settings
  getSettings: () => mockBillingSettings,

  updateSettings: (settings: Record<string, unknown>) => {
    // Merge with existing settings
    return { ...mockBillingSettings, ...settings };
  },

  resetSettings: () => mockBillingSettings,
};
