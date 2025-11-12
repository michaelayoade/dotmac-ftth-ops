"use client";

import { useMemo } from "react";
import { useToast } from "@dotmac/ui";
import { useTenantBrandingQuery, useUpdateTenantBranding } from "@/hooks/useTenantBranding";
import {
  BRANDING_FORM_DEFAULTS,
  BrandingForm,
  normalizeBrandingConfig,
  serializeBrandingForm,
} from "@/components/settings/BrandingForm";

export default function BrandingSettingsPage() {
  const { data, isLoading } = useTenantBrandingQuery();
  const { toast } = useToast();
  const updateBranding = useUpdateTenantBranding({
    onSuccess: () => {
      toast({
        title: "Branding updated",
        description: "Your tenant branding has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Branding update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const initialValues = useMemo(
    () => normalizeBrandingConfig(data?.branding) ?? BRANDING_FORM_DEFAULTS,
    [data?.branding],
  );

  return (
    <BrandingForm
      initialValues={initialValues}
      isLoading={isLoading}
      isSubmitting={updateBranding.isPending}
      onSubmit={(values) => updateBranding.mutate(serializeBrandingForm(values))}
    />
  );
}
