"use client";

/**
 * Subscriber Provisioning Form with Dual-Stack Support
 *
 * Complete subscriber provisioning including RADIUS, IP allocation, and service activation
 */

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

const formSchema = z.object({
  // Basic Information
  subscriber_id: z.string().min(1, "Subscriber ID is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),

  // RADIUS Configuration
  framed_ip_address: z.string().optional(),
  framed_ipv6_prefix: z.string().optional(),
  framed_ipv6_address: z.string().optional(),
  delegated_ipv6_prefix: z.string().optional(),

  // Service Configuration
  bandwidth_profile_id: z.string().optional(),
  session_timeout: z.number().int().positive().optional(),
  idle_timeout: z.number().int().positive().optional(),

  // Network Allocation Options
  auto_allocate_ipv4: z.boolean().default(true),
  auto_allocate_ipv6: z.boolean().default(true),
  ipv4_prefix_id: z.number().optional(),
  ipv6_prefix_id: z.number().optional(),

  // VPN Options
  provision_wireguard: z.boolean().default(false),
  wireguard_server_id: z.string().optional(),
});

export type FormData = z.infer<typeof formSchema>;

export interface IPInputComponentProps {
  label?: string;
  value: string;
  onChange: (value: string | undefined) => void;
  allowIPv4?: boolean;
  allowIPv6?: boolean;
  placeholder?: string;
  error?: string;
}

export interface SubscriberProvisionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  availablePrefixes?: Array<{
    id: number;
    prefix: string;
    family: "ipv4" | "ipv6";
  }>;
  availableProfiles?: Array<{ id: string; name: string }>;
  availableWireGuardServers?: Array<{ id: string; name: string }>;
  DualStackIPInput?: React.ComponentType<any>;
  IPCIDRInput: React.ComponentType<IPInputComponentProps>;
}

// ============================================================================
// Component
// ============================================================================

export function SubscriberProvisionForm({
  open,
  onClose,
  onSubmit,
  availablePrefixes = [],
  availableProfiles = [],
  availableWireGuardServers = [],
  DualStackIPInput,
  IPCIDRInput,
}: SubscriberProvisionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      auto_allocate_ipv4: true,
      auto_allocate_ipv6: true,
      provision_wireguard: false,
    },
  });

  const autoAllocateIPv4 = watch("auto_allocate_ipv4");
  const autoAllocateIPv6 = watch("auto_allocate_ipv6");
  const provisionWireGuard = watch("provision_wireguard");

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision subscriber");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setActiveTab("basic");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provision New Subscriber</DialogTitle>
          <DialogDescription>
            Configure subscriber with dual-stack IP, RADIUS, and optional VPN
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="ip">IP Allocation</TabsTrigger>
              <TabsTrigger value="service">Service</TabsTrigger>
              <TabsTrigger value="vpn">VPN</TabsTrigger>
            </TabsList>

            {/* Basic Information */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subscriber_id">
                    Subscriber ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="subscriber_id"
                    {...register("subscriber_id")}
                    placeholder="SUB-12345"
                  />
                  {errors.subscriber_id && (
                    <p className="text-sm text-red-500">{errors.subscriber_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input id="username" {...register("username")} placeholder="user@example.com" />
                  {errors.username && (
                    <p className="text-sm text-red-500">{errors.username.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Min 8 characters"
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Basic information will be used to create RADIUS credentials
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* IP Allocation */}
            <TabsContent value="ip" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_allocate_ipv4"
                    checked={autoAllocateIPv4}
                    onChange={(e) => setValue("auto_allocate_ipv4", e.target.checked)}
                  />
                  <Label htmlFor="auto_allocate_ipv4">Auto-allocate IPv4 address</Label>
                </div>

                {!autoAllocateIPv4 && (
                  <IPCIDRInput
                    label="IPv4 Address (CIDR)"
                    value={watch("framed_ip_address") || ""}
                    onChange={(value) => setValue("framed_ip_address", value || undefined)}
                    allowIPv4={true}
                    allowIPv6={false}
                    {...(errors.framed_ip_address?.message && {
                      error: errors.framed_ip_address.message,
                    })}
                  />
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_allocate_ipv6"
                    checked={autoAllocateIPv6}
                    onChange={(e) => setValue("auto_allocate_ipv6", e.target.checked)}
                  />
                  <Label htmlFor="auto_allocate_ipv6">Auto-allocate IPv6 prefix</Label>
                </div>

                {!autoAllocateIPv6 && (
                  <>
                    <IPCIDRInput
                      label="IPv6 Prefix"
                      value={watch("framed_ipv6_prefix") || ""}
                      onChange={(value) => setValue("framed_ipv6_prefix", value || undefined)}
                      allowIPv4={false}
                      allowIPv6={true}
                      placeholder="2001:db8::/64"
                      {...(errors.framed_ipv6_prefix?.message && {
                        error: errors.framed_ipv6_prefix.message,
                      })}
                    />

                    <IPCIDRInput
                      label="IPv6 Address (Optional)"
                      value={watch("framed_ipv6_address") || ""}
                      onChange={(value) => setValue("framed_ipv6_address", value || undefined)}
                      allowIPv4={false}
                      allowIPv6={true}
                      placeholder="2001:db8::1/128"
                      {...(errors.framed_ipv6_address?.message && {
                        error: errors.framed_ipv6_address.message,
                      })}
                    />
                  </>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {autoAllocateIPv4 && autoAllocateIPv6
                      ? "Dual-stack IPs will be automatically allocated from available prefixes"
                      : "Manual IP configuration requires valid CIDR notation"}
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* Service Configuration */}
            <TabsContent value="service" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bandwidth_profile_id">Bandwidth Profile</Label>
                <select
                  id="bandwidth_profile_id"
                  {...register("bandwidth_profile_id")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select profile...</option>
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session_timeout">Session Timeout (seconds)</Label>
                  <Input
                    id="session_timeout"
                    type="number"
                    {...register("session_timeout", { valueAsNumber: true })}
                    placeholder="3600"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idle_timeout">Idle Timeout (seconds)</Label>
                  <Input
                    id="idle_timeout"
                    type="number"
                    {...register("idle_timeout", { valueAsNumber: true })}
                    placeholder="600"
                  />
                </div>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Service limits will be enforced by RADIUS</AlertDescription>
              </Alert>
            </TabsContent>

            {/* VPN Configuration */}
            <TabsContent value="vpn" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="provision_wireguard"
                  checked={provisionWireGuard}
                  onChange={(e) => setValue("provision_wireguard", e.target.checked)}
                />
                <Label htmlFor="provision_wireguard">Provision WireGuard VPN peer</Label>
              </div>

              {provisionWireGuard && (
                <div className="space-y-2">
                  <Label htmlFor="wireguard_server_id">WireGuard Server</Label>
                  <select
                    id="wireguard_server_id"
                    {...register("wireguard_server_id")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select server...</option>
                    {availableWireGuardServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {provisionWireGuard
                    ? "WireGuard peer will be created with dual-stack IPs if server supports IPv6"
                    : "VPN access can be configured later if needed"}
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

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
              Provision Subscriber
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
