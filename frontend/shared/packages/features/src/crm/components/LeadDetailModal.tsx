/**
 * Shared Lead Detail Modal
 *
 * Pure UI component for displaying and editing lead details.
 * Apps provide data and action handlers via props.
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  FileText,
  Users,
  MapPin,
  Edit2,
  Save,
  X,
  Clock,
  DollarSign,
  Wrench,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

import { type Lead, type Quote, type SiteSurvey } from "../types";

import {
  LeadStatusBadge,
  LeadSourceBadge,
  LeadPriorityBadge,
  QuoteStatusBadge,
  SurveyStatusBadge,
} from "./Badges";

export interface LeadUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  service_address_line1?: string;
  service_address_line2?: string;
  service_city?: string;
  service_state_province?: string;
  service_postal_code?: string;
  service_country?: string;
  priority?: number;
  notes?: string;
}

export interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  quotes: Quote[] | undefined;
  surveys: SiteSurvey[] | undefined;

  // Action callbacks
  onUpdate: (() => void) | undefined;
  onSave: ((leadId: string, data: Partial<LeadUpdateRequest>) => Promise<void>) | undefined;
  onQualify: ((leadId: string) => Promise<void>) | undefined;
  onDisqualify: ((leadId: string, reason: string) => Promise<void>) | undefined;
  onConvert: ((leadId: string) => Promise<void>) | undefined;

  // Loading states
  isSaving: boolean | undefined;
}

export function LeadDetailModal({
  isOpen,
  onClose,
  lead,
  quotes = [],
  surveys = [],
  onUpdate,
  onSave,
  onQualify,
  onDisqualify,
  onConvert,
  isSaving: isExternallySaving = false,
}: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditMode, setIsEditMode] = useState(false);
  const [newNote, setNewNote] = useState("");

  // Editable form state
  const [editData, setEditData] = useState<Partial<LeadUpdateRequest>>({});

  // Reset edit data when lead changes
  useEffect(() => {
    if (!lead) {
      setEditData({});
      return;
    }

    const nextData: Partial<LeadUpdateRequest> = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      service_address_line1: lead.service_address_line1,
      service_city: lead.service_city,
      service_state_province: lead.service_state_province,
      service_postal_code: lead.service_postal_code,
      service_country: lead.service_country,
      priority: lead.priority,
    };

    if (lead.phone) nextData.phone = lead.phone;
    if (lead.company_name) nextData.company_name = lead.company_name;
    if (lead.service_address_line2) nextData.service_address_line2 = lead.service_address_line2;
    if (lead.notes) nextData.notes = lead.notes;

    setEditData(nextData);
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
    if (!onSave) return;
    setIsEditMode(false);
    await onSave(lead.id, editData);
    if (onUpdate) onUpdate();
  };

  const handleQualify = async () => {
    if (!onQualify) return;
    await onQualify(lead.id);
    if (onUpdate) onUpdate();
  };

  const handleDisqualify = async () => {
    if (!onDisqualify) return;
    const reason = prompt("Please provide a reason for disqualification:");
    if (!reason) return;
    await onDisqualify(lead.id, reason);
    if (onUpdate) onUpdate();
  };

  const handleConvert = async () => {
    if (!onConvert) return;
    const confirmed = confirm(
      `Convert ${lead.first_name} ${lead.last_name} to a customer? This action cannot be undone.`,
    );
    if (!confirmed) return;
    await onConvert(lead.id);
    if (onUpdate) onUpdate();
    onClose();
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    // Parent component should handle note adding
    setNewNote("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {lead.first_name} {lead.last_name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm">{lead.lead_number}</span>
                <span>•</span>
                <LeadStatusBadge status={lead.status} />
                <span>•</span>
                <LeadSourceBadge source={lead.source} />
                <span>•</span>
                <LeadPriorityBadge priority={lead.priority} />
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isExternallySaving}>
                    <Save className="h-4 w-4 mr-1" />
                    {isExternallySaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {lead.status === "new" && (
            <Button size="sm" variant="outline" onClick={handleQualify}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Qualify
            </Button>
          )}
          {lead.status !== "disqualified" && lead.status !== "lost" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisqualify}
              className="text-red-400 hover:text-red-300"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Disqualify
            </Button>
          )}
          <Button size="sm" variant="outline">
            <Calendar className="h-4 w-4 mr-1" />
            Schedule Survey
          </Button>
          <Button size="sm" variant="outline">
            <FileText className="h-4 w-4 mr-1" />
            Create Quote
          </Button>
          {lead.status === "quote_sent" && (
            <Button size="sm" onClick={handleConvert}>
              <Users className="h-4 w-4 mr-1" />
              Convert to Customer
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="quotes">
              Quotes {quotes?.length ? `(${quotes.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="surveys">
              Surveys {surveys?.length ? `(${surveys.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.first_name || ""}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{lead.first_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.last_name || ""}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{lead.last_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {isEditMode ? (
                    <Input
                      type="email"
                      value={editData.email || ""}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{lead.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.phone || ""}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{lead.phone || "N/A"}</p>
                  )}
                </div>
                {lead.company_name && (
                  <div className="space-y-2 col-span-2">
                    <Label>Company</Label>
                    {isEditMode ? (
                      <Input
                        value={editData.company_name || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            company_name: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-sm">{lead.company_name}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Service Location */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Service Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Address Line 1</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.service_address_line1 || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          service_address_line1: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="text-sm">{lead.service_address_line1}</p>
                  )}
                </div>
                {(lead.service_address_line2 || isEditMode) && (
                  <div className="space-y-2 col-span-2">
                    <Label>Address Line 2</Label>
                    {isEditMode ? (
                      <Input
                        value={editData.service_address_line2 || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            service_address_line2: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-sm">{lead.service_address_line2}</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>City</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.service_city || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          service_city: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="text-sm">{lead.service_city}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>State/Province</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.service_state_province || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          service_state_province: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="text-sm">{lead.service_state_province}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  {isEditMode ? (
                    <Input
                      value={editData.service_postal_code || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          service_postal_code: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="text-sm">{lead.service_postal_code}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  {isEditMode ? (
                    <Select
                      value={editData.service_country || "US"}
                      onValueChange={(value) =>
                        setEditData({ ...editData, service_country: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="MX">Mexico</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{lead.service_country}</p>
                  )}
                </div>
              </div>

              {/* Serviceability Status */}
              <div className="mt-4 p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Serviceability Status</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(lead.is_serviceable as any) === "yes" && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Serviceable - Ready to proceed
                        </span>
                      )}
                      {(lead.is_serviceable as any) === "no" && (
                        <span className="text-red-400 flex items-center gap-1">
                          <XCircle className="h-4 w-4" />
                          Not Serviceable - Outside coverage area
                        </span>
                      )}
                      {(lead.is_serviceable as any) === "pending" && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Pending - Awaiting site survey
                        </span>
                      )}
                      {!lead.is_serviceable && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Not Checked - Schedule site survey
                        </span>
                      )}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Check Serviceability
                  </Button>
                </div>
              </div>
            </div>

            {/* Service Requirements */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service Requirements
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interested Services</Label>
                  <div className="flex flex-wrap gap-2">
                    {lead.interested_service_types?.length ? (
                      lead.interested_service_types.map((service) => (
                        <Badge key={service} variant="outline">
                          {service.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Not specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Desired Bandwidth</Label>
                  <p className="text-sm">{lead.desired_bandwidth || "Not specified"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Monthly Budget</Label>
                  <p className="text-sm">
                    {lead.estimated_monthly_budget
                      ? `$${lead.estimated_monthly_budget.toFixed(2)}`
                      : "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Desired Installation Date</Label>
                  <p className="text-sm">
                    {lead.desired_installation_date
                      ? new Date(lead.desired_installation_date).toLocaleDateString()
                      : "Not specified"}
                  </p>
                </div>
              </div>
            </div>

            {/* Lead Details */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Lead Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  {isEditMode ? (
                    <Select
                      value={editData.priority?.toString() || "2"}
                      onValueChange={(value) =>
                        setEditData({ ...editData, priority: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">High</SelectItem>
                        <SelectItem value="2">Medium</SelectItem>
                        <SelectItem value="3">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <LeadPriorityBadge priority={lead.priority} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Created</Label>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(lead.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {lead.assigned_to_id && (
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <p className="text-sm">User #{lead.assigned_to_id}</p>
                  </div>
                )}
                {lead.partner_id && (
                  <div className="space-y-2">
                    <Label>Partner Referral</Label>
                    <p className="text-sm">Partner #{lead.partner_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {lead.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Notes
                </h3>
                {isEditMode ? (
                  <Textarea
                    value={editData.notes || ""}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Timeline */}
          <TabsContent value="timeline" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Timeline items would be fetched from API */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="rounded-full bg-emerald-500/20 p-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="w-px h-full bg-border mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium">Lead Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                  <p className="text-sm mt-1">New lead from {lead.source.replace(/_/g, " ")}</p>
                </div>
              </div>

              {lead.qualified_at && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-emerald-500/20 p-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="w-px h-full bg-border mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Lead Qualified</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.qualified_at), {
                        addSuffix: true,
                      })}
                    </p>
                    <p className="text-sm mt-1">Lead meets qualification criteria</p>
                  </div>
                </div>
              )}

              {lead.converted_at && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-emerald-500/20 p-2">
                      <Users className="h-4 w-4 text-emerald-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Converted to Customer</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.converted_at), {
                        addSuffix: true,
                      })}
                    </p>
                    {lead.converted_to_customer_id && (
                      <p className="text-sm mt-1">Customer ID: {lead.converted_to_customer_id}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Quotes */}
          <TabsContent value="quotes" className="space-y-4 mt-4">
            {quotes && quotes.length > 0 ? (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm">{quote.quote_number}</span>
                          <QuoteStatusBadge status={quote.status} />
                        </div>
                        <p className="text-sm font-medium">{quote.service_plan_name}</p>
                        <p className="text-sm text-muted-foreground">{quote.bandwidth}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              ${quote.monthly_recurring_charge.toFixed(2)}/mo
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ${quote.total_upfront_cost.toFixed(2)} upfront
                          </div>
                        </div>
                        {quote.valid_until && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Valid until {new Date(quote.valid_until).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No Quotes Yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a quote to send to this lead
                </p>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Quote
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Surveys */}
          <TabsContent value="surveys" className="space-y-4 mt-4">
            {surveys && surveys.length > 0 ? (
              <div className="space-y-3">
                {surveys.map((survey: any) => (
                  <div
                    key={survey.id}
                    className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <SurveyStatusBadge status={survey.status} />
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {survey.scheduled_date &&
                              new Date(survey.scheduled_date).toLocaleDateString()}
                          </span>
                          {survey.scheduled_time && <span>at {survey.scheduled_time}</span>}
                        </div>
                        {survey.technician_id && (
                          <p className="text-sm text-muted-foreground">
                            Technician: #{survey.technician_id}
                          </p>
                        )}
                        {survey.serviceability_assessment && (
                          <div className="mt-2">
                            <Badge
                              variant={
                                survey.serviceability_assessment === "serviceable"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {survey.serviceability_assessment}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No Surveys Scheduled</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Schedule a site survey to assess serviceability
                </p>
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Survey
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 5: Notes */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Add a Note</Label>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={4}
                  className="mt-2"
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="mt-2"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>

              {/* Existing notes would be fetched from API */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Activity History</h4>
                <div className="space-y-3">
                  {lead.notes && (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Initial Note</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                  {!lead.notes && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No notes yet. Add one above to get started.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
