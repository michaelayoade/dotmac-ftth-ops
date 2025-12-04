"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  BRANDING_FORM_DEFAULTS,
  BrandingForm,
  type BrandingFormValues,
} from "@/components/settings/BrandingForm";

const isProduction = process.env["NODE_ENV"] === "production";

export default function BrandingHarnessPage() {
  if (isProduction) {
    notFound();
  }

  const [formValues, setFormValues] = useState<BrandingFormValues>({
    ...BRANDING_FORM_DEFAULTS,
    productName: "FiberCloud Control",
    companyName: "FiberCloud Networks",
    supportEmail: "support@fibercloud.example",
    docsUrl: "https://docs.fibercloud.example",
    supportPortalUrl: "https://support.fibercloud.example",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);

  const handleSubmit = async (values: BrandingFormValues) => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setFormValues(values);
    setLastSavedTimestamp(new Date().toLocaleTimeString());
    setIsSaving(false);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6" data-testid="branding-test-harness">
      <div className="rounded-md border border-dashed border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Branding Form Test Harness</p>
        <p>
          The form below uses in-memory data so E2E tests can exercise save flows without calling
          the real API.
        </p>
        {lastSavedTimestamp && (
          <p className="mt-2 text-foreground" data-testid="branding-save-confirmation">
            Last saved <strong>{formValues.productName}</strong> at {lastSavedTimestamp}
          </p>
        )}
      </div>
      <BrandingForm initialValues={formValues} isSubmitting={isSaving} onSubmit={handleSubmit} />
    </main>
  );
}
