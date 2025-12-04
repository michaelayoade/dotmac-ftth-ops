"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { useParams } from "next/navigation";
import { usePartner, useCheckLicenseQuota } from "@/hooks/usePartners";
import Link from "next/link";
import CreatePartnerModal from "@/components/partners/CreatePartnerModal";
import PartnerCustomerManagement from "@/components/partners/PartnerCustomerManagement";
import CommissionTrackingView from "@/components/partners/CommissionTrackingView";

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params["id"] as string;
  const { data: partner, isLoading, error } = usePartner(partnerId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "customers" | "commissions" | "referrals" | "quota"
  >("overview");
  const checkQuota = useCheckLicenseQuota();
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  const handleCheckQuota = async (requestedLicenses: number = 1) => {
    try {
      const result = await checkQuota.mutateAsync({
        partnerId,
        requestedLicenses,
      });
      setQuotaInfo(result);
    } catch (error: any) {
      alert(`Failed to check quota: ${(error as Error).message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading partner details...</div>
        </div>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-400">Failed to load partner details</div>
          <div className="text-sm text-muted-foreground mt-2">
            {(error as Error)?.message || "Partner not found"}
          </div>
          <Link
            href="/dashboard/partners"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Back to Partners
          </Link>
        </div>
      </div>
    );
  }

  const STATUS_COLORS = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    terminated: "bg-red-500/10 text-red-400 border-red-500/20",
    archived: "bg-card0/10 text-muted-foreground border-border",
  };

  const TIER_COLORS = {
    bronze: "bg-amber-700/10 text-amber-400",
    silver: "bg-muted/10 text-muted-foreground",
    gold: "bg-yellow-500/10 text-yellow-400",
    platinum: "bg-purple-500/10 text-purple-400",
    direct: "bg-blue-500/10 text-blue-400",
  };

  const pendingCommissions = partner.total_commissions_earned - partner.total_commissions_paid;
  const conversionRate =
    partner.total_referrals > 0
      ? ((partner.converted_referrals / partner.total_referrals) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/partners"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{partner.company_name}</h1>
            <p className="text-muted-foreground mt-1">Partner #{partner.partner_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/partners/revenue"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            View Revenue Dashboard
          </Link>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Edit Partner
          </button>
        </div>
      </div>

      {/* Status & Tier Badges */}
      <div className="flex gap-3 mb-6">
        <span className={`px-3 py-1 text-sm rounded border ${STATUS_COLORS[partner.status]}`}>
          {partner.status}
        </span>
        <span className={`px-3 py-1 text-sm rounded ${TIER_COLORS[partner.tier]}`}>
          {partner.tier} tier
        </span>
        <span className="px-3 py-1 text-sm rounded bg-blue-500/10 text-blue-400">
          {partner.commission_model.replace("_", " ")}
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-accent p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-foreground">{partner.total_customers}</div>
        </div>
        <div className="bg-accent p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-foreground">
            ${partner.total_revenue_generated.toLocaleString()}
          </div>
        </div>
        <div className="bg-accent p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mb-1">Pending Commissions</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            ${pendingCommissions.toLocaleString()}
          </div>
        </div>
        <div className="bg-accent p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mb-1">Referral Conversion</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {conversionRate}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {partner.converted_referrals}/{partner.total_referrals}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-6">
          {[
            { id: "overview", label: "Overview" },
            { id: "customers", label: "Customers" },
            { id: "commissions", label: "Commissions" },
            { id: "quota", label: "License Quota" },
            { id: "referrals", label: "Referrals" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab["id"] as any)}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab["id"]
                  ? "border-blue-600 dark:border-blue-400 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="bg-accent p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Contact Information</h3>
              <div className="space-y-3 text-sm">
                {partner.legal_name && (
                  <div>
                    <span className="text-muted-foreground">Legal Name:</span>
                    <span className="ml-2 text-foreground">{partner.legal_name}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Primary Email:</span>
                  <span className="ml-2 text-foreground">{partner.primary_email}</span>
                </div>
                {partner.billing_email && (
                  <div>
                    <span className="text-muted-foreground">Billing Email:</span>
                    <span className="ml-2 text-foreground">{partner.billing_email}</span>
                  </div>
                )}
                {partner.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="ml-2 text-foreground">{partner.phone}</span>
                  </div>
                )}
                {partner.website && (
                  <div>
                    <span className="text-muted-foreground">Website:</span>
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {partner.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Commission Details */}
            <div className="bg-accent p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Commission Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="ml-2 text-foreground capitalize">
                    {partner.commission_model.replace("_", " ")}
                  </span>
                </div>
                {partner.default_commission_rate && (
                  <div>
                    <span className="text-muted-foreground">Default Rate:</span>
                    <span className="ml-2 text-foreground">
                      {(partner.default_commission_rate * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Total Earned:</span>
                  <span className="ml-2 text-foreground">
                    ${partner.total_commissions_earned.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Paid:</span>
                  <span className="ml-2 text-foreground">
                    ${partner.total_commissions_paid.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    ${pendingCommissions.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-accent p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Performance Metrics</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Referrals:</span>
                  <span className="ml-2 text-foreground">{partner.total_referrals}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Converted Referrals:</span>
                  <span className="ml-2 text-foreground">{partner.converted_referrals}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Conversion Rate:</span>
                  <span className="ml-2 text-green-600 dark:text-green-400">{conversionRate}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue Generated:</span>
                  <span className="ml-2 text-foreground">
                    ${partner.total_revenue_generated.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-accent p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Account Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2 text-foreground">
                    {new Date(partner.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="ml-2 text-foreground">
                    {new Date(partner.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "customers" && <PartnerCustomerManagement partnerId={partnerId} />}

        {activeTab === "commissions" && <CommissionTrackingView partnerId={partnerId} />}

        {activeTab === "quota" && (
          <div className="space-y-6">
            <div className="bg-accent p-6 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">License Quota Check</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Check partner&apos;s available license quota before allocating licenses
              </p>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Requested Licenses
                  </label>
                  <input
                    type="number"
                    min="1"
                    defaultValue="1"
                    id="requested-licenses"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={() => {
                    const input = document.getElementById("requested-licenses") as HTMLInputElement;
                    handleCheckQuota(parseInt(input.value || "1"));
                  }}
                  disabled={checkQuota.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {checkQuota.isPending ? "Checking..." : "Check Quota"}
                </button>
              </div>

              {quotaInfo && (
                <div className="mt-6 p-4 bg-background rounded-lg border border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Available</div>
                      <div
                        className={`text-lg font-semibold ${
                          quotaInfo.available ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {quotaInfo.available ? "Yes" : "No"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Allocated</div>
                      <div className="text-lg font-semibold text-foreground">
                        {quotaInfo.quota_allocated === "unlimited"
                          ? "Unlimited"
                          : quotaInfo.quota_allocated}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Used</div>
                      <div className="text-lg font-semibold text-foreground">
                        {quotaInfo.quota_used}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Remaining</div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {quotaInfo.is_unlimited ? "Unlimited" : quotaInfo.quota_remaining}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Partner Status:{" "}
                        <span className="text-foreground">{quotaInfo.partner_status}</span>
                      </p>
                      <p>
                        Partner Tier:{" "}
                        <span className="text-foreground">{quotaInfo.partner_tier}</span>
                      </p>
                      <p>
                        Can Allocate:{" "}
                        <span
                          className={quotaInfo.can_allocate ? "text-green-400" : "text-red-400"}
                        >
                          {quotaInfo.can_allocate ? "Yes" : "No"}
                        </span>
                      </p>
                      <p>
                        Checked At:{" "}
                        <span className="text-foreground">
                          {new Date(quotaInfo.checked_at).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "referrals" && (
          <div className="bg-accent p-6 rounded-lg border border-border">
            <div className="text-center py-8 text-muted-foreground">
              Referral management functionality coming soon
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <CreatePartnerModal partner={partner} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
