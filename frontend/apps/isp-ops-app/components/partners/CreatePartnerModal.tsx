"use client";

import { useState, useEffect } from "react";
import {
  useCreatePartner,
  useUpdatePartner,
  Partner,
  CreatePartnerInput,
} from "@/hooks/usePartners";

interface CreatePartnerModalProps {
  partner?: Partner | null;
  onClose: () => void;
}

export default function CreatePartnerModal({ partner, onClose }: CreatePartnerModalProps) {
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const [formData, setFormData] = useState<CreatePartnerInput>({
    company_name: "",
    primary_email: "",
    tier: "bronze",
    commission_model: "revenue_share",
    legal_name: undefined,
    website: undefined,
    billing_email: undefined,
    phone: undefined,
    default_commission_rate: undefined,
    address_line1: undefined,
    city: undefined,
    state_province: undefined,
    country: undefined,
  } as any);

  useEffect(() => {
    if (partner) {
      setFormData({
        company_name: partner.company_name,
        legal_name: partner.legal_name || undefined,
        website: partner.website || undefined,
        primary_email: partner.primary_email,
        billing_email: partner.billing_email || undefined,
        phone: partner.phone || undefined,
        tier: partner.tier,
        commission_model: partner.commission_model,
        default_commission_rate: partner.default_commission_rate || undefined,
        address_line1: undefined,
        city: undefined,
        state_province: undefined,
        country: undefined,
      } as any);
    }
  }, [partner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (partner) {
        await updatePartner.mutateAsync({
          partnerId: partner.id,
          data: {
            company_name: formData.company_name || undefined,
            tier: formData.tier,
            default_commission_rate: formData.default_commission_rate,
            billing_email: formData.billing_email,
            phone: formData.phone,
          } as any,
        });
      } else {
        await createPartner.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save partner:", error);
      alert("Failed to save partner");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            {partner ? "Edit Partner" : "Create New Partner"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Legal Name</label>
              <input
                type="text"
                value={formData.legal_name || ""}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Website</label>
              <input
                type="url"
                value={formData.website || ""}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Primary Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.primary_email}
                onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="contact@partner.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Billing Email</label>
              <input
                type="email"
                value={formData.billing_email || ""}
                onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="billing@partner.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Partner Tier</label>
              <select
                value={formData.tier}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tier: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Commission Model</label>
              <select
                value={formData.commission_model}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commission_model: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="revenue_share">Revenue Share</option>
                <option value="flat_fee">Flat Fee</option>
                <option value="tiered">Tiered</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Default Commission Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={
                  formData.default_commission_rate ? formData.default_commission_rate * 100 : ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_commission_rate: e.target.value
                      ? parseFloat(e.target.value) / 100
                      : undefined,
                  } as any)
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="15.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPartner.isPending || updatePartner.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {createPartner.isPending || updatePartner.isPending
                ? "Saving..."
                : partner
                  ? "Update Partner"
                  : "Create Partner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
