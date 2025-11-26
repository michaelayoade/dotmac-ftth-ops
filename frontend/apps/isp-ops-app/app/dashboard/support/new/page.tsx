"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  useCreateTicket,
  type TicketPriority,
  type TicketType,
  type TicketActorType,
} from "@/hooks/useTicketing";

export default function NewTicketPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTicket, loading } = useCreateTicket();

  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    priority: "normal" as TicketPriority,
    ticketType: "" as TicketType | "",
    targetType: "tenant" as TicketActorType,
    serviceAddress: "",
    affectedServices: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData["subject"].trim() || !formData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject and message are required",
        variant: "destructive",
      });
      return;
    }

    const result = await createTicket({
      subject: formData["subject"],
      message: formData.message,
      target_type: formData.targetType,
      priority: formData.priority,
      ...(formData.ticketType ? { ticket_type: formData.ticketType } : {}),
      ...(formData.serviceAddress ? { service_address: formData.serviceAddress } : {}),
      ...(formData.affectedServices.length > 0
        ? { affected_services: formData.affectedServices }
        : {}),
    });

    if (result) {
      toast({
        title: "Ticket Created",
        description: `Ticket ${result.ticket_number} has been created successfully`,
      });
      router.push(`/dashboard/support/${result.id}`);
    }
  };

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedServices: prev.affectedServices.includes(service)
        ? prev.affectedServices.filter((s) => s !== service)
        : [...prev.affectedServices, service],
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/support")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New Ticket</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit a new support request</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Details</CardTitle>
            <CardDescription>Provide details about your support request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Brief description of the issue"
                value={formData["subject"]}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Detailed description of the issue..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={6}
                required
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v: TicketPriority) => setFormData({ ...formData, priority: v })}
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

              {/* Ticket Type */}
              <div className="space-y-2">
                <Label htmlFor="ticketType">Ticket Type</Label>
                <Select
                  value={formData.ticketType}
                  onValueChange={(v: TicketType) => setFormData({ ...formData, ticketType: v })}
                >
                  <SelectTrigger id="ticketType">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                    <SelectItem value="billing_issue">Billing Issue</SelectItem>
                    <SelectItem value="technical_support">Technical Support</SelectItem>
                    <SelectItem value="installation_request">Installation Request</SelectItem>
                    <SelectItem value="outage_report">Outage Report</SelectItem>
                    <SelectItem value="service_upgrade">Service Upgrade</SelectItem>
                    <SelectItem value="service_downgrade">Service Downgrade</SelectItem>
                    <SelectItem value="cancellation_request">Cancellation Request</SelectItem>
                    <SelectItem value="equipment_issue">Equipment Issue</SelectItem>
                    <SelectItem value="speed_issue">Speed Issue</SelectItem>
                    <SelectItem value="network_issue">Network Issue</SelectItem>
                    <SelectItem value="connectivity_issue">Connectivity Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Service Address */}
            <div className="space-y-2">
              <Label htmlFor="serviceAddress">Service Address (Optional)</Label>
              <Input
                id="serviceAddress"
                placeholder="Address where service is provided"
                value={formData.serviceAddress}
                onChange={(e) => setFormData({ ...formData, serviceAddress: e.target.value })}
              />
            </div>

            {/* Affected Services */}
            <div className="space-y-2">
              <Label>Affected Services (Optional)</Label>
              <div className="flex flex-wrap gap-2">
                {["internet", "voip", "tv", "phone"].map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => handleServiceToggle(service)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      formData.affectedServices.includes(service)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-input"
                    }`}
                  >
                    {service.charAt(0).toUpperCase() + service.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Type */}
            <div className="space-y-2">
              <Label htmlFor="targetType">Send To</Label>
              <Select
                value={formData.targetType}
                onValueChange={(v: TicketActorType) => setFormData({ ...formData, targetType: v })}
              >
                <SelectTrigger id="targetType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Tenant Support</SelectItem>
                  <SelectItem value="partner">Partner Support</SelectItem>
                  <SelectItem value="platform">Platform Support</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/support")}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
