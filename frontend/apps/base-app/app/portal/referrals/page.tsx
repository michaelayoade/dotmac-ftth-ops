"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { usePartnerReferrals, useSubmitReferral } from "@/hooks/usePartnerPortal";
import { UserPlus, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

export default function PartnerReferralsPage() {
  const { data: referrals, isLoading, error } = usePartnerReferrals();
  const submitReferral = useSubmitReferral();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    lead_name: "",
    lead_email: "",
    lead_phone: "",
    company_name: "",
    estimated_value: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submitReferral.mutateAsync({
        lead_name: formData.lead_name,
        lead_email: formData.lead_email,
        lead_phone: formData.lead_phone || undefined,
        company_name: formData.company_name || undefined,
        estimated_value: formData.estimated_value
          ? parseFloat(formData.estimated_value)
          : undefined,
        notes: formData.notes || undefined,
      });

      setFormData({
        lead_name: "",
        lead_email: "",
        lead_phone: "",
        company_name: "",
        estimated_value: "",
        notes: "",
      });
      setShowForm(false);
    } catch (err) {
      console.error("Failed to submit referral:", err);
      alert("Failed to submit referral");
    }
  };

  const STATUS_COLORS = {
    new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    contacted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    qualified: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    converted: "bg-green-500/10 text-green-400 border-green-500/20",
    lost: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const STATUS_ICONS = {
    new: Clock,
    contacted: UserPlus,
    qualified: AlertCircle,
    converted: CheckCircle,
    lost: XCircle,
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading referrals...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-400">Failed to load referrals</div>
          <div className="text-sm text-foreground0 mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  const referralList = referrals || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Referrals</h1>
          <p className="text-muted-foreground mt-1">Submit and track your customer referrals</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "Submit Referral"}
        </button>
      </div>

      {/* Referral Form */}
      {showForm && (
        <div className="bg-card p-6 rounded-lg border border-border mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Submit New Referral</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Lead Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.lead_name}
                  onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Lead Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.lead_email}
                  onChange={(e) => setFormData({ ...formData, lead_email: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Lead Phone</label>
                <input
                  type="tel"
                  value={formData.lead_phone}
                  onChange={(e) => setFormData({ ...formData, lead_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Company Name</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                  placeholder="Acme Inc."
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Estimated Value ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.estimated_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimated_value: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                  placeholder="5000.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Additional details about this referral..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-accent hover:bg-muted text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitReferral.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitReferral.isPending ? "Submitting..." : "Submit Referral"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Referrals List */}
      <div className="space-y-3">
        {referralList.length === 0 ? (
          <div className="bg-card p-12 rounded-lg border border-border text-center">
            <UserPlus className="w-12 h-12 text-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No referrals yet</p>
            <p className="text-sm text-foreground0">
              Submit your first referral to start earning commissions
            </p>
          </div>
        ) : (
          referralList.map((referral) => {
            const StatusIcon = STATUS_ICONS[referral.status];

            return (
              <div key={referral.id} className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {referral.lead_name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs rounded border flex items-center gap-1 ${
                          STATUS_COLORS[referral.status]
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {referral.status}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="ml-2 text-foreground">{referral.lead_email}</span>
                      </div>
                      {referral.company_name && (
                        <div>
                          <span className="text-muted-foreground">Company:</span>
                          <span className="ml-2 text-foreground">{referral.company_name}</span>
                        </div>
                      )}
                      {referral.estimated_value && (
                        <div>
                          <span className="text-muted-foreground">Estimated Value:</span>
                          <span className="ml-2 text-foreground">
                            ${referral.estimated_value.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {referral.notes && (
                      <div className="mt-2 text-sm text-muted-foreground">{referral.notes}</div>
                    )}

                    <div className="mt-2 text-xs text-foreground0">
                      Submitted: {new Date(referral.created_at).toLocaleDateString()}
                      {referral.converted_at && (
                        <span className="ml-4">
                          Converted: {new Date(referral.converted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
