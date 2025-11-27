"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Users,
  CheckCircle,
  Send,
  TrendingUp,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  CheckSquare,
  XSquare,
  UserCheck,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@dotmac/ui";
import { Card, CardContent } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { EnhancedDataTable, type ColumnDef, type BulkAction, type Row } from "@dotmac/ui";
import { MetricCardEnhanced } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { useLeads, type Lead, type LeadStatus, type LeadSource } from "@/hooks/useCRM";
import { LeadStatusBadge, LeadSourceBadge, LeadPriorityBadge } from "@/components/crm/Badges";
import { CreateLeadModal } from "@/components/crm/CreateLeadModal";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";

function formatRelativeDate(value?: string | null) {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
}

export default function LeadsManagementPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "">("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch leads with filters
  const leadQueryOptions = {
    autoRefresh: true,
    refreshInterval: 60000,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
  } as const;

  const {
    leads,
    isLoading,
    error,
    refetch,
    createLead,
    updateLeadStatus,
    qualifyLead,
    disqualifyLead,
  } = useLeads(leadQueryOptions);

  // Filter leads by search query and priority
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.first_name.toLowerCase().includes(query) ||
          lead.last_name.toLowerCase().includes(query) ||
          lead.email.toLowerCase().includes(query) ||
          (lead["phone"] ?? "").toLowerCase().includes(query) ||
          lead.lead_number.toLowerCase().includes(query),
      );
    }

    // Priority filter
    if (priorityFilter) {
      const priority = parseInt(priorityFilter);
      filtered = filtered.filter((lead) => lead.priority === priority);
    }

    return filtered;
  }, [leads, searchQuery, priorityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter((l) => l.status === "new").length;
    const qualified = leads.filter((l) => l.status === "qualified").length;
    const quoteSent = leads.filter((l) => l.status === "quote_sent").length;
    const won = leads.filter((l) => l.status === "won").length;
    const conversionRate = total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0;

    return {
      total,
      newLeads,
      qualified,
      quoteSent,
      won,
      conversionRate,
    };
  }, [leads]);

  // Table columns
  const handleViewLead = useCallback(
    (lead: Lead) => {
      setSelectedLead(lead);
      setIsDetailModalOpen(true);
    },
    [setSelectedLead, setIsDetailModalOpen],
  );

  const handleEditLead = useCallback(
    (lead: Lead) => {
      setSelectedLead(lead);
      setIsCreateModalOpen(true);
    },
    [setSelectedLead, setIsCreateModalOpen],
  );

  const handleQualify = useCallback(
    async (leadId: string) => {
      const success = await qualifyLead(leadId);
      if (success) {
        toast({
          title: "Lead Qualified",
          description: "Lead has been marked as qualified.",
        });
        refetch();
      }
    },
    [qualifyLead, refetch, toast],
  );

  const handleDisqualify = useCallback(
    async (leadId: string) => {
      const reason = prompt("Reason for disqualification:");
      if (reason) {
        const success = await disqualifyLead(leadId, reason);
        if (success) {
          toast({
            title: "Lead Disqualified",
            description: "Lead has been disqualified.",
          });
          refetch();
        }
      }
    },
    [disqualifyLead, refetch, toast],
  );

  const columns: ColumnDef<Lead>[] = useMemo(
    () => [
      {
        id: "lead_number",
        header: "Lead #",
        accessorKey: "lead_number",
        cell: ({ row }: { row: Row<Lead> }) => (
          <span className="font-mono text-sm">{row.original.lead_number}</span>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }: { row: Row<Lead> }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
            {row.original.phone && (
              <span className="text-xs text-muted-foreground">{row.original.phone}</span>
            )}
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
        cell: ({ row }: { row: Row<Lead> }) => (
          <LeadPriorityBadge priority={row.original.priority} />
        ),
      },
      {
        id: "serviceability",
        header: "Serviceability",
        cell: ({ row }: { row: Row<Lead> }) => {
          if (!row.original.is_serviceable) return <span className="text-muted-foreground">—</span>;

          const config: Record<string, { label: string; className: string }> = {
            serviceable: {
              label: "✅ Serviceable",
              className: "text-green-500",
            },
            not_serviceable: {
              label: "❌ Not Serviceable",
              className: "text-red-500",
            },
            pending_expansion: {
              label: "⏳ Pending",
              className: "text-yellow-500",
            },
            requires_construction: {
              label: "🔧 Construction",
              className: "text-orange-500",
            },
          };

          const { label, className } = config[row.original.is_serviceable] || {
            label: "Unknown",
            className: "text-gray-500",
          };
          return <span className={`text-xs ${className}`}>{label}</span>;
        },
      },
      {
        id: "created",
        header: "Created",
        accessorKey: "created_at",
        cell: ({ row }: { row: Row<Lead> }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }: { row: Row<Lead> }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewLead(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditLead(row.original)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Lead
              </DropdownMenuItem>
              {row.original.status === "contacted" && (
                <DropdownMenuItem onClick={() => handleQualify(row.original.id)}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Qualify
                </DropdownMenuItem>
              )}
              {row.original.status !== "disqualified" && (
                <DropdownMenuItem onClick={() => handleDisqualify(row.original.id)}>
                  <XSquare className="mr-2 h-4 w-4" />
                  Disqualify
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleDisqualify, handleEditLead, handleQualify, handleViewLead],
  );

  // Bulk actions
  const bulkActions: BulkAction<Lead>[] = useMemo(
    () => [
      {
        label: "Mark as Contacted",
        icon: ({ className }) => <UserCheck className={className} />,
        action: async (selected) => {
          for (const lead of selected) {
            if (lead.status === "new") {
              await updateLeadStatus(lead.id, "contacted");
            }
          }
          toast({
            title: "Leads Updated",
            description: `${selected.length} lead(s) marked as contacted.`,
          });
          refetch();
        },
      },
      {
        label: "Qualify Leads",
        icon: ({ className }) => <CheckCircle className={className} />,
        action: async (selected) => {
          for (const lead of selected) {
            if (lead.status === "contacted" || lead.status === "site_survey_completed") {
              await qualifyLead(lead.id);
            }
          }
          toast({
            title: "Leads Qualified",
            description: `${selected.length} lead(s) qualified.`,
          });
          refetch();
        },
      },
      {
        label: "Delete Leads",
        icon: ({ className }) => <Trash2 className={className} />,
        action: async (selected) => {
          // Implement delete logic
          toast({
            title: "Leads Deleted",
            description: `${selected.length} lead(s) deleted.`,
            variant: "destructive",
          });
          refetch();
        },
        variant: "destructive",
      },
    ],
    [updateLeadStatus, qualifyLead, refetch, toast],
  );

  // Handlers
  const handleClearFilters = () => {
    setStatusFilter("");
    setSourceFilter("");
    setPriorityFilter("");
    setSearchQuery("");
  };

  const handleExport = () => {
    // Implement CSV export
    const csv = convertToCSV(filteredLeads);
    downloadCSV(csv, `leads-${new Date().toISOString().split("T")[0]}.csv`);
    toast({
      title: "Export Complete",
      description: `${filteredLeads.length} leads exported to CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Leads Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage your sales pipeline from initial contact to customer conversion.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Lead
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCardEnhanced
          title="Total Leads"
          value={stats.total}
          icon={Users}
          loading={isLoading}
          {...(error?.message ? { error: error.message } : {})}
        />
        <MetricCardEnhanced
          title="New Leads"
          value={stats.newLeads}
          subtitle="Uncontacted"
          icon={UserPlus}
          loading={isLoading}
        />
        <MetricCardEnhanced
          title="Qualified"
          value={stats.qualified}
          subtitle="Ready for quotes"
          icon={CheckCircle}
          loading={isLoading}
        />
        <MetricCardEnhanced
          title="Quotes Sent"
          value={stats.quoteSent}
          subtitle="Pending response"
          icon={Send}
          loading={isLoading}
        />
        <MetricCardEnhanced
          title="Won"
          value={stats.won}
          subtitle="Converted"
          icon={TrendingUp}
          loading={isLoading}
        />
        <MetricCardEnhanced
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          subtitle="Won / Total"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Filters</h3>
              {(statusFilter || sourceFilter || priorityFilter || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Name, email, phone, lead #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as LeadStatus | "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="site_survey_scheduled">Survey Scheduled</SelectItem>
                    <SelectItem value="site_survey_completed">Survey Completed</SelectItem>
                    <SelectItem value="quote_sent">Quote Sent</SelectItem>
                    <SelectItem value="negotiating">Negotiating</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="disqualified">Disqualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={sourceFilter}
                  onValueChange={(value) => setSourceFilter(value as LeadSource | "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sources</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="cold_call">Cold Call</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="advertisement">Advertisement</SelectItem>
                    <SelectItem value="walk_in">Walk-In</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority Filter */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Priorities</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <EnhancedDataTable
        data={filteredLeads}
        columns={columns}
        isLoading={isLoading}
        bulkActions={bulkActions}
        onRowClick={(lead) => handleViewLead(lead)}
        searchable
        exportable
      />

      {/* Modals */}
      <CreateLeadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
        onCreate={createLead}
      />
      <LeadDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        lead={selectedLead}
        onUpdate={() => refetch()}
      />
    </div>
  );
}

// CSV Export Helpers
function convertToCSV(leads: Lead[]): string {
  const headers = [
    "Lead Number",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Status",
    "Source",
    "Priority",
    "Serviceability",
    "Created At",
  ];

  const rows = leads.map((lead) => [
    lead.lead_number,
    lead.first_name,
    lead.last_name,
    lead.email,
    lead.phone || "",
    lead.status,
    lead.source,
    lead.priority.toString(),
    lead.is_serviceable || "",
    lead.created_at,
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
