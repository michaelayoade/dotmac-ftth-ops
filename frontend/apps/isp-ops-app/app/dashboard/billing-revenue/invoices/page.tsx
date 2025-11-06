"use client";

import { useState } from "react";
import { CreditCard, FileDown } from "lucide-react";
import InvoiceList from "@/components/billing/InvoiceList";
import { logger } from "@/lib/logger";
import { useTenant } from "@/lib/contexts/tenant-context";
import { Invoice } from "@/types/billing";

export default function BillingPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { currentTenant, tenantId } = useTenant();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Billing &amp; Invoices</h1>
          <p className="text-muted-foreground">
            Monitor tenant invoices, outstanding balances, and payment activity in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Tenant</span>
            <span className="font-semibold text-foreground">
              {currentTenant?.name || "Unknown"}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              logger.info("Export invoices requested", {
                tenantId: tenantId || "unknown",
              })
            }
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <InvoiceList tenantId={tenantId || "default-tenant"} onInvoiceSelect={setSelectedInvoice} />

      {selectedInvoice && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Selected invoice</div>
          <div className="text-foreground font-semibold">{selectedInvoice.invoice_number}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {selectedInvoice.billing_email} • Due{" "}
            {new Date(selectedInvoice.due_date).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
