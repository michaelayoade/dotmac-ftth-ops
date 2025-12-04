"use client";

import { useState } from "react";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  useTenantOnboarding,
  useSlugGeneration,
  usePasswordGeneration,
} from "@/hooks/useTenantOnboarding";
import {
  Building2,
  User,
  Settings,
  Mail,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { TenantOnboardingRequest } from "@/lib/services/tenant-onboarding-service";

interface TenantOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type WizardStep = "tenant" | "admin" | "config" | "invitations" | "review" | "complete";

const PLANS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_ROLES = [
  { value: "tenant_admin", label: "Tenant Admin" },
  { value: "admin", label: "Admin" },
  { value: "support", label: "Support" },
  { value: "user", label: "User" },
];

export function TenantOnboardingWizard({
  open,
  onOpenChange,
  onSuccess,
}: TenantOnboardingWizardProps) {
  const { toast } = useToast();
  const { onboardAsync, isOnboarding, onboardingResult, reset } = useTenantOnboarding();
  const { generateSlug } = useSlugGeneration();
  const { generatePassword } = usePasswordGeneration();

  const [currentStep, setCurrentStep] = useState<WizardStep>("tenant");
  const [showPassword, setShowPassword] = useState(false);

  // Tenant Details
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantPlan, setTenantPlan] = useState("starter");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");

  // Admin User
  const [createAdmin, setCreateAdmin] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminRoles, setAdminRoles] = useState(["tenant_admin"]);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);

  // Configuration
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    analytics: true,
    api_access: true,
    webhooks: false,
    custom_branding: false,
  });
  const [customSettings, setCustomSettings] = useState<Array<{ key: string; value: string }>>([]);
  const [metadata, setMetadata] = useState("");

  // Invitations
  const [invitations, setInvitations] = useState<Array<{ email: string; role: string }>>([]);

  // Options
  const [applyDefaultSettings, setApplyDefaultSettings] = useState(true);
  const [markComplete, setMarkComplete] = useState(true);
  const [activateTenant, setActivateTenant] = useState(true);

  const handleNameChange = (value: string) => {
    setTenantName(value);
    if (!tenantSlug || tenantSlug === generateSlug(tenantName)) {
      setTenantSlug(generateSlug(value));
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(16);
    setAdminPassword(newPassword);
    setAutoGeneratePassword(true);
  };

  const addInvitation = () => {
    setInvitations([...invitations, { email: "", role: "user" }]);
  };

  const removeInvitation = (index: number) => {
    setInvitations(invitations.filter((_, i) => i !== index));
  };

  const updateInvitation = (index: number, field: "email" | "role", value: string) => {
    const updated = [...invitations];
    if (updated[index]) {
      updated[index][field] = value;
    }
    setInvitations(updated);
  };

  const addCustomSetting = () => {
    setCustomSettings([...customSettings, { key: "", value: "" }]);
  };

  const removeCustomSetting = (index: number) => {
    setCustomSettings(customSettings.filter((_, i) => i !== index));
  };

  const updateCustomSetting = (index: number, field: "key" | "value", value: string) => {
    const updated = [...customSettings];
    if (updated[index]) {
      updated[index][field] = value;
    }
    setCustomSettings(updated);
  };

  const validateStep = (step: WizardStep): boolean => {
    switch (step) {
      case "tenant":
        if (!tenantName.trim()) {
          toast({
            title: "Validation Error",
            description: "Tenant name is required",
            variant: "destructive",
          });
          return false;
        }
        if (!tenantSlug.trim()) {
          toast({
            title: "Validation Error",
            description: "Tenant slug is required",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case "admin":
        if (createAdmin) {
          if (!adminUsername.trim()) {
            toast({
              title: "Validation Error",
              description: "Admin username is required",
              variant: "destructive",
            });
            return false;
          }
          if (!adminEmail.trim() || !adminEmail.includes("@")) {
            toast({
              title: "Validation Error",
              description: "Valid admin email is required",
              variant: "destructive",
            });
            return false;
          }
          if (!autoGeneratePassword && (!adminPassword || adminPassword.length < 8)) {
            toast({
              title: "Validation Error",
              description: "Password must be at least 8 characters",
              variant: "destructive",
            });
            return false;
          }
        }
        return true;

      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) return;

    const steps: WizardStep[] = ["tenant", "admin", "config", "invitations", "review"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ["tenant", "admin", "config", "invitations", "review"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      if (prevStep) {
        setCurrentStep(prevStep);
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateStep("review")) return;

    try {
      let metadataObj: Record<string, any> = {};
      if (metadata.trim()) {
        try {
          metadataObj = JSON.parse(metadata);
        } catch (e) {
          toast({
            title: "Invalid Metadata",
            description: "Metadata must be valid JSON",
            variant: "destructive",
          });
          return;
        }
      }

      const request: TenantOnboardingRequest = {
        tenant: {
          name: tenantName,
          slug: tenantSlug,
          plan: tenantPlan,
          contact_email: contactEmail || undefined,
          contact_phone: contactPhone || undefined,
          billing_email: billingEmail || undefined,
          address: address || undefined,
          city: city || undefined,
          state: state || undefined,
          postal_code: postalCode || undefined,
          country: country || undefined,
        },
        tenant_id: undefined,
        options: {
          apply_default_settings: applyDefaultSettings,
          mark_onboarding_complete: markComplete,
          activate_tenant: activateTenant,
          allow_existing_tenant: false,
        },
        admin_user: createAdmin
          ? {
              username: adminUsername,
              email: adminEmail,
              password: autoGeneratePassword ? undefined : adminPassword,
              generate_password: autoGeneratePassword,
              full_name: adminFullName || undefined,
              roles: adminRoles,
              send_activation_email: false,
            }
          : undefined,
        feature_flags: featureFlags,
        settings: customSettings
          .filter((s) => s.key.trim() && s.value.trim())
          .map((s) => ({
            key: s.key,
            value: s.value,
            value_type: "string",
          })),
        metadata: metadataObj,
        invitations: invitations
          .filter((inv) => inv.email.trim() && inv.email.includes("@"))
          .map((inv) => ({
            email: inv.email,
            role: inv.role,
            message: undefined,
          })),
      };

      const result = await onboardAsync(request);

      toast({
        title: "Tenant Onboarded Successfully",
        description: result.created
          ? `Created new tenant: ${result.tenant.name}`
          : `Onboarded tenant: ${result.tenant.name}`,
      });

      setCurrentStep("complete");
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Onboarding Failed",
        description: error instanceof Error ? error.message : "Failed to onboard tenant",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    // Reset form
    setCurrentStep("tenant");
    setTenantName("");
    setTenantSlug("");
    setTenantPlan("starter");
    setContactEmail("");
    setContactPhone("");
    setBillingEmail("");
    setAddress("");
    setCity("");
    setState("");
    setPostalCode("");
    setCountry("US");
    setCreateAdmin(true);
    setAdminUsername("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminFullName("");
    setAdminRoles(["tenant_admin"]);
    setAutoGeneratePassword(true);
    setFeatureFlags({
      analytics: true,
      api_access: true,
      webhooks: false,
      custom_branding: false,
    });
    setCustomSettings([]);
    setMetadata("");
    setInvitations([]);
    setApplyDefaultSettings(true);
    setMarkComplete(true);
    setActivateTenant(true);
    reset();
    onOpenChange(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Text has been copied to your clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Onboarding Wizard
          </DialogTitle>
          <DialogDescription>Create and configure a new tenant in your platform</DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        {currentStep !== "complete" && (
          <div className="flex items-center justify-between mb-6">
            {["tenant", "admin", "config", "invitations", "review"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep === step
                      ? "bg-primary text-primary-foreground"
                      : ["tenant", "admin", "config", "invitations", "review"].indexOf(
                            currentStep,
                          ) > index
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {["tenant", "admin", "config", "invitations", "review"].indexOf(currentStep) >
                  index ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="ml-2 text-sm capitalize hidden sm:inline">{step}</span>
                {index < 4 && <div className="w-8 h-0.5 bg-muted mx-2" />}
              </div>
            ))}
          </div>
        )}

        {/* Step: Tenant Details */}
        {currentStep === "tenant" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-name">
                      Tenant Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tenant-name"
                      value={tenantName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Acme Corporation"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tenant-slug">
                      Slug <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tenant-slug"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                      placeholder="acme-corporation"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-plan">Plan</Label>
                  <Select value={tenantPlan} onValueChange={setTenantPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((plan) => (
                        <SelectItem key={plan.value} value={plan.value}>
                          {plan.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Contact Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@acme.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Contact Phone</Label>
                    <Input
                      id="contact-phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing-email">Billing Email</Label>
                  <Input
                    id="billing-email"
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="billing@acme.com"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Address (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="San Francisco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postal-code">Postal Code</Label>
                    <Input
                      id="postal-code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="94102"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="US"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Admin User */}
        {currentStep === "admin" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Administrator Account
                </CardTitle>
                <CardDescription>Create an initial admin user for this tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch checked={createAdmin} onCheckedChange={setCreateAdmin} />
                  <Label>Create administrator account</Label>
                </div>

                {createAdmin && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-username">
                          Username <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="admin-username"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          placeholder="admin"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin-email">
                          Email <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="admin-email"
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@acme.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-fullname">Full Name</Label>
                      <Input
                        id="admin-fullname"
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="admin-password">Password</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePassword}
                        >
                          Generate Secure Password
                        </Button>
                      </div>
                      <div className="relative">
                        <Input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          value={adminPassword}
                          onChange={(e) => {
                            setAdminPassword(e.target.value);
                            setAutoGeneratePassword(false);
                          }}
                          placeholder="Enter password or generate"
                          disabled={autoGeneratePassword && !adminPassword}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={autoGeneratePassword}
                          onCheckedChange={setAutoGeneratePassword}
                        />
                        <Label className="text-sm text-muted-foreground">
                          Generate password automatically (will be shown at completion)
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_ROLES.map((role) => (
                          <Badge
                            key={role.value}
                            variant={adminRoles.includes(role.value) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              if (adminRoles.includes(role.value)) {
                                setAdminRoles(adminRoles.filter((r) => r !== role.value));
                              } else {
                                setAdminRoles([...adminRoles, role.value]);
                              }
                            }}
                          >
                            {role.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Configuration */}
        {currentStep === "config" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Feature Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(featureFlags).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) =>
                        setFeatureFlags({ ...featureFlags, [key]: checked })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Custom Settings</CardTitle>
                <CardDescription>Add tenant-specific configuration settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {customSettings.map((setting, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={setting.key}
                      onChange={(e) => updateCustomSetting(index, "key", e.target.value)}
                    />
                    <Input
                      placeholder="Value"
                      value={setting.value}
                      onChange={(e) => updateCustomSetting(index, "value", e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeCustomSetting(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addCustomSetting} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Setting
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Custom Metadata (JSON)</CardTitle>
                <CardDescription>Optional JSON metadata for the tenant</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Invitations */}
        {currentStep === "invitations" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Team Invitations
                </CardTitle>
                <CardDescription>Invite additional users to join this tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invitations.map((invitation, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Email"
                      type="email"
                      value={invitation.email}
                      onChange={(e) => updateInvitation(index, "email", e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={invitation.role}
                      onValueChange={(value) => updateInvitation(index, "role", value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => removeInvitation(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addInvitation} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Invitation
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Review */}
        {currentStep === "review" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review & Options</CardTitle>
                <CardDescription>
                  Review your configuration and set onboarding options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Tenant Details</h4>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Name:</span> {tenantName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Slug:</span> {tenantSlug}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Plan:</span>{" "}
                      {PLANS.find((p) => p.value === tenantPlan)?.label}
                    </div>
                    {contactEmail && (
                      <div>
                        <span className="text-muted-foreground">Contact:</span> {contactEmail}
                      </div>
                    )}
                  </div>
                </div>

                {createAdmin && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-medium">Administrator</h4>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Username:</span> {adminUsername}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span> {adminEmail}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Roles:</span>{" "}
                        {adminRoles.join(", ")}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Password:</span>{" "}
                        {autoGeneratePassword ? "Will be auto-generated" : "Custom password set"}
                      </div>
                    </div>
                  </div>
                )}

                {invitations.length > 0 && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-medium">Invitations ({invitations.length})</h4>
                    <div className="text-sm space-y-1">
                      {invitations.slice(0, 3).map((inv, i) => (
                        <div key={i}>
                          {inv.email} ({inv.role})
                        </div>
                      ))}
                      {invitations.length > 3 && (
                        <div className="text-muted-foreground">+ {invitations.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Onboarding Options</h4>
                  <div className="flex items-center justify-between">
                    <Label>Apply default settings</Label>
                    <Switch
                      checked={applyDefaultSettings}
                      onCheckedChange={setApplyDefaultSettings}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Mark onboarding as complete</Label>
                    <Switch checked={markComplete} onCheckedChange={setMarkComplete} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Activate tenant immediately</Label>
                    <Switch checked={activateTenant} onCheckedChange={setActivateTenant} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Complete */}
        {currentStep === "complete" && onboardingResult && (
          <div className="space-y-4">
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Onboarding Complete!
                </CardTitle>
                <CardDescription>
                  Tenant has been successfully {onboardingResult.created ? "created" : "onboarded"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {onboardingResult.admin_user_password && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                          Generated Admin Password
                        </h4>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                          This password will only be shown once. Please save it securely.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded border text-sm font-mono">
                            {onboardingResult.admin_user_password}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(onboardingResult.admin_user_password!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">Tenant Information</h4>
                  <div className="bg-muted p-4 rounded-lg text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">ID:</span>{" "}
                      {onboardingResult.tenant.id}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {onboardingResult.tenant.name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge>{onboardingResult.tenant.status}</Badge>
                    </div>
                  </div>
                </div>

                {onboardingResult.applied_settings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Applied Settings</h4>
                    <div className="flex flex-wrap gap-1">
                      {onboardingResult.applied_settings.map((setting) => (
                        <Badge key={setting} variant="secondary">
                          {setting}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {onboardingResult.invitations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Invitations Sent</h4>
                    <p className="text-sm text-muted-foreground">
                      {onboardingResult.invitations.length} invitation(s) have been created
                    </p>
                  </div>
                )}

                {onboardingResult.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="h-4 w-4" />
                      Warnings
                    </h4>
                    <ul className="text-sm space-y-1">
                      {onboardingResult.warnings.map((warning, i) => (
                        <li key={i} className="text-yellow-700 dark:text-yellow-300">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {onboardingResult.logs.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer font-medium text-sm text-muted-foreground">
                      View Activity Log
                    </summary>
                    <div className="mt-2 bg-muted p-3 rounded text-xs font-mono space-y-1">
                      {onboardingResult.logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {currentStep === "complete" ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={prevStep} disabled={currentStep === "tenant"}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              {currentStep === "review" ? (
                <Button onClick={handleSubmit} disabled={isOnboarding}>
                  {isOnboarding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Onboarding...
                    </>
                  ) : (
                    "Complete Onboarding"
                  )}
                </Button>
              ) : (
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
