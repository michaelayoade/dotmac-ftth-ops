"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, Award, TrendingUp, ClipboardList, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { MetricCardEnhanced } from "@/components/ui/metric-card-enhanced";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnhancedDataTable, type ColumnDef, type Row } from "@/components/ui/EnhancedDataTable";
import { EmptyState } from "@/components/ui/empty-state";
import { useLeads, useQuotes, useSiteSurveys, type Lead, type Quote, type SiteSurvey } from "@/hooks/useCRM";
import { useToast } from "@/components/ui/use-toast";

function formatRelativeDate(value?: string | null) {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
}

export default function CRMOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    leads,
    isLoading: leadsLoading,
    error: leadsError,
    refetch: refetchLeads,
  } = useLeads({ autoRefresh: true, refreshInterval: 60000 });
  const {
    quotes,
    isLoading: quotesLoading,
    error: quotesError,
    refetch: refetchQuotes,
  } = useQuotes();
  const {
    surveys,
    isLoading: surveysLoading,
    error: surveysError,
    refetch: refetchSurveys,
  } = useSiteSurveys();

  const leadStats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((lead) => lead.status === "won").length;
    const qualified = leads.filter((lead) => lead.status === "qualified").length;
    const quoteSent = leads.filter((lead) => lead.status === "quote_sent").length;
    const activePipeline = leads.filter(
      (lead) => !["won", "lost", "disqualified"].includes(lead.status)
    ).length;

    const conversionRate = total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0;

    const highPriority = leads.filter((lead) => lead.priority === 1).length;

    return {
      total,
      won,
      qualified,
      quoteSent,
      activePipeline,
      conversionRate,
      highPriority,
    };
  }, [leads]);

  const quoteStats = useMemo(() => {
    const total = quotes.length;
    const accepted = quotes.filter((quote) => quote.status === "accepted").length;
    const sent = quotes.filter((quote) => quote.status === "sent").length;
    const expiringSoon = quotes.filter((quote) => {
      if (!quote.valid_until) return false;
      const expiresIn = new Date(quote.valid_until).getTime() - Date.now();
      const threeDays = 1000 * 60 * 60 * 24 * 3;
      return expiresIn > 0 && expiresIn <= threeDays;
    }).length;

    const totalMRR = quotes
      .filter((quote) => ["accepted", "sent"].includes(quote.status))
      .reduce((sum, quote) => sum + quote.monthly_recurring_charge, 0);

    return {
      total,
      accepted,
      sent,
      expiringSoon,
      totalMRR,
    };
  }, [quotes]);

  const surveyStats = useMemo(() => {
    const total = surveys.length;
    const scheduled = surveys.filter((survey) => survey.status === "scheduled").length;
    const inProgress = surveys.filter((survey) => survey.status === "in_progress").length;
    const completed = surveys.filter((survey) => survey.status === "completed").length;
    const requiresConstruction = surveys.filter(
      (survey) => survey.serviceability === "requires_construction"
    ).length;

    return {
      total,
      scheduled,
      inProgress,
      completed,
      requiresConstruction,
    };
  }, [surveys]);

  const recentLeads = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [leads]
  );

  const recentQuotes = useMemo(
    () =>
      [...quotes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [quotes]
  );

  const upcomingSurveys = useMemo(
    () =>
      surveys
        .filter((survey) => survey.status === "scheduled")
        .sort(
          (a, b) =>
            new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
        )
        .slice(0, 5),
    [surveys]
  );

  const leadColumns: ColumnDef<Lead>[] = useMemo(
    () => [
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }: { row: Row<Lead> }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }: { row: Row<Lead> }) => <LeadStatusBadge status={row.original.status} />,
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }: { row: Row<Lead> }) => <LeadSourceBadge source={row.original.source} />,
      },
      {
        id: "priority",
        header: "Priority",
        cell: ({ row }: { row: Row<Lead> }) => <LeadPriorityBadge priority={row.original.priority} />,
      },
      {
        id: "created",
        header: "Created",
        cell: ({ row }: { row: Row<Lead> }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeDate(row.original.created_at)}
          </span>
        ),
      },
    ],
    []
  );

  const quoteColumns: ColumnDef<Quote>[] = useMemo(
    () => [
      {
        id: "quote",
        header: "Quote",
        cell: ({ row }: { row: Row<Quote> }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.quote_number}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.service_plan_name}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <QuoteStatusBadge status={row.original.status} />,
      },
      {
        id: "mrr",
        header: "Monthly MRR",
        cell: ({ row }) => (
          <span className="text-sm">
            ${row.original.monthly_recurring_charge.toLocaleString()}
          </span>
        ),
      },
      {
        id: "valid",
        header: "Valid Until",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.valid_until
              ? new Date(row.original.valid_until).toLocaleDateString()
              : "—"}
          </span>
        ),
      },
    ],
    []
  );

  const surveyColumns: ColumnDef<SiteSurvey>[] = useMemo(
    () => [
      {
        id: "survey",
        header: "Survey",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.survey_number}</span>
            <span className="text-xs text-muted-foreground">
              Lead #{row.original.lead_id.slice(0, 8)}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <SurveyStatusBadge status={row.original.status} />,
      },
      {
        id: "scheduled",
        header: "Scheduled Date",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.scheduled_date
              ? new Date(row.original.scheduled_date).toLocaleString()
              : "—"}
          </span>
        ),
      },
      {
        id: "technician",
        header: "Technician",
        accessorKey: "technician_id",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.technician_id ?? "Unassigned"}
          </span>
        ),
      },
    ],
    []
  );

  const handleRefresh = async () => {
    await Promise.all([refetchLeads(), refetchQuotes(), refetchSurveys()]);
    toast({
      title: "CRM Data Refreshed",
      description: "Leads, quotes, and site surveys have been updated.",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Pipeline Snapshot</h2>
          <p className="text-sm text-muted-foreground">
            Real-time overview of customer acquisition funnel performance.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCardEnhanced
          title="Active Pipeline"
          value={leadStats.activePipeline}
          subtitle={`${leadStats.highPriority} high-priority leads`}
          icon={Users}
          href="/dashboard/crm/leads"
          loading={leadsLoading}
          error={leadsError?.message}
          emptyStateMessage="No leads captured yet"
        />
        <MetricCardEnhanced
          title="Qualified Leads"
          value={leadStats.qualified}
          subtitle={`${leadStats.quoteSent} with quotes sent`}
          icon={ClipboardList}
          href="/dashboard/crm/leads"
          loading={leadsLoading}
          error={leadsError?.message}
          emptyStateMessage="No qualified leads yet"
        />
        <MetricCardEnhanced
          title="Quote Pipeline MRR"
          value={quoteStats.totalMRR}
          subtitle={`${quoteStats.sent} sent • ${quoteStats.accepted} accepted`}
          icon={TrendingUp}
          href="/dashboard/crm/quotes"
          currency
          loading={quotesLoading}
          error={quotesError?.message}
          emptyStateMessage="No quotes generated"
        />
        <MetricCardEnhanced
          title="Site Surveys"
          value={surveyStats.scheduled + surveyStats.inProgress}
          subtitle={`${surveyStats.completed} completed • ${surveyStats.requiresConstruction} requiring build`}
          icon={Calendar}
          href="/dashboard/crm/site-surveys"
          loading={surveysLoading}
          error={surveysError?.message}
          emptyStateMessage="No surveys scheduled"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently Captured Leads</CardTitle>
            <CardDescription>
              Monitor the latest opportunities entering the funnel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <EmptyState
                title="No leads yet"
                description="Capture a new lead to start building your sales pipeline."
                action={{
                  label: "Create Lead",
                  onClick: () => router.push("/dashboard/crm/leads"),
                }}
              />
            ) : (
              <EnhancedDataTable
                data={recentLeads}
                columns={leadColumns}
                isLoading={leadsLoading}
                error={leadsError?.message}
                pagination={false}
                hideToolbar
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Quotes</CardTitle>
            <CardDescription>
              Track proposals in flight and identify deals that need follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <EmptyState
                title="No quotes generated"
                description="Create pricing proposals to progress qualified leads."
                action={{
                  label: "Create Quote",
                  onClick: () => router.push("/dashboard/crm/quotes"),
                }}
              />
            ) : (
              <EnhancedDataTable
                data={recentQuotes}
                columns={quoteColumns}
                isLoading={quotesLoading}
                error={quotesError?.message}
                pagination={false}
                hideToolbar
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Site Surveys</CardTitle>
          <CardDescription>
            Coordinate field teams and ensure serviceability checks happen on time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSurveys.length === 0 ? (
            <EmptyState
              title="No site surveys scheduled"
              description="Plan technical assessments to validate feasibility before installation."
              action={{
                label: "Schedule Survey",
                onClick: () => router.push("/dashboard/crm/site-surveys"),
              }}
            />
          ) : (
            <EnhancedDataTable
              data={upcomingSurveys}
              columns={surveyColumns}
              isLoading={surveysLoading}
              error={surveysError?.message}
              pagination={false}
              hideToolbar
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: Lead["status"] }) {
  const config: Record<Lead["status"], { label: string; className: string }> = {
    new: { label: "New", className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
    contacted: { label: "Contacted", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
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
    won: { label: "Won", className: "bg-emerald-600/30 text-emerald-200 border-emerald-500/30" },
    lost: { label: "Lost", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    disqualified: {
      label: "Disqualified",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    },
  };

  const { label, className } = config[status] ?? config.new;

  return <Badge className={className}>{label}</Badge>;
}

function LeadSourceBadge({ source }: { source: Lead["source"] }) {
  const label = source.replace(/_/g, " ");
  return <Badge variant="outline" className="text-xs uppercase">{label}</Badge>;
}

function LeadPriorityBadge({ priority }: { priority: Lead["priority"] }) {
  const config: Record<number, { label: string; className: string }> = {
    1: { label: "High", className: "bg-red-500/20 text-red-200 border-red-500/30" },
    2: { label: "Medium", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    3: { label: "Low", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  };

  const { label, className } = config[priority] ?? config[3] ?? { label: "Low", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" };

  return <Badge className={className}>{label}</Badge>;
}

function QuoteStatusBadge({ status }: { status: Quote["status"] }) {
  const config: Record<Quote["status"], { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    sent: { label: "Sent", className: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
    viewed: { label: "Viewed", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    accepted: { label: "Accepted", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    rejected: { label: "Rejected", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    expired: { label: "Expired", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    revised: { label: "Revised", className: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  };

  const { label, className } = config[status] ?? config.draft;

  return <Badge className={className}>{label}</Badge>;
}

function SurveyStatusBadge({ status }: { status: SiteSurvey["status"] }) {
  const config: Record<SiteSurvey["status"], { label: string; className: string }> = {
    scheduled: { label: "Scheduled", className: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
    in_progress: { label: "In Progress", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    completed: { label: "Completed", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-300 border-red-500/30" },
    canceled: { label: "Canceled", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  };

  const { label, className } = config[status] ?? config.scheduled;

  return <Badge className={className}>{label}</Badge>;
}
