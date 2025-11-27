/**
 * AddSubscriberModal Component
 *
 * Modal form for creating new subscribers.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

export type ConnectionType = "ftth" | "fttb" | "wireless" | "hybrid";

export interface CreateSubscriberRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  secondary_phone?: string;
  service_address: string;
  service_city: string;
  service_state: string;
  service_postal_code: string;
  service_country?: string;
  connection_type: ConnectionType;
  service_plan?: string;
  bandwidth_mbps?: number;
  ont_serial_number?: string;
  ont_mac_address?: string;
  installation_notes?: string;
  notes?: string;
}

interface SubscriberOperations {
  createSubscriber: (data: CreateSubscriberRequest) => Promise<{ id: string }>;
  isLoading: boolean;
}

export interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (subscriberId: string) => void;
  useSubscriberOperations: () => SubscriberOperations;
}

export function AddSubscriberModal({
  open,
  onClose,
  onSuccess,
  useSubscriberOperations,
}: AddSubscriberModalProps) {
  const { createSubscriber, isLoading } = useSubscriberOperations();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const initialFormData: Partial<CreateSubscriberRequest> = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    service_address: "",
    service_city: "",
    service_state: "",
    service_postal_code: "",
    service_country: "USA",
    connection_type: "ftth",
    service_plan: "",
    installation_notes: "",
    notes: "",
  };
  const [formData, setFormData] = useState<Partial<CreateSubscriberRequest>>(initialFormData);

  const handleChange = (field: keyof CreateSubscriberRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.first_name?.trim()) {
      setError("First name is required");
      return false;
    }
    if (!formData.last_name?.trim()) {
      setError("Last name is required");
      return false;
    }
    if (!formData.email?.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.phone?.trim()) {
      setError("Phone is required");
      return false;
    }
    if (!formData.service_address?.trim()) {
      setError("Service address is required");
      return false;
    }
    if (!formData.service_city?.trim()) {
      setError("Service city is required");
      return false;
    }
    if (!formData.service_state?.trim()) {
      setError("Service state is required");
      return false;
    }
    if (!formData.service_postal_code?.trim()) {
      setError("Postal code is required");
      return false;
    }
    if (!formData.connection_type) {
      setError("Connection type is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      const subscriber = await createSubscriber(formData as CreateSubscriberRequest);
      onSuccess?.(subscriber.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscriber");
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Subscriber</DialogTitle>
          <DialogDescription>Enter subscriber details to create a new account</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="john.doe@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Primary Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="secondary_phone">Secondary Phone</Label>
                    <Input
                      id="secondary_phone"
                      type="tel"
                      value={formData.secondary_phone}
                      onChange={(e) => handleChange("secondary_phone", e.target.value)}
                      placeholder="+1 (555) 987-6543"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Service Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Service Address</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="service_address">Street Address *</Label>
                    <Input
                      id="service_address"
                      value={formData.service_address}
                      onChange={(e) => handleChange("service_address", e.target.value)}
                      placeholder="123 Main Street, Apt 4B"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="service_city">City *</Label>
                      <Input
                        id="service_city"
                        value={formData.service_city}
                        onChange={(e) => handleChange("service_city", e.target.value)}
                        placeholder="New York"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="service_state">State *</Label>
                      <Input
                        id="service_state"
                        value={formData.service_state}
                        onChange={(e) => handleChange("service_state", e.target.value)}
                        placeholder="NY"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="service_postal_code">Postal Code *</Label>
                      <Input
                        id="service_postal_code"
                        value={formData.service_postal_code}
                        onChange={(e) => handleChange("service_postal_code", e.target.value)}
                        placeholder="10001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="service_country">Country</Label>
                      <Input
                        id="service_country"
                        value={formData.service_country}
                        onChange={(e) => handleChange("service_country", e.target.value)}
                        placeholder="USA"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Service Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Service Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="connection_type">Connection Type *</Label>
                    <Select
                      value={formData.connection_type || "ftth"}
                      onValueChange={(value) =>
                        handleChange("connection_type", value as ConnectionType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ftth">FTTH (Fiber to the Home)</SelectItem>
                        <SelectItem value="fttb">FTTB (Fiber to the Building)</SelectItem>
                        <SelectItem value="wireless">Wireless</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="service_plan">Service Plan</Label>
                    <Input
                      id="service_plan"
                      value={formData.service_plan}
                      onChange={(e) => handleChange("service_plan", e.target.value)}
                      placeholder="Premium 100 Mbps"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bandwidth_mbps">Bandwidth (Mbps)</Label>
                    <Input
                      id="bandwidth_mbps"
                      type="number"
                      value={formData.bandwidth_mbps ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => {
                          if (!value.trim()) {
                            const { bandwidth_mbps, ...rest } = prev;
                            return rest;
                          }
                          const numeric = Number(value);
                          if (Number.isNaN(numeric)) {
                            const { bandwidth_mbps, ...rest } = prev;
                            return rest;
                          }
                          return { ...prev, bandwidth_mbps: numeric };
                        });
                      }}
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Installation Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Installation Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ont_serial_number">ONT Serial Number</Label>
                    <Input
                      id="ont_serial_number"
                      value={formData.ont_serial_number || ""}
                      onChange={(e) => handleChange("ont_serial_number", e.target.value)}
                      placeholder="ONT123456789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ont_mac_address">ONT MAC Address</Label>
                    <Input
                      id="ont_mac_address"
                      value={formData.ont_mac_address || ""}
                      onChange={(e) => handleChange("ont_mac_address", e.target.value)}
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="installation_notes">Installation Notes</Label>
                    <Textarea
                      id="installation_notes"
                      value={formData.installation_notes}
                      onChange={(e) => handleChange("installation_notes", e.target.value)}
                      placeholder="Special instructions for installation..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Additional Notes */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Additional Notes (Optional)</h3>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Any additional information about this subscriber..."
                  rows={4}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Subscriber"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
