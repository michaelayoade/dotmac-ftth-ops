"use client";

import { useState } from "react";
import {
  usePartnerReferrals,
  useSubmitReferral,
} from "@/hooks/usePlatformPartner";
import { Card, CardContent, CardHeader, CardTitle, Input, Badge } from "@dotmac/ui";
import { Button } from "@dotmac/primitives";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-purple-100 text-purple-800",
  qualified: "bg-yellow-100 text-yellow-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

export default function ReferralsPage() {
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
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const payload: {
        lead_name: string;
        lead_email: string;
        lead_phone?: string;
        company_name?: string;
        estimated_value?: number;
        notes?: string;
      } = {
        lead_name: formData.lead_name,
        lead_email: formData.lead_email,
      };
      if (formData.lead_phone) payload.lead_phone = formData.lead_phone;
      if (formData.company_name) payload.company_name = formData.company_name;
      if (formData.estimated_value) payload.estimated_value = parseFloat(formData.estimated_value);
      if (formData.notes) payload.notes = formData.notes;

      await submitReferral.mutateAsync(payload);

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
      setFormError(err instanceof Error ? err.message : "Failed to submit referral");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referrals</h2>
          <p className="text-gray-600 mt-1">
            Track and manage your ISP business referrals
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Referral"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit New Referral</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name *
                  </label>
                  <Input
                    value={formData.lead_name}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_name: e.target.value })
                    }
                    required
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.lead_email}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_email: e.target.value })
                    }
                    required
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    value={formData.lead_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_phone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    placeholder="Acme ISP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Value (USD)
                  </label>
                  <Input
                    type="number"
                    value={formData.estimated_value}
                    onChange={(e) =>
                      setFormData({ ...formData, estimated_value: e.target.value })
                    }
                    placeholder="5000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional context about this referral..."
                />
              </div>

              {formError && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitReferral.isPending}>
                  {submitReferral.isPending ? "Submitting..." : "Submit Referral"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {referrals && referrals.length > 0 ? (
        <div className="grid gap-4">
          {referrals.map((referral) => (
            <Card key={referral.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">{referral.lead_name}</h3>
                      <Badge className={statusColors[referral.status] || "bg-gray-100 text-gray-800"}>
                        {referral.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{referral.lead_email}</p>
                    {referral.company_name && (
                      <p className="text-sm text-gray-500">{referral.company_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {referral.estimated_value && (
                      <div>
                        <p className="text-sm text-gray-500">Estimated Value</p>
                        <p className="font-medium">
                          {formatCurrency(referral.estimated_value)}
                        </p>
                      </div>
                    )}
                    {referral.actual_value && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">Actual Value</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(referral.actual_value)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-500">
                  <span>
                    Submitted: {new Date(referral.created_at).toLocaleDateString()}
                  </span>
                  {referral.converted_at && (
                    <span className="text-green-600">
                      Converted: {new Date(referral.converted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {referral.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">{referral.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No referrals yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Click &quot;New Referral&quot; to submit your first lead
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
