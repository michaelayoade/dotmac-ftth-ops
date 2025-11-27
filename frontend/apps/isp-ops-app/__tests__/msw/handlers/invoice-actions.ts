/**
 * MSW Handlers for Invoice Actions API Endpoints
 */

import { http, HttpResponse } from "msw";

// Reset storage between tests
export function resetInvoiceActionsStorage() {
  // No persistent storage needed for invoice actions
}

export const invoiceActionsHandlers = [
  // POST /billing/invoices/:id/send - Send invoice email
  http.post("*/billing/invoices/:invoiceId/send", async ({ request, params }) => {
    const { invoiceId } = params;
    const data = await request.json();

    return HttpResponse.json({
      success: true,
      message: "Invoice sent successfully",
      email: data.email,
    });
  }),

  // POST /billing/invoices/:id/void - Void invoice
  http.post("*/billing/invoices/:invoiceId/void", async ({ request, params }) => {
    const { invoiceId } = params;
    const data = await request.json();

    return HttpResponse.json({
      success: true,
      message: "Invoice voided successfully",
      reason: data.reason,
    });
  }),

  // POST /billing/invoices/:id/remind - Send payment reminder
  http.post("*/billing/invoices/:invoiceId/remind", async ({ request, params }) => {
    const { invoiceId } = params;
    const data = await request.json();

    return HttpResponse.json({
      success: true,
      message: "Payment reminder sent successfully",
      message_override: data.message,
    });
  }),
];
