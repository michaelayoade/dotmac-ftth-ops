"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { usePartnerCustomers } from "@/hooks/usePartnerPortal";
import { Users, DollarSign, TrendingUp, CheckCircle } from "lucide-react";

export default function PartnerCustomersPage() {
  const { data: customers, isLoading, error } = usePartnerCustomers();

  const ENGAGEMENT_COLORS = {
    direct: "bg-blue-500/10 text-blue-400",
    referral: "bg-purple-500/10 text-purple-400",
    reseller: "bg-green-500/10 text-green-400",
    affiliate: "bg-yellow-500/10 text-yellow-400",
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading customers...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-400">Failed to load customers</div>
          <div className="text-sm text-foreground0 mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  const customerList = customers || [];
  const activeCustomers = customerList.filter((c) => c.is_active);
  const totalRevenue = customerList.reduce((sum, c) => sum + c.total_revenue, 0);
  const totalCommissions = customerList.reduce((sum, c) => sum + c.total_commissions, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">My Customers</h1>
        <p className="text-muted-foreground mt-1">Customers assigned to your partnership</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Customers</div>
              <div className="text-3xl font-bold text-white">{customerList.length}</div>
              <div className="text-xs text-foreground0 mt-1">{activeCustomers.length} active</div>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Commissions</div>
              <div className="text-2xl font-bold text-white">
                ${totalCommissions.toLocaleString()}
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Active Rate</div>
              <div className="text-2xl font-bold text-white">
                {customerList.length > 0
                  ? ((activeCustomers.length / customerList.length) * 100).toFixed(0)
                  : 0}
                %
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Customers List */}
      <div className="space-y-3">
        {customerList.length === 0 ? (
          <div className="bg-card p-12 rounded-lg border border-border text-center">
            <Users className="w-12 h-12 text-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No customers assigned yet</p>
            <p className="text-sm text-foreground0">
              Customers will appear here when they&apos;re assigned to your partnership
            </p>
          </div>
        ) : (
          customerList.map((customer) => (
            <div key={customer.id} className="bg-card p-4 rounded-lg border border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{customer.customer_name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        ENGAGEMENT_COLORS[customer.engagement_type]
                      }`}
                    >
                      {customer.engagement_type}
                    </span>
                    {customer.is_active ? (
                      <span className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded bg-card0/10 text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="grid md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Start Date:</span>
                      <span className="ml-2 text-white">
                        {new Date(customer.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    {customer.end_date && (
                      <div>
                        <span className="text-muted-foreground">End Date:</span>
                        <span className="ml-2 text-white">
                          {new Date(customer.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="ml-2 text-white">
                        ${customer.total_revenue.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Commissions:</span>
                      <span className="ml-2 text-white">
                        ${customer.total_commissions.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {customer.custom_commission_rate && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Custom Commission Rate:</span>
                      <span className="ml-2 text-yellow-400">
                        {(customer.custom_commission_rate * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-foreground0">
                    Customer ID: {customer.customer_id}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
