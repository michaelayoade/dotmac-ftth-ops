"use client";

/**
 * WireGuard Server Form with Dual-Stack Support
 *
 * Create/edit WireGuard VPN servers with IPv4 and IPv6
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Alert, AlertDescription } from "@dotmac/ui";
import { DualStackIPInput } from "@/components/forms/DualStackIPInput";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { wireguardServerSchema, WireGuardServer } from "@/lib/validations/ip-address";

type FormData = WireGuardServer;

export interface WireGuardServerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: Partial<FormData>;
  mode?: "create" | "edit";
}

export function WireGuardServerForm({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: WireGuardServerFormProps) {
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
    resolver: zodResolver(wireguardServerSchema),
    defaultValues: initialData || {
      listen_port: 51820,
      max_peers: 1000,
      dns_servers: ["1.1.1.1", "1.0.0.1"],
      allowed_ips: ["0.0.0.0/0", "::/0"],
      persistent_keepalive: 25,
    },
  });

  const serverIPv4 = watch("server_ipv4");
  const serverIPv6 = watch("server_ipv6");

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save WireGuard server");
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
          <DialogTitle>
            {mode === "create" ? "Create WireGuard Server" : "Edit WireGuard Server"}
          </DialogTitle>
          <DialogDescription>Configure VPN server with dual-stack support</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Server Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Server Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" {...register("name")} placeholder="VPN Server 1" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" {...register("location")} placeholder="US East" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="Primary VPN server for remote access"
              />
            </div>
          </div>

          {/* Network Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Network Configuration</h3>

            <div className="space-y-2">
              <Label htmlFor="public_endpoint">
                Public Endpoint <span className="text-red-500">*</span>
              </Label>
              <Input
                id="public_endpoint"
                {...register("public_endpoint")}
                placeholder="vpn.example.com:51820"
              />
              {errors.public_endpoint && (
                <p className="text-sm text-red-500">{errors.public_endpoint.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Format: hostname:port or IP:port</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="listen_port">Listen Port</Label>
              <Input
                id="listen_port"
                type="number"
                {...register("listen_port", { valueAsNumber: true })}
                placeholder="51820"
              />
              {errors.listen_port && (
                <p className="text-sm text-red-500">{errors.listen_port.message}</p>
              )}
            </div>

            <DualStackIPInput
              label="Server IP Addresses"
              ipv4Value={serverIPv4 || ""}
              ipv6Value={serverIPv6 || ""}
              onIPv4Change={(value) => setValue("server_ipv4", value)}
              onIPv6Change={(value) => setValue("server_ipv6", value || null)}
              requireAtLeastOne={true}
              useCIDR={true}
              {...(errors.server_ipv4?.message ? { ipv4Error: errors.server_ipv4.message } : {})}
              {...(errors.server_ipv6?.message ? { ipv6Error: errors.server_ipv6.message } : {})}
              ipv4Placeholder="10.8.0.1/24"
              ipv6Placeholder="fd00:8::1/64"
            />

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {serverIPv6
                  ? "Peers will automatically receive dual-stack IPs (IPv4 + IPv6)"
                  : "IPv6 is optional - peers will only get IPv4 addresses"}
              </AlertDescription>
            </Alert>
          </div>

          {/* Advanced Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Advanced Settings</h3>

            <div className="space-y-2">
              <Label htmlFor="max_peers">Maximum Peers</Label>
              <Input
                id="max_peers"
                type="number"
                {...register("max_peers", { valueAsNumber: true })}
                placeholder="1000"
              />
              {errors.max_peers && (
                <p className="text-sm text-red-500">{errors.max_peers.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="persistent_keepalive">Persistent Keepalive (seconds)</Label>
              <Input
                id="persistent_keepalive"
                type="number"
                {...register("persistent_keepalive", { valueAsNumber: true })}
                placeholder="25"
              />
              <p className="text-xs text-muted-foreground">Set to 0 to disable keepalive packets</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dns_servers">DNS Servers (comma-separated)</Label>
              <Input
                id="dns_servers"
                {...register("dns_servers", {
                  setValueAs: (value) => value.split(",").map((s: string) => s.trim()),
                })}
                placeholder="1.1.1.1, 1.0.0.1"
                defaultValue={watch("dns_servers")?.join(", ")}
              />
              <p className="text-xs text-muted-foreground">DNS servers for VPN clients</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowed_ips">Allowed IPs (comma-separated)</Label>
              <Input
                id="allowed_ips"
                {...register("allowed_ips", {
                  setValueAs: (value) => value.split(",").map((s: string) => s.trim()),
                })}
                placeholder="0.0.0.0/0, ::/0"
                defaultValue={watch("allowed_ips")?.join(", ")}
              />
              <p className="text-xs text-muted-foreground">
                Default: 0.0.0.0/0, ::/0 (full tunnel)
              </p>
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
              {mode === "create" ? "Create Server" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
