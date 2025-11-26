"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Loader,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  TicketPriority,
  TicketStatus,
  useAddMessage,
  useTicket,
  useUpdateTicket,
} from "@/hooks/useTicketing";

function TicketDetailsPageContent() {
  const params = useParams();
  const ticketId = params?.['ticketId'] as string;
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");

  const { ticket, loading: ticketLoading, refetch } = useTicket(ticketId, true);
  const { updateTicketAsync, loading: updating } = useUpdateTicket();
  const { addMessageAsync, loading: addingMessage } = useAddMessage();

  const getStatusBadge = (status: TicketStatus) => {
    const statusConfig: Record<TicketStatus, { icon: React.ElementType; color: string; label: string }> = {
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

  if (ticketLoading) {
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
        <p className="text-muted-foreground mb-4">The ticket you&apos;re looking for doesn&apos;t exist.</p>
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
              onValueChange={async (value) => {
                await updateTicketAsync(ticketId, { status: value as TicketStatus });
                toast({ title: "Ticket updated successfully" });
                refetch();
              }}
              disabled={updating}
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
              onValueChange={async (value) => {
                await updateTicketAsync(ticketId, { priority: value as TicketPriority });
                toast({ title: "Ticket updated successfully" });
                refetch();
              }}
              disabled={updating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
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
          <TabsTrigger value="messages">Messages ({ticket.messages.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{ticket.customer_id || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer ID</p>
                  <p className="font-medium font-mono">{ticket.customer_id || "N/A"}</p>
                </div>
                {ticket.service_address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Service Address</p>
                    <p className="font-medium">{ticket.service_address}</p>
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
                  <p className="font-medium">{ticket.ticket_type || "General"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">
                    {ticket.assigned_to_user_id ? ticket.assigned_to_user_id : "Unassigned"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(ticket.created_at), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{format(new Date(ticket.updated_at), "PPpp")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          {/* Message List */}
          <div className="space-y-4">
            {ticket.messages.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No messages yet
                </CardContent>
              </Card>
            ) : (
              ticket.messages.map((message) => (
                <Card key={message.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-base">
                            {message.sender_user_id || "Unknown"}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(message.created_at), "PPpp")}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{message.body}</p>
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
                <Button
                  onClick={async () => {
                    if (!newMessage.trim()) return;
                    await addMessageAsync(ticketId, { message: newMessage });
                    setNewMessage("");
                    refetch();
                    toast({ title: "Message added successfully" });
                  }}
                  disabled={!newMessage.trim() || addingMessage}
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
              {ticket.context && Object.keys(ticket.context || {}).length > 0 ? (
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(ticket.context, null, 2)}
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
