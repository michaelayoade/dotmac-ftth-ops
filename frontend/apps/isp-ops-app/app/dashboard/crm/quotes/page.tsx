"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";

import { Button } from "@dotmac/ui";
import { Card, CardContent } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { EnhancedDataTable, type ColumnDef, type BulkAction } from "@dotmac/ui";
import { MetricCardEnhanced } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { useQuotes, type Quote, type QuoteStatus } from "@/hooks/useCRM";
import { QuoteStatusBadge } from "@/components/crm/Badges";
import { CreateQuoteModal } from "@/components/crm/CreateQuoteModal";
import { QuoteDetailModal } from "@/components/crm/QuoteDetailModal";
import { apiClient } from "@/lib/api/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";

export default function QuotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // Fetch quotes
  const { quotes, isLoading, error, refetch, sendQuote, createQuote } = useQuotes({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Delete quote function
  const deleteQuote = useCallback(async (quoteId: string) => {
    await apiClient.delete(`/crm/quotes/${quoteId}`);
  }, []);

  // Statistics
  const stats = useMemo(() => {
    if (!quotes)
      return {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
        acceptanceRate: 0,
        totalMRR: 0,
        expiringThisWeek: 0,
      };

    const total = quotes.length;
    const draft = quotes.filter((q) => q.status === "draft").length;
    const sent = quotes.filter((q) => q.status === "sent" || q.status === "viewed").length;
    const accepted = quotes.filter((q) => q.status === "accepted").length;
    const rejected = quotes.filter((q) => q.status === "rejected").length;
    const expired = quotes.filter((q) => q.status === "expired").length;

    const totalSent = sent + accepted + rejected + expired;
    const acceptanceRate = totalSent > 0 ? Number(((accepted / totalSent) * 100).toFixed(1)) : 0;

    const totalMRR = quotes
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + q.monthly_recurring_charge, 0);

    const today = new Date();
    const expiringThisWeek = quotes.filter((q) => {
      if (!q.valid_until || q.status !== "sent") return false;
      const daysUntilExpiry = differenceInDays(new Date(q.valid_until), today);
      return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
    }).length;

    return {
      total,
      draft,
      sent,
      accepted,
      rejected,
      expired,
      acceptanceRate,
      totalMRR,
      expiringThisWeek,
    };
  }, [quotes]);

  // Filtered quotes for search
  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    if (!searchQuery.trim()) return quotes;

    const query = searchQuery.toLowerCase();
    return quotes.filter(
      (quote) =>
        quote.quote_number.toLowerCase().includes(query) ||
        quote.service_plan_name.toLowerCase().includes(query) ||
        quote.bandwidth?.toLowerCase().includes(query),
    );
  }, [quotes, searchQuery]);

  // Quick filters
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  const quickFilteredQuotes = useMemo(() => {
    if (!quickFilter) return filteredQuotes;

    const today = new Date();

    switch (quickFilter) {
      case "draft":
        return filteredQuotes.filter((q) => q.status === "draft");
      case "sent":
        return filteredQuotes.filter((q) => q.status === "sent" || q.status === "viewed");
      case "accepted":
        return filteredQuotes.filter((q) => q.status === "accepted");
      case "expiring_soon":
        return filteredQuotes.filter((q) => {
          if (!q.valid_until || q.status !== "sent") return false;
          const daysUntilExpiry = differenceInDays(new Date(q.valid_until), today);
          return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
        });
      default:
        return filteredQuotes;
    }
  }, [filteredQuotes, quickFilter]);

  // Table columns
  const handleViewQuote = useCallback(
    (quote: Quote) => {
      setSelectedQuote(quote);
      setIsDetailModalOpen(true);
    },
    [setIsDetailModalOpen, setSelectedQuote],
  );

  const handleEditQuote = useCallback(
    (quote: Quote) => {
      setSelectedQuote(quote);
      setIsCreateModalOpen(true);
    },
    [setIsCreateModalOpen, setSelectedQuote],
  );

  const handleSendQuote = useCallback(
    async (quote: Quote) => {
      try {
        await sendQuote(quote.id);
        toast({
          title: "Quote Sent",
          description: `Quote ${quote.quote_number} has been sent to the lead.`,
        });
        refetch();
      } catch (error) {
        console.error("Failed to send quote:", error);
        toast({
          title: "Error",
          description: "Failed to send quote. Please try again.",
          variant: "destructive",
        });
      }
    },
    [refetch, sendQuote, toast],
  );

  const handleDeleteQuote = useCallback(
    async (quote: Quote) => {
      const confirmed = await confirmDialog({
        title: "Delete quote",
        description: `Are you sure you want to delete quote ${quote.quote_number}? This action cannot be undone.`,
        confirmText: "Delete quote",
        variant: "destructive",
      });
      if (!confirmed) return;

      try {
        await deleteQuote(quote.id);
        toast({
          title: "Quote Deleted",
          description: `Quote ${quote.quote_number} has been deleted.`,
        });
        refetch();
      } catch (error) {
        console.error("Failed to delete quote:", error);
        toast({
          title: "Error",
          description: "Failed to delete quote. Please try again.",
          variant: "destructive",
        });
      }
    },
    [confirmDialog, deleteQuote, refetch, toast],
  );

  const columns: ColumnDef<Quote>[] = useMemo(
    () => [
      {
        id: "quote_number",
        header: "Quote #",
        accessorKey: "quote_number",
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.quote_number}</span>,
      },
      {
        id: "service",
        header: "Service",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.service_plan_name}</span>
            {row.original.bandwidth && (
              <span className="text-xs text-muted-foreground">{row.original.bandwidth}</span>
            )}
          </div>
        ),
      },
      {
        id: "monthly_charge",
        header: "Monthly MRR",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">${row.original.monthly_recurring_charge.toFixed(2)}</span>
          </div>
        ),
      },
      {
        id: "upfront_cost",
        header: "Upfront",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            ${row.original.total_upfront_cost.toFixed(2)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => <QuoteStatusBadge status={row.original.status} />,
      },
      {
        id: "sent_at",
        header: "Sent",
        cell: ({ row }) => {
          if (!row.original.sent_at)
            return <span className="text-xs text-muted-foreground">Not sent</span>;
          return (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(row.original.sent_at), {
                addSuffix: true,
              })}
            </span>
          );
        },
      },
      {
        id: "valid_until",
        header: "Valid Until",
        cell: ({ row }) => {
          if (!row.original.valid_until)
            return <span className="text-xs text-muted-foreground">N/A</span>;

          const validUntil = new Date(row.original.valid_until);
          const today = new Date();
          const daysUntilExpiry = differenceInDays(validUntil, today);

          if (daysUntilExpiry < 0) {
            return (
              <div className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs">Expired</span>
              </div>
            );
          }

          if (daysUntilExpiry <= 7) {
            return (
              <div className="flex items-center gap-1 text-amber-400">
                <Clock className="h-3 w-3" />
                <span className="text-xs">{daysUntilExpiry}d left</span>
              </div>
            );
          }

          return (
            <span className="text-xs text-muted-foreground">{validUntil.toLocaleDateString()}</span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Open actions menu">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewQuote(row.original)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {row.original.status === "draft" && (
                <>
                  <DropdownMenuItem onClick={() => handleEditQuote(row.original)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Quote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSendQuote(row.original)}>
                    <Send className="h-4 w-4 mr-2" />
                    Send to Lead
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleDeleteQuote(row.original)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleDeleteQuote, handleEditQuote, handleSendQuote, handleViewQuote],
  );

  // Bulk actions
  const bulkActions: BulkAction<Quote>[] = [
    {
      label: "Send Quotes",
      icon: ({ className }) => <Send className={className} />,
      action: async (selectedQuotes) => {
        const draftQuotes = selectedQuotes.filter((q) => q.status === "draft");
        if (draftQuotes.length === 0) {
          toast({
            title: "No Draft Quotes",
            description: "Only draft quotes can be sent.",
            variant: "destructive",
          });
          return;
        }

        for (const quote of draftQuotes) {
          try {
            await sendQuote(quote.id);
          } catch (error) {
            console.error(`Failed to send quote ${quote.quote_number}:`, error);
          }
        }

        toast({
          title: "Quotes Sent",
          description: `${draftQuotes.length} quote(s) have been sent.`,
        });
        refetch();
      },
    },
    {
      label: "Delete Quotes",
      icon: ({ className }) => <Trash2 className={className} />,
      variant: "destructive",
      action: async (selectedQuotes) => {
        const confirmed = await confirmDialog({
          title: "Delete quotes",
          description: `Are you sure you want to delete ${selectedQuotes.length} quote(s)? This action cannot be undone.`,
          confirmText: "Delete quotes",
          variant: "destructive",
        });
        if (!confirmed) {
          return;
        }

        for (const quote of selectedQuotes) {
          try {
            await deleteQuote(quote.id);
          } catch (error) {
            console.error(`Failed to delete quote ${quote.quote_number}:`, error);
          }
        }

        toast({
          title: "Quotes Deleted",
          description: `${selectedQuotes.length} quote(s) have been deleted.`,
        });
        refetch();
      },
    },
  ];

  const handleExport = () => {
    if (!filteredQuotes.length) {
      toast({
        title: "No Data",
        description: "There are no quotes to export.",
        variant: "destructive",
      });
      return;
    }

    const csv = convertToCSV(filteredQuotes);
    const filename = `quotes-${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csv, filename);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredQuotes.length} quote(s) to CSV.`,
    });
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-red-400">Failed to load quotes. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground mt-1">Manage pricing proposals and service quotes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Create Quote
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <MetricCardEnhanced title="Total Quotes" value={stats.total} icon={FileText} />
        <MetricCardEnhanced title="Draft" value={stats.draft} icon={Edit} />
        <MetricCardEnhanced title="Sent" value={stats.sent} icon={Send} />
        <MetricCardEnhanced title="Accepted" value={stats.accepted} icon={CheckCircle} />
        <MetricCardEnhanced
          title="Acceptance Rate"
          value={`${stats.acceptanceRate}%`}
          icon={TrendingUp}
        />
        <MetricCardEnhanced
          title="Total MRR"
          value={`$${stats.totalMRR.toFixed(0)}`}
          icon={DollarSign}
        />
      </div>

      {/* Expiring Soon Alert */}
      {stats.expiringThisWeek > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div className="flex-1">
                <p className="font-medium text-amber-400">
                  {stats.expiringThisWeek} quote(s) expiring within 7 days
                </p>
                <p className="text-sm text-muted-foreground">
                  Follow up with leads to close deals before quotes expire
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuickFilter("expiring_soon")}>
                View Expiring
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={quickFilter === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() => setQuickFilter(quickFilter === "draft" ? null : "draft")}
        >
          Draft ({stats.draft})
        </Button>
        <Button
          variant={quickFilter === "sent" ? "default" : "outline"}
          size="sm"
          onClick={() => setQuickFilter(quickFilter === "sent" ? null : "sent")}
        >
          Sent ({stats.sent})
        </Button>
        <Button
          variant={quickFilter === "accepted" ? "default" : "outline"}
          size="sm"
          onClick={() => setQuickFilter(quickFilter === "accepted" ? null : "accepted")}
        >
          Accepted ({stats.accepted})
        </Button>
        <Button
          variant={quickFilter === "expiring_soon" ? "default" : "outline"}
          size="sm"
          onClick={() => setQuickFilter(quickFilter === "expiring_soon" ? null : "expiring_soon")}
        >
          <Clock className="h-4 w-4 mr-1" />
          Expiring Soon ({stats.expiringThisWeek})
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Input
              placeholder="Search by quote #, service, or bandwidth..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as QuoteStatus | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setQuickFilter(null);
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Table */}
      <EnhancedDataTable
        data={quickFilteredQuotes}
        columns={columns}
        isLoading={isLoading}
        bulkActions={bulkActions}
        onRowClick={(quote) => handleViewQuote(quote)}
        searchable
        exportable
      />

      {/* Modals */}
      <CreateQuoteModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedQuote(null);
        }}
        onSuccess={() => refetch()}
        quote={selectedQuote}
      />
      <QuoteDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedQuote(null);
        }}
        quote={selectedQuote}
        onUpdate={() => refetch()}
        onEdit={(quote) => {
          setSelectedQuote(quote);
          setIsDetailModalOpen(false);
          setIsCreateModalOpen(true);
        }}
      />
    </div>
  );
}

// CSV Export Helpers
function convertToCSV(quotes: Quote[]): string {
  const headers = [
    "Quote Number",
    "Service Plan",
    "Bandwidth",
    "Monthly MRR",
    "Upfront Cost",
    "Installation Fee",
    "Equipment Fee",
    "Activation Fee",
    "Contract Term (months)",
    "Status",
    "Sent At",
    "Valid Until",
    "Created At",
  ];

  const rows = quotes.map((quote) => [
    quote.quote_number,
    quote.service_plan_name,
    quote.bandwidth || "",
    quote.monthly_recurring_charge.toString(),
    quote.total_upfront_cost.toString(),
    quote.installation_fee.toString(),
    quote.equipment_fee.toString(),
    quote.activation_fee.toString(),
    quote.contract_term_months.toString(),
    quote.status,
    quote.sent_at || "",
    quote.valid_until || "",
    quote.created_at,
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
