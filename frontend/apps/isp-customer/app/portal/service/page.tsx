"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Wifi, CheckCircle, Loader2 } from "lucide-react";
import { useCustomerService, useCustomerProfile } from "@/hooks/useCustomerPortal";
import { formatCurrency } from "@/lib/utils";

export default function ServicePage() {
  const { service, loading: serviceLoading } = useCustomerService();
  const { profile, loading: profileLoading } = useCustomerProfile();

  const loading = serviceLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading service details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Service</h1>
        <p className="text-muted-foreground">View and manage your internet service</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active internet service plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-3xl font-bold">{service?.plan_name || "No plan"}</p>
              <p className="text-muted-foreground">
                {formatCurrency(service?.monthly_price || 0)}/month
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                service?.status === "active"
                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              }
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {service?.status || "Unknown"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Download Speed</p>
              <p className="text-2xl font-bold text-blue-500">{service?.speed_down || "N/A"}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Upload Speed</p>
              <p className="text-2xl font-bold text-green-500">{service?.speed_up || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Service Address</span>
              <span className="font-medium">{profile?.service_address || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Installation Date</span>
              <span className="font-medium">
                {service?.installation_date
                  ? new Date(service.installation_date).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Billing Cycle</span>
              <span className="font-medium">{service?.billing_cycle || "Monthly"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Next Billing Date</span>
              <span className="font-medium">
                {service?.next_billing_date
                  ? new Date(service.next_billing_date).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
