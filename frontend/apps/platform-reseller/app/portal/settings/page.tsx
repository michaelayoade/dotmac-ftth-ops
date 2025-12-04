"use client";

import { usePartnerProfile } from "@/hooks/usePlatformPartner";
import { usePartnerAuth } from "@/lib/auth/PartnerAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/primitives";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function SettingsPage() {
  const { data: profile, isLoading, error } = usePartnerProfile();
  const { logout } = usePartnerAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Manage your partner account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Partner Number</p>
              <p className="font-medium">{profile?.partner_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Company Name</p>
              <p className="font-medium">{profile?.company_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Legal Name</p>
              <p className="font-medium">{profile?.legal_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Website</p>
              <p className="font-medium">
                {profile?.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {profile.website}
                  </a>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{profile?.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Partner Tier</p>
              <p className="font-medium capitalize">{profile?.tier}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Commission Model</p>
              <p className="font-medium capitalize">{profile?.commission_model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Default Commission Rate</p>
              <p className="font-medium">
                {formatPercent(profile?.default_commission_rate ?? 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Primary Email</p>
              <p className="font-medium">{profile?.primary_email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Billing Email</p>
              <p className="font-medium">{profile?.billing_email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{profile?.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              To update your partner profile or banking details, please contact your
              account manager.
            </p>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
