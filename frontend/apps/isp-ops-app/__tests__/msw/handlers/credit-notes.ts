/**
 * MSW Handlers for Credit Notes API Endpoints
 */

import { rest } from 'msw';
import type { CreditNoteSummary } from '../../../hooks/useCreditNotes';

// In-memory storage for test data
let creditNotes: any[] = [];
let nextCreditNoteId = 1;

// Reset storage between tests
export function resetCreditNotesStorage() {
  creditNotes = [];
  nextCreditNoteId = 1;
}

// Helper to create a mock credit note
export function createMockCreditNote(overrides?: Partial<any>): any {
  const id = `cn-${nextCreditNoteId++}`;
  return {
    credit_note_id: id,
    credit_note_number: `CN-${String(nextCreditNoteId).padStart(3, '0')}`,
    customer_id: 'cust-123',
    invoice_id: 'inv-123',
    issue_date: new Date().toISOString().split('T')[0],
    currency: 'USD',
    total_amount: 10000,
    remaining_credit_amount: 10000,
    status: 'issued',
    ...overrides,
  };
}

// Helper to seed initial data
export function seedCreditNotesData(notesData: any[]) {
  creditNotes = [...notesData];
}

export const creditNotesHandlers = [
  // GET /billing/credit-notes - List credit notes
  rest.get('*/billing/credit-notes', (req, res, ctx) => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const limited = creditNotes.slice(0, limit);

    return res(
      ctx.json({
        credit_notes: limited,
      })
    );
  }),

  // POST /billing/credit-notes - Create credit note
  rest.post('*/billing/credit-notes', async (req, res, ctx) => {
    const data = await req.json();

    const newCreditNote = createMockCreditNote({
      invoice_id: data.invoice_id,
      total_amount: data.amount,
      remaining_credit_amount: data.amount,
      status: 'applied',
    });

    creditNotes.push(newCreditNote);

    return res(
      ctx.status(201),
      ctx.json(newCreditNote)
    );
  }),
];
