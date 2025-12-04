"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

interface ReferralSubmissionFormProps {
  partnerId: string;
  onSuccess?: () => void;
}

interface ReferralInput {
  lead_name: string;
  lead_email: string;
  lead_phone: string | undefined;
  company_name: string | undefined;
  estimated_value: number | undefined;
  notes: string | undefined;
}

async function submitReferral(partnerId: string, data: ReferralInput): Promise<void> {
  const response = await fetch(`${API_BASE}/api/isp/v1/admin/partners/referrals`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      partner_id: partnerId,
      ...data,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit referral");
  }

  return response.json();
}

export default function ReferralSubmissionForm({
  partnerId,
  onSuccess,
}: ReferralSubmissionFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ReferralInput>({
    lead_name: "",
    lead_email: "",
    lead_phone: undefined,
    company_name: undefined,
    estimated_value: undefined,
    notes: undefined,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data: ReferralInput) => submitReferral(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
      queryClient.invalidateQueries({
        queryKey: ["partner-referrals", partnerId],
      });
      setShowSuccess(true);
      setFormData({
        lead_name: "",
        lead_email: "",
        lead_phone: undefined,
        company_name: undefined,
        estimated_value: undefined,
        notes: undefined,
      });
      setTimeout(() => setShowSuccess(false), 3000);
      onSuccess?.();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submitMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Failed to submit referral:", error);
      alert("Failed to submit referral");
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Submit New Referral</h3>
      <p className="text-slate-400 text-sm mb-6">
        Refer a potential customer and earn commissions when they convert
      </p>

      {showSuccess && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="text-green-400 font-semibold">Referral Submitted!</div>
          <div className="text-sm text-green-300 mt-1">
            Your referral has been submitted successfully. We&apos;ll track its progress and notify
            you of updates.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Lead Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Lead Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.lead_email}
              onChange={(e) => setFormData({ ...formData, lead_email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Lead Phone</label>
            <input
              type="tel"
              value={formData.lead_phone || ""}
              onChange={(e) => setFormData({ ...formData, lead_phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Company Name</label>
            <input
              type="text"
              value={formData.company_name || ""}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Acme Inc."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-2">Estimated Value ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.estimated_value || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimated_value: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="5000.00"
            />
            <p className="text-xs text-slate-500 mt-1">Estimated annual contract value</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-2">Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Additional details about this referral, their needs, timeline, etc."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={() =>
              setFormData({
                lead_name: "",
                lead_email: "",
                lead_phone: undefined,
                company_name: undefined,
                estimated_value: undefined,
                notes: undefined,
              })
            }
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Referral"}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-2">Commission Information</h4>
        <p className="text-xs text-slate-400">
          You&apos;ll earn commissions based on your partner tier and commission model when this
          referral converts to a paying customer. Track the status of all your referrals in the
          Referrals tab.
        </p>
      </div>
    </div>
  );
}
