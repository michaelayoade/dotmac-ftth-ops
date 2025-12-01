"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Settings, User, Loader2 } from "lucide-react";
import { useCustomerProfile } from "@/hooks/useCustomerPortal";

export default function SettingsPage() {
  const { profile, loading } = useCustomerProfile();

  if (loading) {
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
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your personal and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">First Name</p>
              <p className="font-medium">{profile?.first_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Name</p>
              <p className="font-medium">{profile?.last_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile?.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{profile?.phone || "N/A"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-medium">{profile?.account_number || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Service Address
          </CardTitle>
          <CardDescription>Your service installation address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="font-medium">{profile?.service_address || "N/A"}</p>
            <p className="text-muted-foreground">
              {profile?.service_city}, {profile?.service_state} {profile?.service_zip}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
