/**
 * MSW Handlers for Invoice Actions API Endpoints
 */

import { rest } from 'msw';

// Reset storage between tests
export function resetInvoiceActionsStorage() {
  // No persistent storage needed for invoice actions
}

export const invoiceActionsHandlers = [
  // POST /billing/invoices/:id/send - Send invoice email
  rest.post('*/billing/invoices/:invoiceId/send', async (req, res, ctx) => {
    const { invoiceId } = req.params;
    const data = await req.json();

    return res(
      ctx.json({
        success: true,
        message: 'Invoice sent successfully',
        email: data.email,
      })
    );
  }),

  // POST /billing/invoices/:id/void - Void invoice
  rest.post('*/billing/invoices/:invoiceId/void', async (req, res, ctx) => {
    const { invoiceId } = req.params;
    const data = await req.json();

    return res(
      ctx.json({
        success: true,
        message: 'Invoice voided successfully',
        reason: data.reason,
      })
    );
  }),

  // POST /billing/invoices/:id/remind - Send payment reminder
  rest.post('*/billing/invoices/:invoiceId/remind', async (req, res, ctx) => {
    const { invoiceId } = req.params;
    const data = await req.json();

    return res(
      ctx.json({
        success: true,
        message: 'Payment reminder sent successfully',
        message_override: data.message,
      })
    );
  }),
];
