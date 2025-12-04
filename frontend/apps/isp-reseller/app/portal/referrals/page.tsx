"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button, Input } from "@dotmac/primitives";
import { Label } from "@dotmac/ui";
import { UserPlus, Loader2, Plus } from "lucide-react";
import { usePartnerReferrals, useSubmitReferral } from "@/hooks/useResellerPortal";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  contacted: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  qualified: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  converted: "bg-green-500/10 text-green-500 border-green-500/30",
  lost: "bg-red-500/10 text-red-500 border-red-500/30",
};

export default function ReferralsPage() {
  const { data: referrals, isLoading } = usePartnerReferrals();
  const submitReferral = useSubmitReferral();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    lead_name: "",
    lead_email: "",
    lead_phone: "",
    company_name: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitReferral.mutateAsync(formData);
      setFormData({
        lead_name: "",
        lead_email: "",
        lead_phone: "",
        company_name: "",
        notes: "",
      });
      setShowForm(false);
    } catch (error) {
      console.error("Failed to submit referral:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
          <p className="text-muted-foreground">
            Submit and track your referrals
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Referral
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit New Referral</CardTitle>
            <CardDescription>
              Enter the details of the lead you want to refer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lead_name">Lead Name *</Label>
                  <Input
                    id="lead_name"
                    value={formData.lead_name}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_email">Lead Email *</Label>
                  <Input
                    id="lead_email"
                    type="email"
                    value={formData.lead_email}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_phone">Phone</Label>
                  <Input
                    id="lead_phone"
                    value={formData.lead_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Any additional information about this lead..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitReferral.isPending}>
                  {submitReferral.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Referral"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Your Referrals
          </CardTitle>
          <CardDescription>Track the status of your referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {!referrals || referrals.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No referrals yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &quot;New Referral&quot; to submit your first lead
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{referral.lead_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {referral.lead_email}
                      {referral.company_name && ` • ${referral.company_name}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[referral.status] || statusColors["new"]}
                  >
                    {referral.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
