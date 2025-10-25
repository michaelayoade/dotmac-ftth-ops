"use client";

import { Partner } from "@/hooks/usePartners";
import Link from "next/link";

interface PartnersListProps {
  partners: Partner[];
  onEdit?: (partner: Partner) => void;
  onDelete?: (partnerId: string) => void;
}

const STATUS_COLORS = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const TIER_COLORS = {
  bronze: "bg-amber-700/10 text-amber-400",
  silver: "bg-slate-400/10 text-slate-300",
  gold: "bg-yellow-500/10 text-yellow-400",
  platinum: "bg-purple-500/10 text-purple-400",
  direct: "bg-blue-500/10 text-blue-400",
};

export default function PartnersList({ partners, onEdit, onDelete }: PartnersListProps) {
  if (partners.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-muted-foreground">No partners found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Create your first partner to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {partners.map((partner) => (
        <div
          key={partner.id}
          className="bg-card p-4 rounded-lg border border-border hover:border-accent-foreground transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href={`/dashboard/partners/${partner.id}`}
                  className="text-lg font-semibold text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {partner.company_name}
                </Link>
                <span
                  className={`px-2 py-1 text-xs rounded border ${STATUS_COLORS[partner.status]}`}
                >
                  {partner.status}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${TIER_COLORS[partner.tier]}`}>
                  {partner.tier}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Partner #:</span>
                  <span className="ml-2 text-foreground">{partner.partner_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Customers:</span>
                  <span className="ml-2 text-foreground">{partner.total_customers}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue:</span>
                  <span className="ml-2 text-foreground">
                    ${partner.total_revenue_generated.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    $
                    {(
                      partner.total_commissions_earned - partner.total_commissions_paid
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-sm text-muted-foreground">
                <span>{partner.primary_email}</span>
                {partner.phone && (
                  <>
                    <span className="mx-2">•</span>
                    <span>{partner.phone}</span>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <div>
                  Referrals: {partner.converted_referrals}/{partner.total_referrals}
                </div>
                <div>
                  Conversion:{" "}
                  {partner.total_referrals > 0
                    ? ((partner.converted_referrals / partner.total_referrals) * 100).toFixed(1)
                    : "0.0"}
                  %
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(partner)}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(partner.id)}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
