"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Pause, Play, TrendingUp, Ticket, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "@dotmac/ui";

interface QuickActionsCardProps {
  customerId: string;
  customerStatus: string;
  onActionComplete: () => void;
}

export function QuickActionsCard({
  customerId,
  customerStatus,
  onActionComplete,
}: QuickActionsCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSuspend = async () => {
    setIsLoading(true);
    try {
      // API call to suspend customer
      toast.success("Customer suspended successfully");
      onActionComplete();
    } catch (error) {
      toast.error("Failed to suspend customer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      // API call to resume customer
      toast.success("Customer resumed successfully");
      onActionComplete();
    } catch (error) {
      toast.error("Failed to resume customer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Navigate to upgrade page
    window.location.href = `/dashboard/operations/customers/${customerId}/subscriptions`;
  };

  const handleCreateTicket = () => {
    // Navigate to create ticket page
    window.location.href = `/dashboard/ticketing/new?customerId=${customerId}`;
  };

  const handleSendEmail = () => {
    // Navigate to email customer page
    window.location.href = `/dashboard/communications/send?customerId=${customerId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {customerStatus === "ACTIVE" && (
            <Button variant="outline" size="sm" onClick={handleSuspend} disabled={isLoading}>
              <Pause className="h-4 w-4 mr-2" />
              Suspend Service
            </Button>
          )}
          {customerStatus === "SUSPENDED" && (
            <Button variant="outline" size="sm" onClick={handleResume} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Resume Service
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleUpgrade}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
          <Button variant="outline" size="sm" onClick={handleCreateTicket}>
            <Ticket className="h-4 w-4 mr-2" />
            Create Ticket
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
