"use client";

import { usePartnerTenants } from "@/hooks/usePlatformPartner";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@dotmac/ui";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-yellow-100 text-yellow-800",
  canceled: "bg-red-100 text-red-800",
};

export default function TenantsPage() {
  const { data: tenants, isLoading, error } = usePartnerTenants();

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
        <p className="text-red-600">Failed to load tenants</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Tenants</h2>
          <p className="text-gray-600 mt-1">
            ISP businesses you have referred to the platform
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {tenants?.length ?? 0} tenant(s)
        </div>
      </div>

      {tenants && tenants.length > 0 ? (
        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <Card key={tenant.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">{tenant.tenant_name}</h3>
                      <Badge className={statusColors[tenant.status] || "bg-gray-100 text-gray-800"}>
                        {tenant.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Plan: {tenant.plan} | Started: {new Date(tenant.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Monthly Revenue</p>
                    <p className="text-lg font-semibold">{formatCurrency(tenant.mrr)}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                    <p className="font-medium">{formatCurrency(tenant.total_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Your Commissions</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(tenant.total_commissions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium">
                      {tenant.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No tenants yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Submit referrals to start building your tenant portfolio
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
