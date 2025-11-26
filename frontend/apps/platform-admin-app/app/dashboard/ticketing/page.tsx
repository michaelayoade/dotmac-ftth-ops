"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";
import {
  TicketPriority,
  TicketStatus,
  useTicketStats,
  useTickets,
  TicketSummary,
} from "@/hooks/useTicketing";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

function TicketingPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const {
    tickets,
    loading: ticketsLoading,
    refetch,
  } = useTickets({
    status: statusFilter !== "all" ? (statusFilter as TicketStatus) : undefined,
    priority: priorityFilter !== "all" ? (priorityFilter as TicketPriority) : undefined,
    search: searchQuery || undefined,
  });

  const { stats, loading: statsLoading } = useTicketStats();

  const countStats = stats || {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    waiting: tickets.filter((t) => t.status === "waiting").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
    by_priority: { low: 0, normal: 0, high: 0, urgent: 0 },
    by_type: {},
    sla_breached: 0,
  };

  const filteredTickets: TicketSummary[] = tickets;

  const getStatusBadge = (status: TicketStatus) => {
    const statusConfig: Record<
      TicketStatus,
      { icon: React.ElementType; color: string; label: string }
    > = {
      open: { icon: AlertCircle, color: "bg-blue-100 text-blue-800", label: "Open" },
      in_progress: { icon: Loader, color: "bg-yellow-100 text-yellow-800", label: "In Progress" },
      waiting: { icon: Clock, color: "bg-orange-100 text-orange-800", label: "Waiting" },
      resolved: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Resolved" },
      closed: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Closed" },
    };

    const config = statusConfig[status] || statusConfig.open;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const priorityColors: Record<TicketPriority, string> = {
      low: "bg-gray-100 text-gray-800",
      normal: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={priorityColors[priority] || "bg-gray-100 text-gray-800"}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer support tickets and requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.total}</div>
            <p className="text-xs text-muted-foreground">All tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.open}</div>
            <p className="text-xs text-muted-foreground">New tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.in_progress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.waiting}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.resolved}</div>
            <p className="text-xs text-muted-foreground">Fixed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countStats.closed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
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

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Grid */}
      <div className="grid gap-4">
        {ticketsLoading || statsLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading tickets...
            </CardContent>
          </Card>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No tickets match your search" : "No tickets found"}
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Ticket className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        <Link
                          href={`/dashboard/ticketing/${ticket.id}`}
                          className="hover:underline font-mono"
                        >
                          {ticket.ticket_number}
                        </Link>
                      </CardTitle>
                      <CardDescription className="mt-1">{ticket.subject}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(ticket.status)}
                    {getPriorityBadge(ticket.priority)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium truncate">
                      {ticket.customer_id || ticket.tenant_id || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{ticket.ticket_type || "General"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">
                      {ticket.assigned_to_user_id ? ticket.assigned_to_user_id : "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Updated</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/ticketing/${ticket.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function TicketingPage() {
  return (
    <RouteGuard permission="tickets:read">
      <TicketingPageContent />
    </RouteGuard>
  );
}
