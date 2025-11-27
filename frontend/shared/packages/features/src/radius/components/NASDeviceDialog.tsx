"use client";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Save, X } from "lucide-react";
import React, { useState, useEffect } from "react";

import type { NASDevice, NASDeviceFormData } from "../types";
import { NAS_TYPES, NAS_VENDORS } from "../types";

export interface NASDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nasDevice?: NASDevice | null | undefined;
  onSubmit: (
    data: NASDeviceFormData,
    isEdit: boolean,
    deviceId?: number | undefined,
  ) => Promise<void>;
  isPending?: boolean;
}

export function NASDeviceDialog({
  open,
  onOpenChange,
  nasDevice,
  onSubmit,
  isPending = false,
}: NASDeviceDialogProps) {
  const isEdit = !!nasDevice;

  const [formData, setFormData] = useState<NASDeviceFormData>({
    nasname: "",
    shortname: "",
    type: "other",
    secret: "",
    ports: null,
    server: "",
    community: "",
    description: "",
    vendor: "generic",
    model: "",
    firmware_version: "",
  });

  const [validationError, setValidationError] = useState<string>("");

  // Populate form when editing
  useEffect(() => {
    if (nasDevice) {
      setFormData({
        ...nasDevice,
        secret: "", // Don't populate secret for security
      });
    } else {
      // Reset form when creating new
      setFormData({
        nasname: "",
        shortname: "",
        type: "other",
        secret: "",
        ports: null,
        server: "",
        community: "",
        description: "",
        vendor: "generic",
        model: "",
        firmware_version: "",
      });
    }
    setValidationError("");
  }, [nasDevice, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validate required fields
    if (!formData.nasname || !formData.shortname) {
      setValidationError("NAS Name and Short Name are required.");
      return;
    }

    // Secret is required for new devices
    if (!isEdit && !formData.secret) {
      setValidationError("Shared Secret is required for new NAS devices.");
      return;
    }

    // Prepare data for API
    const apiData: NASDeviceFormData = {
      nasname: formData.nasname,
      shortname: formData.shortname,
      type: formData.type,
    };

    // Only include secret if provided (required for create, optional for update)
    if (formData.secret) {
      apiData.secret = formData.secret;
    }

    // Include optional fields if provided
    if (formData.ports) apiData.ports = Number(formData.ports);
    if (formData.server) apiData.server = formData.server;
    if (formData.community) apiData.community = formData.community;
    if (formData.description) apiData.description = formData.description;
    if (formData.vendor) apiData.vendor = formData.vendor;
    if (formData.model) apiData.model = formData.model;
    if (formData.firmware_version) apiData.firmware_version = formData.firmware_version;

    try {
      await onSubmit(apiData, isEdit, nasDevice?.id);
    } catch (error) {
      // Error handling is done by the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit NAS Device" : "Add NAS Device"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the NAS device configuration. Leave secret empty to keep existing secret."
              : "Add a new Network Access Server (router, OLT, or access point) to authenticate users."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Validation Error */}
            {validationError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {validationError}
              </div>
            )}

            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nasname">
                    NAS Name (IP/Hostname) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nasname"
                    value={formData.nasname}
                    onChange={(e) => setFormData({ ...formData, nasname: e.target.value })}
                    placeholder="e.g., 192.168.1.1 or router.example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    IP address or hostname of the NAS device
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortname">
                    Short Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="shortname"
                    value={formData.shortname}
                    onChange={(e) => setFormData({ ...formData, shortname: e.target.value })}
                    placeholder="e.g., router01"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Friendly identifier for this device
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Device Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NAS_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select
                    value={formData.vendor || "generic"}
                    onValueChange={(value) => setFormData({ ...formData, vendor: value })}
                  >
                    <SelectTrigger id="vendor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NAS_VENDORS.map((vendor) => (
                        <SelectItem key={vendor.value} value={vendor.value}>
                          {vendor.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for vendor-specific RADIUS attributes
                  </p>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Security</h3>
              <div className="space-y-2">
                <Label htmlFor="secret">
                  Shared Secret {!isEdit && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="secret"
                  type="password"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder={
                    isEdit
                      ? "Leave empty to keep existing secret"
                      : "Enter RADIUS shared secret (min 16 chars)"
                  }
                  minLength={isEdit ? 0 : 16}
                  required={!isEdit}
                />
                <p className="text-xs text-muted-foreground">
                  RADIUS shared secret for authenticating this NAS device
                  {isEdit && " (leave empty to keep current secret)"}
                </p>
              </div>
            </div>

            {/* Device Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Device Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model || ""}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., CCR1036-12G-4S"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmware_version">Firmware Version</Label>
                  <Input
                    id="firmware_version"
                    value={formData.firmware_version || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firmware_version: e.target.value,
                      })
                    }
                    placeholder="e.g., 7.10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ports">Ports</Label>
                  <Input
                    id="ports"
                    type="number"
                    value={formData.ports || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ports: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g., 48"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">Number of available ports</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="server">Management Server</Label>
                  <Input
                    id="server"
                    value={formData.server || ""}
                    onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                    placeholder="e.g., management.example.com"
                  />
                </div>
              </div>
            </div>

            {/* SNMP (Optional) */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">SNMP (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="community">SNMP Community</Label>
                <Input
                  id="community"
                  value={formData.community || ""}
                  onChange={(e) => setFormData({ ...formData, community: e.target.value })}
                  placeholder="e.g., public"
                />
                <p className="text-xs text-muted-foreground">
                  SNMP community string for monitoring (optional)
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Main router at headquarters building"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : isEdit ? "Update Device" : "Create Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
