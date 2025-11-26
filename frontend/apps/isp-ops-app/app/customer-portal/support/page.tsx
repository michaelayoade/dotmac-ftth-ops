"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  Headphones,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCustomerTickets } from "@/hooks/useCustomerPortal";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "high" | "urgent";

export default function CustomerSupportPage() {
  const { toast } = useToast();
  const { tickets, loading, createTicket, refetch } = useCustomerTickets();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "",
    priority: "normal" as TicketPriority,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  const filteredTickets =
    tickets?.filter((ticket) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || ticket.status === filterStatus;
      return matchesSearch && matchesStatus;
    }) || [];

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description || !newTicket.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createTicket(newTicket);

      toast({
        title: "Ticket Created",
        description:
          "Your support ticket has been submitted successfully. We&apos;ll respond shortly.",
      });

      setNewTicket({
        subject: "",
        description: "",
        category: "",
        priority: "normal",
      });
      setIsCreateDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Failed to Create Ticket",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    const config = {
      open: {
        label: "Open",
        className: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: AlertCircle,
      },
      in_progress: {
        label: "In Progress",
        className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        icon: Clock,
      },
      resolved: {
        label: "Resolved",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
        icon: CheckCircle,
      },
      closed: {
        label: "Closed",
        className: "bg-gray-500/20 text-gray-300 border-gray-500/30",
        icon: XCircle,
      },
    };

    const statusConfig = config[status];
    const Icon = statusConfig.icon;

    return (
      <Badge variant="outline" className={statusConfig.className}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const config = {
      low: { label: "Low", className: "bg-gray-500/20 text-gray-300" },
      normal: { label: "Normal", className: "bg-blue-500/20 text-blue-300" },
      high: { label: "High", className: "bg-orange-500/20 text-orange-300" },
      urgent: { label: "Urgent", className: "bg-red-500/20 text-red-300" },
    };

    const priorityConfig = config[priority];

    return (
      <Badge variant="outline" className={priorityConfig.className}>
        {priorityConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">Get help with your service</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we&apos;ll help you resolve it
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                      <SelectItem value="account">Account Management</SelectItem>
                      <SelectItem value="service">Service Request</SelectItem>
                      <SelectItem value="general">General Inquiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(v) =>
                      setNewTicket({
                        ...newTicket,
                        priority: v as TicketPriority,
                      })
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about your issue..."
                  rows={6}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Ticket"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Help Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Call Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Speak with a support representative
            </p>
            <p className="text-lg font-bold">1-800-123-4567</p>
            <p className="text-xs text-muted-foreground mt-1">Available 24/7</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Live Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Chat with our support team</p>
            <Button variant="outline" className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-5 w-5" />
              Help Center
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Browse FAQs and guides</p>
            <Button variant="outline" className="w-full">
              Browse Articles
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* My Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            My Support Tickets
          </CardTitle>
          <CardDescription>Track your support requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tickets List */}
          <div className="space-y-3">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tickets found</p>
                {searchQuery && (
                  <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-lg border hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ticket.ticket_number}</span>
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <h3 className="font-semibold">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Category: {ticket.category}</span>
                        <span>•</span>
                        <span>
                          Created{" "}
                          {formatDistanceToNow(new Date(ticket.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          Updated{" "}
                          {formatDistanceToNow(new Date(ticket.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
