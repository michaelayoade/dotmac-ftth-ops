/**
 * CRM Badge Components
 *
 * Reusable badge components for CRM statuses and attributes.
 */

import { Badge } from "@dotmac/ui";

import type { Lead, Quote, SiteSurvey } from "../types";

export function LeadStatusBadge({ status }: { status: Lead["status"] }) {
  const config: Record<Lead["status"], { label: string; className: string }> = {
    new: {
      label: "New",
      className: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    },
    contacted: {
      label: "Contacted",
      className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    qualified: {
      label: "Qualified",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    site_survey_scheduled: {
      label: "Survey Scheduled",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    site_survey_completed: {
      label: "Survey Completed",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    quote_sent: {
      label: "Quote Sent",
      className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    },
    negotiating: {
      label: "Negotiating",
      className: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
    won: {
      label: "Won",
      className: "bg-emerald-600/30 text-emerald-200 border-emerald-500/30",
    },
    lost: {
      label: "Lost",
      className: "bg-red-500/20 text-red-300 border-red-500/30",
    },
    disqualified: {
      label: "Disqualified",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  };

  const { label, className } = config[status] ?? config.new;

  return <Badge className={className}>{label}</Badge>;
}

export function LeadSourceBadge({ source }: { source: Lead["source"] }) {
  const label = source.replace(/_/g, " ");
  return (
    <Badge variant="outline" className="text-xs uppercase">
      {label}
    </Badge>
  );
}

export function LeadPriorityBadge({ priority }: { priority: Lead["priority"] }) {
  const config: Record<number, { label: string; className: string }> = {
    1: {
      label: "High",
      className: "bg-red-500/20 text-red-200 border-red-500/30",
    },
    2: {
      label: "Medium",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    3: {
      label: "Low",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  };

  const { label, className } = config[priority] ??
    config[3] ?? {
      label: "Low",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    };

  return <Badge className={className}>{label}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: Quote["status"] }) {
  const config: Record<Quote["status"], { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
    sent: {
      label: "Sent",
      className: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    },
    viewed: {
      label: "Viewed",
      className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    accepted: {
      label: "Accepted",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-500/20 text-red-300 border-red-500/30",
    },
    expired: {
      label: "Expired",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    revised: {
      label: "Revised",
      className: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
  };

  const { label, className } = config[status] ?? config.draft;

  return <Badge className={className}>{label}</Badge>;
}

export function SurveyStatusBadge({ status }: { status: SiteSurvey["status"] }) {
  const config: Record<SiteSurvey["status"], { label: string; className: string }> = {
    scheduled: {
      label: "Scheduled",
      className: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    completed: {
      label: "Completed",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    failed: {
      label: "Failed",
      className: "bg-red-500/20 text-red-300 border-red-500/30",
    },
    canceled: {
      label: "Canceled",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  };

  const { label, className } = config[status] ?? config.scheduled;

  return <Badge className={className}>{label}</Badge>;
}
