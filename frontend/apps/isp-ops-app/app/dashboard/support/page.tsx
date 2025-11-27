"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Circle,
} from "lucide-react";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  useTickets,
  useTicketStats,
  type TicketStatus,
  type TicketPriority,
  type TicketSummary,
} from "@/hooks/useTicketing";

export default function SupportTicketsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { tickets, loading, refetch } = useTickets({
    status: statusFilter === "all" ? undefined : statusFilter,
    autoRefresh,
    refreshInterval: 30000,
  });

  const { stats, loading: statsLoading } = useTicketStats();

  // Filter tickets by search query
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.ticket_number.toLowerCase().includes(query) ||
      ticket.subject.toLowerCase().includes(query) ||
      (ticket.service_address ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track support requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/dashboard/support/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {!statsLoading && stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Total Tickets" value={stats.total} icon={Ticket} color="text-blue-500" />
          <StatCard title="Open" value={stats.open} icon={Circle} color="text-yellow-500" />
          <StatCard
            title="In Progress"
            value={stats.in_progress}
            icon={Clock}
            color="text-purple-500"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={CheckCircle2}
            color="text-green-500"
          />
          <StatCard
            title="SLA Breached"
            value={stats.sla_breached}
            icon={AlertCircle}
            color="text-red-500"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ticket number, subject, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket
            {filteredTickets.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets found</div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

interface TicketCardProps {
  ticket: TicketSummary;
  onClick: () => void;
}

function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <div
      className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.sla_breached && (
              <Badge variant="destructive" className="text-xs">
                SLA Breached
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {ticket.ticket_type && (
              <span className="capitalize">{ticket.ticket_type.replace(/_/g, " ")}</span>
            )}
            {ticket.service_address && <span>📍 {ticket.service_address}</span>}
            <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
            {ticket.last_response_at && (
              <span>Last update {new Date(ticket.last_response_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const variants: Record<TicketStatus, { variant: any; label: string; icon: any }> = {
    open: { variant: "default", label: "Open", icon: Circle },
    in_progress: { variant: "secondary", label: "In Progress", icon: Clock },
    waiting: { variant: "outline", label: "Waiting", icon: Clock },
    resolved: { variant: "success", label: "Resolved", icon: CheckCircle2 },
    closed: { variant: "secondary", label: "Closed", icon: XCircle },
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant as any} className="text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const variants: Record<TicketPriority, { variant: any; label: string }> = {
    low: { variant: "outline", label: "Low" },
    normal: { variant: "secondary", label: "Normal" },
    high: { variant: "default", label: "High" },
    urgent: { variant: "destructive", label: "Urgent" },
  };

  const config = variants[priority];

  return (
    <Badge variant={config.variant as any} className="text-xs">
      {config.label}
    </Badge>
  );
}
