"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Button,
  Textarea,
  Separator,
  Alert,
  AlertDescription,
} from "@dotmac/ui";
import { Loader2 } from "lucide-react";
import type { TenantBrandingConfigDto } from "@/hooks/useTenantBranding";

export type BrandingFormValues = {
  productName: string;
  productTagline: string;
  companyName: string;
  supportEmail: string;
  successEmail: string;
  operationsEmail: string;
  partnerSupportEmail: string;
  docsUrl: string;
  supportPortalUrl: string;
  statusPageUrl: string;
  termsUrl: string;
  privacyUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export const BRANDING_FORM_DEFAULTS: BrandingFormValues = {
  productName: "",
  productTagline: "",
  companyName: "",
  supportEmail: "",
  successEmail: "",
  operationsEmail: "",
  partnerSupportEmail: "",
  docsUrl: "",
  supportPortalUrl: "",
  statusPageUrl: "",
  termsUrl: "",
  privacyUrl: "",
  logoLightUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
  primaryColor: "#0ea5e9",
  secondaryColor: "#8b5cf6",
  accentColor: "#0ea5e9",
};

interface BrandingFormProps {
  initialValues?: BrandingFormValues;
  isSubmitting?: boolean;
  isLoading?: boolean;
  onSubmit: (values: BrandingFormValues) => void | Promise<void>;
}

export function normalizeBrandingConfig(
  config?: TenantBrandingConfigDto | null,
): BrandingFormValues {
  if (!config) {
    return BRANDING_FORM_DEFAULTS;
  }

  return {
    productName: config.product_name ?? "",
    productTagline: config.product_tagline ?? "",
    companyName: config.company_name ?? "",
    supportEmail: config.support_email ?? "",
    successEmail: config.success_email ?? "",
    operationsEmail: config.operations_email ?? "",
    partnerSupportEmail: config.partner_support_email ?? "",
    docsUrl: config.docs_url ?? "",
    supportPortalUrl: config.support_portal_url ?? "",
    statusPageUrl: config.status_page_url ?? "",
    termsUrl: config.terms_url ?? "",
    privacyUrl: config.privacy_url ?? "",
    logoLightUrl: config.logo_light_url ?? "",
    logoDarkUrl: config.logo_dark_url ?? "",
    faviconUrl: config.favicon_url ?? "",
    primaryColor: config.primary_color ?? "#0ea5e9",
    secondaryColor: config.secondary_color ?? "#8b5cf6",
    accentColor: config.accent_color ?? "#0ea5e9",
  };
}

export function serializeBrandingForm(values: BrandingFormValues): TenantBrandingConfigDto {
  return {
    product_name: values.productName || null,
    product_tagline: values.productTagline || null,
    company_name: values.companyName || null,
    support_email: values.supportEmail || null,
    success_email: values.successEmail || null,
    operations_email: values.operationsEmail || null,
    partner_support_email: values.partnerSupportEmail || null,
    docs_url: values.docsUrl || null,
    support_portal_url: values.supportPortalUrl || null,
    status_page_url: values.statusPageUrl || null,
    terms_url: values.termsUrl || null,
    privacy_url: values.privacyUrl || null,
    logo_light_url: values.logoLightUrl || null,
    logo_dark_url: values.logoDarkUrl || null,
    favicon_url: values.faviconUrl || null,
    primary_color: values.primaryColor || null,
    secondary_color: values.secondaryColor || null,
    accent_color: values.accentColor || null,
  };
}

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export function BrandingForm({
  initialValues = BRANDING_FORM_DEFAULTS,
  isSubmitting = false,
  isLoading = false,
  onSubmit,
}: BrandingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandingFormValues>({
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = (values: BrandingFormValues) => {
    void onSubmit(values);
  };

  const urlRules = {
    validate: (value: string) =>
      value === "" || isValidUrl(value) || "Enter a valid URL (http or https)",
  };

  const renderError = (field: keyof BrandingFormValues) => {
    const message = errors[field]?.message as string | undefined;
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Branding & Identity</CardTitle>
          <CardDescription>
            Customize how your ISP portal appears to operators and customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading branding configuration...
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(handleFormSubmit)}>
              <section className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Brand Identity</p>
                  <p className="text-sm text-muted-foreground">
                    Names and taglines shown throughout the ISP Operations interface.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product name</Label>
                    <Input id="productName" {...register("productName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company name</Label>
                    <Input id="companyName" {...register("companyName")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productTagline">Tagline</Label>
                  <Textarea
                    id="productTagline"
                    rows={2}
                    {...register("productTagline")}
                    placeholder="e.g. FTTH management for next-gen ISPs"
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Contact & Links</p>
                  <p className="text-sm text-muted-foreground">
                    Emails and URLs surfaced across notifications, portals, and modals.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support email</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      placeholder="support@yourisp.com"
                      {...register("supportEmail")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="successEmail">Success email</Label>
                    <Input
                      id="successEmail"
                      type="email"
                      placeholder="success@yourisp.com"
                      {...register("successEmail")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="operationsEmail">Operations email</Label>
                    <Input
                      id="operationsEmail"
                      type="email"
                      placeholder="noc@yourisp.com"
                      {...register("operationsEmail")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partnerSupportEmail">Partner support email</Label>
                    <Input
                      id="partnerSupportEmail"
                      type="email"
                      placeholder="partners@yourisp.com"
                      {...register("partnerSupportEmail")}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supportPortalUrl">Support portal URL</Label>
                    <Input
                      id="supportPortalUrl"
                      placeholder="https://help.yourisp.com"
                      {...register("supportPortalUrl", urlRules)}
                    />
                    {renderError("supportPortalUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docsUrl">Documentation URL</Label>
                    <Input
                      id="docsUrl"
                      placeholder="https://docs.yourisp.com"
                      {...register("docsUrl", urlRules)}
                    />
                    {renderError("docsUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statusPageUrl">Status page URL</Label>
                    <Input
                      id="statusPageUrl"
                      placeholder="https://status.yourisp.com"
                      {...register("statusPageUrl", urlRules)}
                    />
                    {renderError("statusPageUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="termsUrl">Terms of service URL</Label>
                    <Input
                      id="termsUrl"
                      placeholder="https://yourisp.com/terms"
                      {...register("termsUrl", urlRules)}
                    />
                    {renderError("termsUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="privacyUrl">Privacy policy URL</Label>
                    <Input
                      id="privacyUrl"
                      placeholder="https://yourisp.com/privacy"
                      {...register("privacyUrl", urlRules)}
                    />
                    {renderError("privacyUrl")}
                  </div>
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Brand Assets</p>
                  <p className="text-sm text-muted-foreground">
                    Provide URLs for logos and favicons hosted in your storage provider.
                  </p>
                </div>
                <Alert>
                  <AlertDescription>
                    Upload files to your preferred storage bucket (MinIO/S3) and paste the public
                    URLs here. The ISP portal will use them immediately after saving.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="logoLightUrl">Light logo URL</Label>
                    <Input
                      id="logoLightUrl"
                      placeholder="https://cdn.yourisp.com/logo-light.svg"
                      {...register("logoLightUrl", urlRules)}
                    />
                    {renderError("logoLightUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoDarkUrl">Dark logo URL</Label>
                    <Input
                      id="logoDarkUrl"
                      placeholder="https://cdn.yourisp.com/logo-dark.svg"
                      {...register("logoDarkUrl", urlRules)}
                    />
                    {renderError("logoDarkUrl")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faviconUrl">Favicon URL</Label>
                    <Input
                      id="faviconUrl"
                      placeholder="https://cdn.yourisp.com/favicon.ico"
                      {...register("faviconUrl", urlRules)}
                    />
                    {renderError("faviconUrl")}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary color</Label>
                    <Input id="primaryColor" type="color" {...register("primaryColor")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary color</Label>
                    <Input id="secondaryColor" type="color" {...register("secondaryColor")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent color</Label>
                    <Input id="accentColor" type="color" {...register("accentColor")} />
                  </div>
                </div>
              </section>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save branding settings"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
