"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlatformConfig } from "@/lib/config";
import { useAppConfig } from "@/providers/AppConfigContext";

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

type BuildApiUrl = PlatformConfig["api"]["buildUrl"];

async function fetchCreditNotes(
  limit: number,
  buildUrl: BuildApiUrl,
): Promise<CreditNoteSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const endpoint = buildUrl(`/billing/credit-notes?${params.toString()}`);

  const response = await fetch(endpoint, {
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
  const { api } = useAppConfig();
  return useQuery({
    queryKey: ["credit-notes", limit, api.baseUrl, api.prefix],
    queryFn: () => fetchCreditNotes(limit, api.buildUrl),
    staleTime: 60_000,
  });
}
