"use client";

import { useState } from "react";
import { Calendar, User, FileText, Loader2, MapPin } from "lucide-react";
import { useLeads, useSiteSurveys } from "@/hooks/useCRM";
import type { Lead, SiteSurveyScheduleRequest } from "@/hooks/useCRM";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";

interface ScheduleSurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  onSuccess?: () => void;
}

export function ScheduleSurveyModal({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: ScheduleSurveyModalProps) {
  const { toast } = useToast();
  const { leads } = useLeads({});
  const { scheduleSurvey } = useSiteSurveys({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    lead_id: leadId || "",
    scheduled_date: "",
    scheduled_time: "",
    technician_id: "",
    notes: "",
  });

  // Get qualified leads for dropdown
  const qualifiedLeads = leads.filter(
    (lead) => lead.status === "qualified" || lead.status === "contacted",
  );

  // Find selected lead for display
  const selectedLead = leads.find((lead) => lead.id === formData.lead_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lead_id) {
      toast({
        title: "Validation Error",
        description: "Please select a lead",
        variant: "destructive",
      });
      return;
    }

    if (!formData.scheduled_date || !formData.scheduled_time) {
      toast({
        title: "Validation Error",
        description: "Please select date and time",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time into ISO string
      const scheduledDateTime = new Date(
        `${formData.scheduled_date}T${formData.scheduled_time}`,
      ).toISOString();

      const surveyData: SiteSurveyScheduleRequest = {
        lead_id: formData.lead_id,
        scheduled_date: scheduledDateTime,
      };
      if (formData.technician_id) {
        surveyData.technician_id = formData.technician_id;
      }
      if (formData.notes.trim()) {
        surveyData.notes = formData.notes.trim();
      }

      const survey = await scheduleSurvey(surveyData);

      if (survey) {
        toast({
          title: "Survey Scheduled",
          description: `Survey ${survey.survey_number} has been scheduled successfully`,
        });

        // Reset form
        setFormData({
          lead_id: leadId || "",
          scheduled_date: "",
          scheduled_time: "",
          technician_id: "",
          notes: "",
        });

        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule survey",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule Site Survey</DialogTitle>
          <DialogDescription>
            Schedule a technical assessment for a lead&apos;s service location
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lead Selection */}
          <div className="space-y-2">
            <Label htmlFor="lead_id">
              Lead <span className="text-red-500">*</span>
            </Label>
            {leadId ? (
              <div className="p-3 border rounded-md bg-muted">
                <p className="font-medium">
                  {selectedLead?.first_name} {selectedLead?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{selectedLead?.email}</p>
              </div>
            ) : (
              <Select
                value={formData.lead_id}
                onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
              >
                <SelectTrigger id="lead_id">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  {qualifiedLeads.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No qualified leads available
                    </div>
                  ) : (
                    qualifiedLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name} - {lead.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Service Location Display */}
          {selectedLead && (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>Service Location</AlertTitle>
              <AlertDescription className="mt-2 text-sm">
                <div>
                  {selectedLead.service_address_line1}
                  {selectedLead.service_address_line2 && `, ${selectedLead.service_address_line2}`}
                </div>
                <div>
                  {selectedLead.service_city}, {selectedLead.service_state_province}{" "}
                  {selectedLead.service_postal_code}
                </div>
                <div>{selectedLead.service_country}</div>
              </AlertDescription>
            </Alert>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_time">
                Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduled_time"
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Technician Assignment */}
          <div className="space-y-2">
            <Label htmlFor="technician_id">Assign Technician</Label>
            <Select
              value={formData.technician_id}
              onValueChange={(value) => setFormData({ ...formData, technician_id: value })}
            >
              <SelectTrigger id="technician_id">
                <SelectValue placeholder="Select a technician (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech-1">John Smith</SelectItem>
                <SelectItem value="tech-2">Sarah Johnson</SelectItem>
                <SelectItem value="tech-3">Mike Davis</SelectItem>
                <SelectItem value="tech-4">Emily Brown</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optionally assign a technician now, or assign later
            </p>
          </div>

          {/* Instructions/Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Instructions for Technician</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any special instructions, access codes, contact information, or equipment requirements..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Examples: gate codes, contact person on-site, special equipment needed, access
              restrictions, etc.
            </p>
          </div>

          {/* Information Alert */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>What Happens Next</AlertTitle>
            <AlertDescription className="text-xs mt-2 space-y-1">
              <ul className="list-disc list-inside space-y-1">
                <li>Survey will be created with status &quot;Scheduled&quot;</li>
                <li>Assigned technician will receive notification</li>
                <li>Lead status will update to &quot;Site Survey Scheduled&quot;</li>
                <li>Technician can start survey when arriving on-site</li>
                <li>After completion, lead serviceability will be updated</li>
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Survey
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
