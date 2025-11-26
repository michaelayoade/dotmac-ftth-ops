import { useState, useEffect, useCallback } from "react";
import {
  Ticket,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";

interface CustomerTicket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  category: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
}

interface CustomerTicketsProps {
  customerId: string;
}

const getStatusBadge = (status: CustomerTicket["status"]) => {
  switch (status) {
    case "open":
      return (
        <Badge variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          Open
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-blue-500">
          <Clock className="w-3 h-3 mr-1" />
          In Progress
        </Badge>
      );
    case "resolved":
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Resolved
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="secondary">
          <XCircle className="w-3 h-3 mr-1" />
          Closed
        </Badge>
      );
  }
};

const getPriorityBadge = (priority: CustomerTicket["priority"]) => {
  switch (priority) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-500">High</Badge>;
    case "medium":
      return <Badge className="bg-yellow-500">Medium</Badge>;
    case "low":
      return <Badge variant="outline">Low</Badge>;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function CustomerTickets({ customerId }: CustomerTicketsProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ tickets: CustomerTicket[] }>(
        `/api/v1/customers/${customerId}/tickets`,
      );
      setTickets(response.data.tickets);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = () => {
    window.open(`/tenant/tickets/new?customer_id=${customerId}`, "_blank");
  };

  const handleViewTicket = (ticketId: string) => {
    window.open(`/tenant/tickets/${ticketId}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading tickets...</div>
      </div>
    );
  }

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const closedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Support Tickets</h3>
          <p className="text-sm text-slate-500 mt-1">
            {openTickets.length} open, {closedTickets.length} closed
          </p>
        </div>
        <Button onClick={handleCreateTicket}>
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Support Tickets</h3>
          <p className="text-slate-500 mb-4">This customer has no support tickets.</p>
          <Button onClick={handleCreateTicket}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Ticket
          </Button>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-400">Ticket #</TableHead>
                <TableHead className="text-slate-400">Title</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Priority</TableHead>
                <TableHead className="text-slate-400">Created</TableHead>
                <TableHead className="text-slate-400">Assigned To</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="border-slate-700">
                  <TableCell className="font-medium text-white font-mono">
                    #{ticket.ticket_number}
                  </TableCell>
                  <TableCell className="text-white">
                    {ticket.title}
                    <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {ticket.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <Badge variant="outline">{ticket.category}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell className="text-slate-300 text-sm">
                    {formatDate(ticket.created_at)}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {ticket.assigned_to || "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewTicket(ticket.id)}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
