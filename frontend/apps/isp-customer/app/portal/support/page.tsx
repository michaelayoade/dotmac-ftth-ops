"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Headphones, CheckCircle, Loader2 } from "lucide-react";
import { useCustomerTickets } from "@/hooks/useCustomerPortal";

export default function SupportPage() {
  const { tickets, loading } = useCustomerTickets();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">Get help and track your support requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Support Tickets
          </CardTitle>
          <CardDescription>Your support requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <Headphones className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No support tickets yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Need help? Create a new support ticket to get assistance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.ticket_number} &bull;{" "}
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{ticket.category}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      ticket.status === "resolved" || ticket.status === "closed"
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : ticket.status === "in_progress"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                          : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                    }
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {ticket.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
