"use client";

import { useState } from "react";
import { useCreatePartnerCustomer, PartnerCustomerInput } from "@/hooks/usePartners";
import { UserPlus, X } from "lucide-react";
import { Button } from "@dotmac/ui";

interface PartnerCustomerManagementProps {
  partnerId: string;
  tenantId?: string;
}

export default function PartnerCustomerManagement({
  partnerId,
  tenantId,
}: PartnerCustomerManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PartnerCustomerInput>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    tier: "standard",
    service_address: "",
    billing_address: "",
  });
  const [engagementType, setEngagementType] = useState<string>("managed");
  const [customCommissionRate, setCustomCommissionRate] = useState<number | undefined>();

  const createPartnerCustomer = useCreatePartnerCustomer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: {
        partnerId: string;
        customerData: PartnerCustomerInput;
        engagementType?: string;
        customCommissionRate?: number;
        tenantId?: string;
      } = {
        partnerId,
        customerData: formData,
      };
      if (engagementType) payload.engagementType = engagementType;
      if (customCommissionRate !== undefined) payload.customCommissionRate = customCommissionRate;
      if (tenantId) payload.tenantId = tenantId;

      const result = await createPartnerCustomer.mutateAsync(payload);

      alert(
        `Customer created successfully!\nCustomer ID: ${result.customer_id}\nQuota remaining: ${result.quota_remaining}`,
      );

      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
        tier: "standard",
        service_address: "",
        billing_address: "",
      });
      setShowForm(false);
    } catch (error: any) {
      alert(`Failed to create customer: ${(error as Error).message}`);
    }
  };

  const handleInputChange = (field: keyof PartnerCustomerInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Customer Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage customers under this partner
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} aria-label="Add new customer">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-foreground">New Customer</h4>
            <button
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="company_name"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Company Name
              </label>
              <input
                id="company_name"
                type="text"
                value={formData.company_name}
                onChange={(e) => handleInputChange("company_name", e.target.value)}
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Addresses */}
            <div>
              <label
                htmlFor="service_address"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Service Address
              </label>
              <input
                id="service_address"
                type="text"
                value={formData.service_address}
                onChange={(e) => handleInputChange("service_address", e.target.value)}
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="billing_address"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Billing Address
              </label>
              <input
                id="billing_address"
                type="text"
                value={formData.billing_address}
                onChange={(e) => handleInputChange("billing_address", e.target.value)}
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Partner Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tier" className="block text-sm font-medium text-foreground mb-1">
                  Customer Tier
                </label>
                <select
                  id="tier"
                  value={formData.tier}
                  onChange={(e) => handleInputChange("tier", e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="engagement_type"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Engagement Type
                </label>
                <select
                  id="engagement_type"
                  value={engagementType}
                  onChange={(e) => setEngagementType(e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="managed">Managed (Partner provides support)</option>
                  <option value="referral">Referral (Platform manages)</option>
                  <option value="reseller">Reseller (Hybrid)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="commission_rate"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Custom Commission Rate (%)
              </label>
              <input
                id="commission_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={customCommissionRate ?? ""}
                onChange={(e) =>
                  setCustomCommissionRate(
                    e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                  )
                }
                placeholder="Leave empty to use partner's default rate"
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: Override partner&apos;s default commission rate for this customer
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPartnerCustomer.isPending}>
                {createPartnerCustomer.isPending ? "Creating..." : "Create Customer"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {createPartnerCustomer.isError && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
          <p className="font-semibold">Error creating customer</p>
          <p className="text-sm mt-1">{(createPartnerCustomer.error as Error)?.message}</p>
        </div>
      )}
    </div>
  );
}
