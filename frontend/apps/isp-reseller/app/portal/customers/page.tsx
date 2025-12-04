"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Users, Loader2 } from "lucide-react";
import { usePartnerCustomers } from "@/hooks/useResellerPortal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function CustomersPage() {
  const { data: customers, isLoading } = usePartnerCustomers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Customers acquired through your referrals
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Customers
          </CardTitle>
          <CardDescription>
            Track revenue and commissions from your customer base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!customers || customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No customers yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Submit referrals to grow your customer base
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{customer.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.engagement_type} &bull; Since{" "}
                      {new Date(customer.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(customer.total_revenue)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(customer.total_commissions)} commissions
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      customer.is_active
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : "bg-slate-500/10 text-slate-500 border-slate-500/30"
                    }
                  >
                    {customer.is_active ? "Active" : "Inactive"}
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
