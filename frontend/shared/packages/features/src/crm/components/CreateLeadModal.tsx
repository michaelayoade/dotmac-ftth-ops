/**
 * Create Lead Modal - Shared Component
 *
 * Multi-tab form for creating new leads.
 * Parent components handle API calls via callbacks.
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dotmac/ui";
import { X } from "lucide-react";
import { useState } from "react";

import { type LeadSource } from "../types";

export interface LeadCreateRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name?: string | undefined;
  service_address_line1: string;
  service_address_line2?: string | undefined;
  service_city: string;
  service_state_province: string;
  service_postal_code: string;
  service_country: string;
  source: LeadSource;
  priority: number;
  interested_service_types: string[];
  desired_bandwidth?: string | undefined;
  estimated_monthly_budget?: number | undefined;
  desired_installation_date?: string | undefined;
  notes?: string | undefined;
}

export interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (() => void) | undefined;
  onCreate: (data: LeadCreateRequest) => Promise<any>;
  isSubmitting: boolean | undefined;
}

export function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  onCreate,
  isSubmitting,
}: CreateLeadModalProps) {
  const isSubmittingValue = isSubmitting ?? false;
  const [activeTab, setActiveTab] = useState("contact");

  // Form state
  const [formData, setFormData] = useState<LeadCreateRequest>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    service_address_line1: "",
    service_address_line2: "",
    service_city: "",
    service_state_province: "",
    service_postal_code: "",
    service_country: "US",
    source: "website",
    priority: 2,
    interested_service_types: [],
    desired_bandwidth: "",
    estimated_monthly_budget: undefined,
    desired_installation_date: "",
    notes: "",
  });

  const [serviceTypes, setServiceTypes] = useState({
    residential_internet: false,
    business_internet: false,
    iptv: false,
    voip: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Explicit validation (not relying on HTML5 required attributes)
      if (!formData.first_name || formData.first_name.trim() === "") {
        // Validation failed - do not proceed
        return;
      }

      if (!formData.last_name || formData.last_name.trim() === "") {
        // Validation failed - do not proceed
        return;
      }

      // Basic email validation
      if (!formData.email || formData.email.trim() === "") {
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        return;
      }

      // Address validation
      if (!formData.service_address_line1 || formData.service_address_line1.trim() === "") {
        return;
      }

      if (!formData.service_city || formData.service_city.trim() === "") {
        return;
      }

      if (!formData.service_state_province || formData.service_state_province.trim() === "") {
        return;
      }

      if (!formData.service_postal_code || formData.service_postal_code.trim() === "") {
        return;
      }

      // Build service types array
      const selectedServiceTypes = Object.entries(serviceTypes)
        .filter(([_, selected]) => selected)
        .map(([type]) => type);

      const leadData: LeadCreateRequest = {
        ...formData,
        interested_service_types: selectedServiceTypes,
      };

      await onCreate(leadData);

      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
        service_address_line1: "",
        service_address_line2: "",
        service_city: "",
        service_state_province: "",
        service_postal_code: "",
        service_country: "US",
        source: "website",
        priority: 2,
        interested_service_types: [],
        desired_bandwidth: "",
        estimated_monthly_budget: undefined,
        desired_installation_date: "",
        notes: "",
      });
      setServiceTypes({
        residential_internet: false,
        business_internet: false,
        iptv: false,
        voip: false,
      });
      setActiveTab("contact");

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      throw error;
    }
  };

  const handleServiceTypeToggle = (type: keyof typeof serviceTypes) => {
    setServiceTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>
            Add a new potential customer to your sales pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="contact">Contact Info</TabsTrigger>
              <TabsTrigger value="location">Service Location</TabsTrigger>
              <TabsTrigger value="details">Details & Requirements</TabsTrigger>
            </TabsList>

            {/* Tab 1: Contact Information */}
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="John"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.doe@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended for better follow-up success
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="For business leads only"
                />
              </div>
            </TabsContent>

            {/* Tab 2: Service Location */}
            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="address_line1">
                  Address Line 1 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address_line1"
                  value={formData.service_address_line1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_address_line1: e.target.value,
                    })
                  }
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.service_address_line2}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_address_line2: e.target.value,
                    })
                  }
                  placeholder="Apt 4B, Suite 200, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={formData.service_city}
                    onChange={(e) => setFormData({ ...formData, service_city: e.target.value })}
                    placeholder="Springfield"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">
                    State/Province <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="state"
                    value={formData.service_state_province}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        service_state_province: e.target.value,
                      })
                    }
                    placeholder="IL"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">
                    Postal Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="postal_code"
                    value={formData.service_postal_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        service_postal_code: e.target.value,
                      })
                    }
                    placeholder="62701"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={formData.service_country}
                    onValueChange={(value) => setFormData({ ...formData, service_country: value })}
                  >
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Address autocomplete will be available in the next version.
                  For now, please enter the address manually.
                </p>
              </div>
            </TabsContent>

            {/* Tab 3: Details & Requirements */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">
                    Source <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) =>
                      setFormData({ ...formData, source: value as LeadSource })
                    }
                  >
                    <SelectTrigger id="source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="advertisement">Advertisement</SelectItem>
                      <SelectItem value="walk_in">Walk-In</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority?.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, priority: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">High - Immediate Follow-up</SelectItem>
                      <SelectItem value="2">Medium - Standard</SelectItem>
                      <SelectItem value="3">Low - Long-term Nurture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interested Service Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(serviceTypes).map(([type, selected]) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={type}
                        checked={selected}
                        onChange={() => handleServiceTypeToggle(type as keyof typeof serviceTypes)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={type} className="cursor-pointer">
                        {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bandwidth">Desired Bandwidth</Label>
                  <Input
                    id="bandwidth"
                    value={formData.desired_bandwidth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        desired_bandwidth: e.target.value,
                      })
                    }
                    placeholder="e.g., 100 Mbps, 1 Gbps"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Estimated Monthly Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.estimated_monthly_budget || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_monthly_budget: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="75.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="installation_date">Desired Installation Date</Label>
                <Input
                  id="installation_date"
                  type="date"
                  value={formData.desired_installation_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      desired_installation_date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information about this lead..."
                  rows={4}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeTab === "contact") {
                  onClose();
                } else if (activeTab === "location") {
                  setActiveTab("contact");
                } else {
                  setActiveTab("location");
                }
              }}
            >
              {activeTab === "contact" ? "Cancel" : "Previous"}
            </Button>
            <div className="flex gap-2">
              {activeTab !== "details" ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (activeTab === "contact") setActiveTab("location");
                    else if (activeTab === "location") setActiveTab("details");
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmittingValue}>
                  {isSubmittingValue ? "Creating..." : "Create Lead"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
