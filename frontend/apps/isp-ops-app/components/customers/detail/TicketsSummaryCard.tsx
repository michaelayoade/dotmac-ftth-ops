"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Ticket, AlertCircle } from "lucide-react";
import Link from "next/link";

interface TicketsSummaryCardProps {
  tickets: {
    open: number;
    closed: number;
    critical: number;
  };
  customerId: string;
}

export function TicketsSummaryCard({ tickets, customerId }: TicketsSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Support Tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Open Tickets</span>
          <span className="text-2xl font-bold">{tickets.open}</span>
        </div>
        <div className="space-y-2">
          {tickets.critical > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                Critical
              </span>
              <Badge variant="destructive">{tickets.critical}</Badge>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Closed</span>
            <span className="font-medium">{tickets.closed}</span>
          </div>
        </div>
        <div className="pt-2 border-t">
          <Link
            href={`/dashboard/operations/customers/${customerId}/tickets`}
            className="text-sm text-primary hover:underline"
          >
            View All Tickets →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
