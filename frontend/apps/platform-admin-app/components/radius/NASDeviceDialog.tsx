"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

interface NASDevice {
  id?: number;
  nasname: string;
  shortname: string;
  type: string;
  secret?: string;
  ports?: number | null;
  server?: string | null;
  community?: string | null;
  description?: string | null;
  vendor?: string | null;
  model?: string | null;
  firmware_version?: string | null;
}

interface NASDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nasDevice?: NASDevice | null;
}

const NAS_TYPES = [
  "other",
  "router",
  "olt",
  "wireless",
  "switch",
  "vpn",
  "access-point",
];

const VENDORS = [
  { value: "mikrotik", label: "Mikrotik" },
  { value: "cisco", label: "Cisco" },
  { value: "huawei", label: "Huawei" },
  { value: "juniper", label: "Juniper" },
  { value: "zte", label: "ZTE" },
  { value: "generic", label: "Generic" },
];

export function NASDeviceDialog({
  open,
  onOpenChange,
  nasDevice,
}: NASDeviceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!nasDevice;

  const [formData, setFormData] = useState<NASDevice>({
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

  useEffect(() => {
    if (nasDevice) {
      setFormData({
        ...nasDevice,
        secret: "",
      });
    } else {
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
  }, [nasDevice, open]);

  const mutation = useMutation({
    mutationFn: async (data: NASDevice) => {
      if (isEdit && nasDevice?.id) {
        const response = await apiClient.patch(`/radius/nas/${nasDevice.id}`, data);
        return response.data;
      }
      const response = await apiClient.post("/radius/nas", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-nas"] });
      toast({
        title: isEdit ? "NAS device updated" : "NAS device created",
        description: `NAS device has been ${isEdit ? "updated" : "created"} successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      logger.error("Failed to save NAS device", { error });
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save NAS device",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.nasname || !formData.shortname) {
      toast({
        title: "Validation Error",
        description: "NAS Name and Short Name are required.",
        variant: "destructive",
      });
      return;
    }

    if (!isEdit && !formData.secret) {
      toast({
        title: "Validation Error",
        description: "Shared Secret is required for new NAS devices.",
        variant: "destructive",
      });
      return;
    }

    const payload: NASDevice = {
      nasname: formData.nasname,
      shortname: formData.shortname,
      type: formData.type,
    };

    if (formData.secret) {
      payload.secret = formData.secret;
    }
    if (formData.ports) payload.ports = Number(formData.ports);
    if (formData.server) payload.server = formData.server;
    if (formData.community) payload.community = formData.community;
    if (formData.description) payload.description = formData.description;
    if (formData.vendor) payload.vendor = formData.vendor;
    if (formData.model) payload.model = formData.model;
    if (formData.firmware_version) payload.firmware_version = formData.firmware_version;

    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit NAS Device" : "Add NAS Device"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the configuration for this network access server."
                : "Register a new NAS device for RADIUS authentication."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nasname">NAS Name / IP*</Label>
              <Input
                id="nasname"
                value={formData.nasname}
                onChange={(event) => setFormData((prev) => ({ ...prev, nasname: event.target.value }))}
                placeholder="192.168.0.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortname">Short Name*</Label>
              <Input
                id="shortname"
                value={formData.shortname}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, shortname: event.target.value }))
                }
                placeholder="main-olt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Device Type*</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {NAS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select
                value={formData.vendor ?? "generic"}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, vendor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {VENDORS.map((vendor) => (
                    <SelectItem key={vendor.value} value={vendor.value}>
                      {vendor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model ?? ""}
                onChange={(event) => setFormData((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="ZXA10 C600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firmware">Firmware Version</Label>
              <Input
                id="firmware"
                value={formData.firmware_version ?? ""}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, firmware_version: event.target.value }))
                }
                placeholder="v1.2.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ports">Ports</Label>
              <Input
                id="ports"
                type="number"
                value={formData.ports ?? ""}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    ports: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                placeholder="64"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                value={formData.server ?? ""}
                onChange={(event) => setFormData((prev) => ({ ...prev, server: event.target.value }))}
                placeholder="radius1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="secret">Shared Secret{isEdit ? "" : "*"}</Label>
              <Input
                id="secret"
                type="password"
                value={formData.secret ?? ""}
                onChange={(event) => setFormData((prev) => ({ ...prev, secret: event.target.value }))}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="community">SNMP Community</Label>
              <Input
                id="community"
                value={formData.community ?? ""}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, community: event.target.value }))
                }
                placeholder="public"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description ?? ""}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Notes about this NAS device"
            />
          </div>

          <DialogFooter className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? "Save Changes" : "Create Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
