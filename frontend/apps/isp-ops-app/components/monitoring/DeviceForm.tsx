"use client";

/**
 * Device Form Component with Dual-Stack Support
 *
 * Form for adding/editing monitored devices with IPv4 and IPv6
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { DualStackIPInput } from "@/components/forms/DualStackIPInput";
import { IPAddressInput } from "@/components/forms/IPAddressInput";
import { Loader2, AlertCircle } from "lucide-react";
import { deviceMonitoringSchema } from "@/lib/validations/ip-address";

const formSchema = z
  .object({
    name: z.string().min(1, "Device name is required"),
    type: z.string().min(1, "Device type is required"),
    ipv4_address: z.string().optional(),
    ipv6_address: z.string().optional(),
    management_ip: z.string().min(1, "Management IP is required"),
    location: z.string().optional(),
    snmp_community: z.string().optional(),
    snmp_version: z.enum(["v1", "v2c", "v3"]).default("v2c"),
    description: z.string().optional(),
  })
  .refine((data) => data.ipv4_address || data.ipv6_address, {
    message: "At least one IP address (IPv4 or IPv6) must be provided",
    path: ["ipv4_address"],
  });

type FormData = z.infer<typeof formSchema>;

export interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: Partial<FormData>;
  mode?: "create" | "edit";
}

export function DeviceForm({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: DeviceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      snmp_version: "v2c",
    },
  });

  const ipv4Address = watch("ipv4_address");
  const ipv6Address = watch("ipv6_address");
  const snmpVersion = watch("snmp_version");

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save device");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Monitored Device" : "Edit Device"}</DialogTitle>
          <DialogDescription>
            Configure device monitoring with dual-stack IP support
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Device Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" {...register("name")} placeholder="e.g., Core Router 1" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Device Type <span className="text-red-500">*</span>
                </Label>
                <Input id="type" {...register("type")} placeholder="e.g., Router, Switch, Server" />
                {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="e.g., Data Center A, Rack 12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="Additional notes about this device"
              />
            </div>
          </div>

          {/* IP Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">IP Configuration</h3>

            <DualStackIPInput
              label="Device IP Addresses"
              ipv4Value={ipv4Address || ""}
              ipv6Value={ipv6Address || ""}
              onIPv4Change={(value) => setValue("ipv4_address", value || undefined)}
              onIPv6Change={(value) => setValue("ipv6_address", value || undefined)}
              requireAtLeastOne={true}
              useCIDR={false}
              {...(errors.ipv4_address?.message ? { ipv4Error: errors.ipv4_address.message } : {})}
              {...(errors.ipv6_address?.message ? { ipv6Error: errors.ipv6_address.message } : {})}
            />

            <IPAddressInput
              label="Management IP"
              value={watch("management_ip") || ""}
              onChange={(value) => setValue("management_ip", value)}
              required={true}
              {...(errors.management_ip?.message ? { error: errors.management_ip.message } : {})}
              helpText="Primary IP for device management and monitoring"
            />
          </div>

          {/* SNMP Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">SNMP Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="snmp_version">SNMP Version</Label>
                <Select
                  value={snmpVersion}
                  onValueChange={(value) => setValue("snmp_version", value as any)}
                >
                  <SelectTrigger id="snmp_version">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">SNMP v1</SelectItem>
                    <SelectItem value="v2c">SNMP v2c</SelectItem>
                    <SelectItem value="v3">SNMP v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="snmp_community">
                  {snmpVersion === "v3" ? "SNMP Username" : "SNMP Community"}
                </Label>
                <Input
                  id="snmp_community"
                  {...register("snmp_community")}
                  placeholder={snmpVersion === "v3" ? "Username" : "public"}
                  type={snmpVersion === "v3" ? "text" : "password"}
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Device" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
