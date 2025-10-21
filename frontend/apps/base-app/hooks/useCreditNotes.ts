"use client";

import { useQuery } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

export interface CreditNoteSummary {
  id: string;
  number: string;
  customerId: string | null;
  invoiceId: string | null;
  issuedAt: string | null;
  currency: string;
  totalAmountMinor: number;
  remainingAmountMinor: number;
  status: string;
  downloadUrl: string;
}

async function fetchCreditNotes(limit: number): Promise<CreditNoteSummary[]> {
  const url = new URL(`${API_BASE}/api/v1/billing/credit-notes`);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch credit notes");
  }

  const payload = await response.json();
  const notes = Array.isArray(payload?.credit_notes) ? payload.credit_notes : [];

  return notes.map((note: any) => {
    const id: string = note?.credit_note_id ?? "";
    return {
      id,
      number: note?.credit_note_number ?? id ?? "",
      customerId: note?.customer_id ?? null,
      invoiceId: note?.invoice_id ?? null,
      issuedAt: note?.issue_date ?? null,
      currency: note?.currency ?? "USD",
      totalAmountMinor: Number(note?.total_amount ?? 0),
      remainingAmountMinor: Number(note?.remaining_credit_amount ?? 0),
      status: (note?.status ?? "draft").toString(),
      downloadUrl: id ? `/api/v1/billing/credit-notes/${id}/download` : "#",
    };
  });
}

export function useCreditNotes(limit = 5) {
  return useQuery({
    queryKey: ["credit-notes", limit],
    queryFn: () => fetchCreditNotes(limit),
    staleTime: 60_000,
  });
}
