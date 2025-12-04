"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  ArrowLeft,
  Ticket,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader,
  MessageSquare,
  User,
  Calendar,
  Send,
  Edit,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketData {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  organization_slug?: string;
  assigned_to?: string;
  tags?: string[];
  metadata?: any;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  author_id: string;
  author_name?: string;
  author_email?: string;
  is_staff: boolean;
  content: string;
  is_internal: boolean;
  created_at: string;
}

function TicketDetailsPageContent() {
  const params = useParams();
  const ticketId = params?.["ticketId"] as string;
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  // Fetch ticket details
  const { data: ticket, isLoading } = useQuery<TicketData>({
    queryKey: ["ticket", apiBaseUrl, ticketId],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/tickets/${ticketId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch ticket");
      return response.json();
    },
    enabled: !!ticketId,
  });

  // Fetch ticket messages
  const { data: messages = [] } = useQuery<TicketMessage[]>({
    queryKey: ["ticket-messages", apiBaseUrl, ticketId],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/tickets/${ticketId}/messages`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!ticketId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update ticket mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TicketData>) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update ticket");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", apiBaseUrl, ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Ticket updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          is_internal: isInternal,
        }),
      });
      if (!response.ok) throw new Error("Failed to add message");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", apiBaseUrl, ticketId] });
      setNewMessage("");
      setIsInternal(false);
      toast({ title: "Message added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: TicketStatus) => {
    const statusConfig: Record<TicketStatus, { icon: any; color: string; label: string }> = {
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
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={priorityColors[priority] || "bg-gray-100 text-gray-800"}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ticket Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The ticket you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/ticketing">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tickets
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/ticketing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-mono">{ticket.ticket_number}</h1>
            <p className="text-sm text-muted-foreground">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(ticket.status)}
          {getPriorityBadge(ticket.priority)}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Select
              value={ticket.status}
              onValueChange={(value) => updateMutation.mutate({ status: value as TicketStatus })}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={ticket.priority}
              onValueChange={(value) =>
                updateMutation.mutate({ priority: value as TicketPriority })
              }
              disabled={updateMutation.isPending}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{ticket.customer_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{ticket.customer_email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer ID</p>
                  <p className="font-medium font-mono">{ticket.customer_id || "N/A"}</p>
                </div>
                {ticket.organization_slug && (
                  <div>
                    <p className="text-sm text-muted-foreground">Organization</p>
                    <p className="font-medium">{ticket.organization_slug}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ticket Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{ticket.category || "General"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{ticket.assigned_to || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(ticket.created_at), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{format(new Date(ticket.updated_at), "PPpp")}</p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                    <p className="font-medium">{format(new Date(ticket.resolved_at), "PPpp")}</p>
                  </div>
                )}
                {ticket.closed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Closed</p>
                    <p className="font-medium">{format(new Date(ticket.closed_at), "PPpp")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {ticket.tags && ticket.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          {/* Message List */}
          <div className="space-y-4">
            {messages.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No messages yet
                </CardContent>
              </Card>
            ) : (
              messages.map((message) => (
                <Card
                  key={message.id}
                  className={message.is_internal ? "border-yellow-200 bg-yellow-50/50" : ""}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <User
                          className={`h-8 w-8 ${message.is_staff ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div>
                          <CardTitle className="text-base">
                            {message.author_name || message.author_email || "Unknown"}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(message.created_at), "PPpp")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {message.is_staff && (
                          <Badge className="bg-purple-100 text-purple-800">Staff</Badge>
                        )}
                        {message.is_internal && (
                          <Badge className="bg-yellow-100 text-yellow-800">Internal</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Add Message Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Message</CardTitle>
              <CardDescription>Reply to this ticket</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={4}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="internal"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="internal"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Internal note (not visible to customer)
                  </label>
                </div>
                <Button
                  onClick={() => addMessageMutation.mutate(newMessage)}
                  disabled={!newMessage.trim() || addMessageMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
              <CardDescription>Additional ticket information</CardDescription>
            </CardHeader>
            <CardContent>
              {ticket["metadata"] ? (
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(ticket.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">No additional metadata</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TicketDetailsPage() {
  return (
    <RouteGuard permission="tickets:read">
      <TicketDetailsPageContent />
    </RouteGuard>
  );
}
