"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Settings, Building2, Loader2 } from "lucide-react";
import { usePartnerProfile } from "@/hooks/useResellerPortal";

export default function SettingsPage() {
  const { data: profile, isLoading } = usePartnerProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your partner account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>Your partner account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Partner Number</p>
              <p className="font-medium">{profile?.partner_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{profile?.company_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Legal Name</p>
              <p className="font-medium">{profile?.legal_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Website</p>
              <p className="font-medium">{profile?.website || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Primary Email</p>
              <p className="font-medium">{profile?.primary_email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Email</p>
              <p className="font-medium">{profile?.billing_email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{profile?.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{profile?.status || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Commission Settings
          </CardTitle>
          <CardDescription>Your commission model and rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Partner Tier</p>
              <p className="font-medium capitalize">{profile?.tier || "Standard"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Commission Model</p>
              <p className="font-medium capitalize">
                {profile?.commission_model?.replace("_", " ") || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Default Commission Rate</p>
              <p className="font-medium">
                {profile?.default_commission_rate
                  ? `${(profile.default_commission_rate * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
