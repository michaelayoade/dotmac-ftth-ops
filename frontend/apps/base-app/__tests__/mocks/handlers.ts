/**
 * MSW API Mock Handlers
 * Provides mock responses for API endpoints used in tests
 */

import { http, HttpResponse } from "msw";

// Mock data for plugins
export const mockAvailablePlugins = [
  {
    name: "WhatsApp Business",
    type: "notification",
    version: "1.0.0",
    description: "Send WhatsApp messages via WhatsApp Business API",
    author: "DotMac Platform",
    supports_health_check: true,
    supports_test_connection: true,
    fields: [
      {
        key: "api_token",
        label: "API Token",
        type: "secret",
        required: true,
      },
    ],
  },
  {
    name: "Slack Integration",
    type: "notification",
    version: "2.0.0",
    description: "Send notifications to Slack channels",
    author: "DotMac Platform",
    supports_health_check: true,
    supports_test_connection: false,
    fields: [],
  },
  {
    name: "Payment Gateway",
    type: "payment",
    version: "1.5.0",
    description: "Process payments securely",
    author: "Third Party",
    supports_health_check: false,
    supports_test_connection: true,
    fields: [],
  },
];

export const mockPluginInstances = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    plugin_name: "WhatsApp Business",
    instance_name: "Production WhatsApp",
    status: "active",
    has_configuration: true,
    created_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    plugin_name: "Slack Integration",
    instance_name: "Team Notifications",
    status: "error",
    has_configuration: true,
    last_error: "Authentication failed",
  },
];

export const mockHealthChecks = [
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440000",
    status: "healthy",
    message: "All systems operational",
    details: {},
    response_time_ms: 200,
    timestamp: "2024-01-20T15:30:00Z",
  },
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440001",
    status: "error",
    message: "Authentication failed",
    details: { error_code: 401 },
    response_time_ms: 1000,
    timestamp: "2024-01-20T15:30:00Z",
  },
];

// Default handlers for common API endpoints
export const handlers = [
  // ========== Authentication Endpoints ==========
  http.post("*/api/v1/auth/login/cookie", async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json(
      {
        success: true,
        user: {
          id: "user-123",
          email: body.username || "user@example.com",
          full_name: "Test User",
          is_active: true,
        },
      },
      {
        headers: {
          "Set-Cookie": "session=mock-session-token; Path=/; HttpOnly; SameSite=Lax",
        },
      },
    );
  }),

  http.post("*/api/v1/auth/logout", () => {
    return HttpResponse.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        },
      },
    );
  }),

  http.get("*/api/v1/auth/me", () => {
    return HttpResponse.json({
      id: "user-123",
      email: "user@example.com",
      username: "testuser",
      full_name: "Test User",
      is_active: true,
      roles: ["user"],
    });
  }),

  // ========== Dashboard/Analytics Endpoints ==========
  http.get("*/api/v1/analytics/summary", () => {
    return HttpResponse.json({
      total_users: 150,
      active_users: 120,
      total_revenue: 50000,
      monthly_revenue: 5000,
    });
  }),

  http.get("*/api/v1/analytics/metrics", () => {
    return HttpResponse.json({
      metrics: [
        { name: "users", value: 150, change: "+12%" },
        { name: "revenue", value: 50000, change: "+5%" },
        { name: "requests", value: 10000, change: "+8%" },
      ],
    });
  }),

  // ========== Plugin Endpoints ==========
  http.get("*/api/v1/plugins/", () => {
    return HttpResponse.json(mockAvailablePlugins);
  }),

  http.get("*/api/v1/plugins/instances", () => {
    return HttpResponse.json({ plugins: mockPluginInstances });
  }),

  http.post("*/api/v1/plugins/instances/health-check", () => {
    return HttpResponse.json(mockHealthChecks);
  }),

  http.post("*/api/v1/plugins/refresh", () => {
    return HttpResponse.json({ message: "Plugins refreshed" });
  }),

  http.post("*/api/v1/plugins/instances", async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: "new-instance-id",
      plugin_name: body.plugin_name,
      instance_name: body.instance_name,
      status: "active",
      has_configuration: true,
      created_at: new Date().toISOString(),
    });
  }),

  http.post("*/api/v1/plugins/instances/:id/test", () => {
    return HttpResponse.json({
      success: true,
      message: "Connection successful",
    });
  }),

  http.delete("*/api/v1/plugins/instances/:id", () => {
    return HttpResponse.json({ success: true });
  }),

  // ========== Customer Endpoints ==========
  http.get("*/api/v1/customers", () => {
    return HttpResponse.json({
      customers: [
        {
          id: "cust-1",
          name: "Customer 1",
          email: "customer1@example.com",
          status: "active",
        },
        {
          id: "cust-2",
          name: "Customer 2",
          email: "customer2@example.com",
          status: "active",
        },
      ],
      total: 2,
    });
  }),

  // ========== Billing Endpoints ==========
  http.get("*/api/v1/billing/invoices", () => {
    return HttpResponse.json({
      invoices: [
        {
          id: "inv-1",
          customer_id: "cust-1",
          amount: 100,
          status: "paid",
          due_date: "2024-01-31",
        },
        {
          id: "inv-2",
          customer_id: "cust-2",
          amount: 200,
          status: "pending",
          due_date: "2024-02-15",
        },
      ],
      total: 2,
    });
  }),

  http.get("*/api/v1/billing/payments", () => {
    return HttpResponse.json({
      payments: [
        {
          id: "pay-1",
          invoice_id: "inv-1",
          amount: 100,
          status: "completed",
          created_at: "2024-01-20",
        },
      ],
      total: 1,
    });
  }),

  // ========== Health Check Endpoints ==========
  http.get("*/api/v1/health", () => {
    return HttpResponse.json({
      status: "healthy",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  }),

  http.get("*/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),

  // ========== User Management Endpoints ==========
  http.get("*/api/v1/users", () => {
    return HttpResponse.json({
      users: [
        {
          id: "user-1",
          email: "user1@example.com",
          full_name: "User One",
          is_active: true,
        },
        {
          id: "user-2",
          email: "user2@example.com",
          full_name: "User Two",
          is_active: true,
        },
      ],
      total: 2,
    });
  }),
];
