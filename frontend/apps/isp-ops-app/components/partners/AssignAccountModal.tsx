"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

interface AssignAccountModalProps {
  partnerId: string;
  onClose: () => void;
}

interface AssignAccountInput {
  customer_id: string;
  engagement_type: "direct" | "referral" | "reseller" | "affiliate" | undefined;
  custom_commission_rate: number | undefined;
  start_date: string | undefined;
  end_date: string | undefined;
  notes: string | undefined;
}

async function assignAccount(partnerId: string, data: AssignAccountInput): Promise<void> {
  const response = await fetch(`${API_BASE}/api/isp/v1/admin/partners/accounts`, {
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
    throw new Error(error.detail || "Failed to assign account");
  }

  return response.json();
}

export default function AssignAccountModal({ partnerId, onClose }: AssignAccountModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<AssignAccountInput>({
    customer_id: "",
    engagement_type: "direct",
    custom_commission_rate: undefined,
    start_date: undefined,
    end_date: undefined,
    notes: undefined,
  });

  const assignMutation = useMutation({
    mutationFn: (data: AssignAccountInput) => assignAccount(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
      queryClient.invalidateQueries({
        queryKey: ["partner-accounts", partnerId],
      });
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await assignMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Failed to assign account:", error);
      alert("Failed to assign account");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Assign Customer Account</h2>
          <p className="text-slate-400 text-sm mt-1">Link a customer account to this partner</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Customer ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter customer UUID"
            />
            <p className="text-xs text-slate-500 mt-1">
              The UUID of the customer to assign to this partner
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Engagement Type</label>
            <select
              value={formData.engagement_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  engagement_type: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="direct">Direct</option>
              <option value="referral">Referral</option>
              <option value="reseller">Reseller</option>
              <option value="affiliate">Affiliate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Custom Commission Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.custom_commission_rate ? formData.custom_commission_rate * 100 : ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_commission_rate: e.target.value
                    ? parseFloat(e.target.value) / 100
                    : undefined,
                })
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Leave empty to use partner default"
            />
            <p className="text-xs text-slate-500 mt-1">
              Override the partner&apos;s default commission rate for this account
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.start_date || ""}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">End Date</label>
              <input
                type="date"
                value={formData.end_date || ""}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Optional notes about this assignment"
            />
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
              disabled={assignMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
