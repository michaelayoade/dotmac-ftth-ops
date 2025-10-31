"use client";

export const dynamic = "force-dynamic";

import { usePartnerDashboard } from "@/hooks/usePartnerPortal";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  UserPlus,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function PartnerPerformancePage() {
  const { data: stats, isLoading, error } = usePartnerDashboard();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading performance data...</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-400">Failed to load performance data</div>
          <div className="text-sm text-muted-foreground mt-2">
            {error?.message || "Please try again"}
          </div>
        </div>
      </div>
    );
  }

  const conversionRate = stats.conversion_rate || 0;
  const averageRevenuePerCustomer = stats.total_customers > 0
    ? stats.total_revenue_generated / stats.total_customers
    : 0;
  const averageCommissionPerCustomer = stats.total_customers > 0
    ? stats.total_commissions_earned / stats.total_customers
    : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Detailed metrics and insights into your partnership performance
        </p>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-muted-foreground">Conversion Rate</div>
            {conversionRate >= 20 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-yellow-500" />
            )}
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">
            {conversionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">
            {stats.converted_referrals} of {stats.total_referrals} referrals
          </div>
          <div className="mt-4 w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(conversionRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-muted-foreground">Avg Revenue/Customer</div>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">
            ${averageRevenuePerCustomer.toFixed(0)}
          </div>
          <div className="text-sm text-muted-foreground">
            ${stats.total_revenue_generated.toLocaleString()} total revenue
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-muted-foreground">
              Avg Commission/Customer
            </div>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">
            ${averageCommissionPerCustomer.toFixed(0)}
          </div>
          <div className="text-sm text-muted-foreground">
            ${stats.total_commissions_earned.toLocaleString()} earned
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-muted-foreground">Active Customers</div>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">
            {stats.active_customers}
          </div>
          <div className="text-sm text-muted-foreground">
            of {stats.total_customers} total
          </div>
          <div className="mt-4 w-full bg-muted rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((stats.active_customers / stats.total_customers) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Revenue & Commission Breakdown */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Revenue Breakdown
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Total Generated</span>
                <span className="font-semibold text-foreground">
                  ${stats.total_revenue_generated.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="bg-gradient-to-r from-green-600 to-blue-600 h-3 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Commission Earned</span>
                <span className="font-semibold text-foreground">
                  ${stats.total_commissions_earned.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full"
                  style={{
                    width: `${(stats.total_commissions_earned / stats.total_revenue_generated) * 100}%`,
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {((stats.total_commissions_earned / stats.total_revenue_generated) * 100).toFixed(
                  1
                )}
                % of revenue
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission Paid</span>
                <span className="text-green-600 font-medium">
                  ${stats.total_commissions_paid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission Pending</span>
                <span className="text-yellow-600 font-medium">
                  ${stats.pending_commissions.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Referral Funnel
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Referrals</span>
                </div>
                <span className="font-semibold text-foreground">{stats.total_referrals}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Converted</span>
                </div>
                <span className="font-semibold text-green-600">
                  {stats.converted_referrals}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${(stats.converted_referrals / stats.total_referrals) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pending</span>
                </div>
                <span className="font-semibold text-yellow-600">{stats.pending_referrals}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{ width: `${(stats.pending_referrals / stats.total_referrals) * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between mb-1">
                  <span>Conversion Rate:</span>
                  <span className="font-semibold text-foreground">{conversionRate.toFixed(1)}%</span>
                </div>
                <div className="text-xs mt-2">
                  {conversionRate > 25
                    ? "🎉 Excellent performance! Keep up the great work."
                    : conversionRate > 15
                      ? "👍 Good performance. Consider strategies to increase conversions."
                      : "💡 Focus on quality referrals and follow-up to improve conversion."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partner Tier & Commission Info */}
      <div className="bg-card p-6 rounded-lg border border-border mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Partnership Details
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Current Tier</div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg font-medium">
                {stats.current_tier.toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Commission Model</div>
            <div className="font-semibold text-foreground">
              {stats.commission_model.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Default Commission Rate</div>
            <div className="font-semibold text-foreground">
              {(stats.default_commission_rate * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-3">💡 Performance Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong className="text-foreground">Focus on quality over quantity:</strong> Refer
              customers who are likely to stay long-term for better conversion rates.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong className="text-foreground">Follow up with referrals:</strong> Check in with
              prospects to answer questions and guide them through signup.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong className="text-foreground">Share your referral link:</strong> Use social
              media, email, and your website to maximize reach.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong className="text-foreground">Monitor your metrics:</strong> Review this
              dashboard regularly to identify trends and opportunities.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
