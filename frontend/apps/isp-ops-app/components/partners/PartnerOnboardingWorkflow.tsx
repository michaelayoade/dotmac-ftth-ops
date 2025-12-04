"use client";

import { useState } from "react";
import {
  useCompletePartnerOnboarding,
  CreatePartnerInput,
  PartnerCustomerInput,
  PartnerOnboardingInput,
} from "@/hooks/usePartners";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { Button } from "@dotmac/ui";

type OnboardingStep = "partner" | "customer" | "license" | "deployment" | "review";

export default function PartnerOnboardingWorkflow() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("partner");
  const [partnerData, setPartnerData] = useState<CreatePartnerInput>({
    company_name: "",
    legal_name: "",
    website: "",
    primary_email: "",
    billing_email: "",
    phone: "",
    tier: "bronze",
    commission_model: "revenue_share",
    default_commission_rate: 0.1,
  });
  const [customerData, setCustomerData] = useState<PartnerCustomerInput>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    tier: "standard",
  });
  const [licenseTemplateId, setLicenseTemplateId] = useState<string>("");
  const [deploymentType, setDeploymentType] = useState<string>("kubernetes");
  const [whiteLabelConfig, setWhiteLabelConfig] = useState({
    company_name: "",
    logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#1E40AF",
    custom_domain: "",
    support_email: "",
    support_phone: "",
  });
  const [environment, setEnvironment] = useState<string>("production");
  const [region, setRegion] = useState<string>("");

  const completeOnboarding = useCompletePartnerOnboarding();

  const steps: { id: OnboardingStep; label: string; description: string }[] = [
    {
      id: "partner",
      label: "Partner Information",
      description: "Basic partner details",
    },
    {
      id: "customer",
      label: "First Customer",
      description: "Initial customer setup",
    },
    {
      id: "license",
      label: "License Configuration",
      description: "Select license template",
    },
    {
      id: "deployment",
      label: "Deployment Settings",
      description: "Configure deployment",
    },
    {
      id: "review",
      label: "Review & Submit",
      description: "Review and submit",
    },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length && steps[nextIndex]) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0 && steps[prevIndex]) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    try {
      const onboardingData: PartnerOnboardingInput = {
        partner_data: partnerData,
        customer_data: customerData,
        license_template_id: licenseTemplateId,
        deployment_type: deploymentType,
        white_label_config: whiteLabelConfig,
        environment,
        region,
      };

      const result = await completeOnboarding.mutateAsync(onboardingData);

      alert(
        `Partner onboarding completed successfully!\n\n` +
          `Partner: ${result.partner.company_name}\n` +
          `Customer: ${result.customer.name}\n` +
          `Licenses: ${result.licenses.licenses_allocated}\n` +
          `Tenant URL: ${result.tenant.tenant_url}\n\n` +
          `Workflow ID: ${result.workflow_id}`,
      );
    } catch (error: any) {
      alert(`Failed to complete onboarding: ${(error as Error).message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="bg-card p-6 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    index < currentStepIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentStepIndex
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <Circle className="h-6 w-6" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className="text-sm font-medium text-foreground">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    index < currentStepIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card p-6 rounded-lg border border-border">
        {currentStep === "partner" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Partner Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={partnerData.company_name}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      company_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Legal Name</label>
                <input
                  type="text"
                  value={partnerData.legal_name}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      legal_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={partnerData.primary_email}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      primary_email: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input
                  type="tel"
                  value={partnerData.phone}
                  onChange={(e) => setPartnerData({ ...partnerData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Partner Tier
                </label>
                <select
                  value={partnerData.tier}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      tier: e.target.value as NonNullable<CreatePartnerInput["tier"]>,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="direct">Direct</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={(partnerData.default_commission_rate || 0) * 100}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      default_commission_rate: parseFloat(e.target.value) / 100,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === "customer" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">First Customer</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerData.first_name}
                  onChange={(e) =>
                    setCustomerData({
                      ...customerData,
                      first_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerData.last_name}
                  onChange={(e) =>
                    setCustomerData({
                      ...customerData,
                      last_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={customerData.email}
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
              <input
                type="text"
                value={customerData.company_name}
                onChange={(e) =>
                  setCustomerData({
                    ...customerData,
                    company_name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {currentStep === "license" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">License Configuration</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                License Template ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={licenseTemplateId}
                onChange={(e) => setLicenseTemplateId(e.target.value)}
                placeholder="Enter license template UUID"
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select the license template to use for this partner&apos;s customers
              </p>
            </div>
          </div>
        )}

        {currentStep === "deployment" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Deployment Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Deployment Type
                </label>
                <select
                  value={deploymentType}
                  onChange={(e) => setDeploymentType(e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="kubernetes">Kubernetes</option>
                  <option value="docker_compose">Docker Compose</option>
                  <option value="awx_ansible">AWX/Ansible</option>
                  <option value="terraform">Terraform</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                White-Label Company Name
              </label>
              <input
                type="text"
                value={whiteLabelConfig.company_name}
                onChange={(e) =>
                  setWhiteLabelConfig({
                    ...whiteLabelConfig,
                    company_name: e.target.value,
                  })
                }
                placeholder="Leave empty to use partner's company name"
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Custom Domain
              </label>
              <input
                type="text"
                value={whiteLabelConfig.custom_domain}
                onChange={(e) =>
                  setWhiteLabelConfig({
                    ...whiteLabelConfig,
                    custom_domain: e.target.value,
                  })
                }
                placeholder="e.g., partner.example.com"
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Review & Submit</h3>

            <div className="space-y-4">
              <div className="bg-accent p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Partner Information</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Company: {partnerData.company_name}</p>
                  <p>Email: {partnerData.primary_email}</p>
                  <p>Tier: {partnerData.tier}</p>
                  <p>
                    Commission Rate: {((partnerData.default_commission_rate || 0) * 100).toFixed(2)}
                    %
                  </p>
                </div>
              </div>

              <div className="bg-accent p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">First Customer</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Name: {customerData.first_name} {customerData.last_name}
                  </p>
                  <p>Email: {customerData.email}</p>
                  {customerData.company_name && <p>Company: {customerData.company_name}</p>}
                </div>
              </div>

              <div className="bg-accent p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Deployment Configuration</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Deployment Type: {deploymentType}</p>
                  <p>Environment: {environment}</p>
                  <p>License Template: {licenseTemplateId}</p>
                  {whiteLabelConfig.custom_domain && (
                    <p>Custom Domain: {whiteLabelConfig.custom_domain}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || completeOnboarding.isPending}
          >
            Back
          </Button>

          {currentStep !== "review" ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={completeOnboarding.isPending}>
              {completeOnboarding.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Complete Onboarding"
              )}
            </Button>
          )}
        </div>
      </div>

      {completeOnboarding.isError && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
          <p className="font-semibold">Error completing onboarding</p>
          <p className="text-sm mt-1">{(completeOnboarding.error as Error)?.message}</p>
        </div>
      )}
    </div>
  );
}
