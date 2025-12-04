"use client";

/**
 * WireGuard Peer Form with Auto Dual-Stack Allocation
 *
 * Create/edit WireGuard VPN peers with automatic IPv6 allocation
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
import { Checkbox } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { IPCIDRInput } from "@/components/forms/IPCIDRInput";
import { Badge } from "@dotmac/ui";
import { Loader2, AlertCircle, Info, Sparkles } from "lucide-react";
import { wireguardPeerSchema, WireGuardPeer } from "@/lib/validations/ip-address";

type FormData = WireGuardPeer;

export interface WireGuardPeerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  serverId: string;
  serverName?: string;
  serverSupportsIPv6?: boolean;
  initialData?: Partial<FormData>;
  mode?: "create" | "edit";
}

export function WireGuardPeerForm({
  open,
  onClose,
  onSubmit,
  serverId,
  serverName,
  serverSupportsIPv6 = false,
  initialData,
  mode = "create",
}: WireGuardPeerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualIP, setManualIP] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(wireguardPeerSchema),
    defaultValues: initialData || {
      server_id: serverId,
      generate_keys: true,
    },
  });

  const generateKeys = watch("generate_keys");
  const peerIPv4 = watch("peer_ipv4");
  const peerIPv6 = watch("peer_ipv6");

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save peer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setManualIP(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add VPN Peer" : "Edit VPN Peer"}</DialogTitle>
          <DialogDescription>
            {serverName && `Server: ${serverName}`}
            {serverSupportsIPv6 && (
              <Badge variant="secondary" className="ml-2">
                Dual-Stack
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Peer Information</h3>

            <div className="space-y-2">
              <Label htmlFor="name">
                Peer Name <span className="text-red-500">*</span>
              </Label>
              <Input id="name" {...register("name")} placeholder="John's Laptop" />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="Personal device for remote work"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Customer ID (Optional)</Label>
                <Input id="customer_id" {...register("customer_id")} placeholder="CUST-123" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriber_id">Subscriber ID (Optional)</Label>
                <Input id="subscriber_id" {...register("subscriber_id")} placeholder="SUB-456" />
              </div>
            </div>
          </div>

          {/* IP Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">IP Configuration</h3>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manual_ip"
                checked={manualIP}
                onChange={(e) => setManualIP(e.target.checked)}
              />
              <Label htmlFor="manual_ip">Manually assign IP addresses</Label>
            </div>

            {!manualIP ? (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  {serverSupportsIPv6
                    ? "IPv4 and IPv6 addresses will be automatically allocated"
                    : "IPv4 address will be automatically allocated"}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <IPCIDRInput
                  label="IPv4 Address (CIDR)"
                  value={peerIPv4 || ""}
                  onChange={(value) => setValue("peer_ipv4", value || null)}
                  allowIPv4
                  allowIPv6={false}
                  placeholder="10.8.0.2/32"
                  {...(errors.peer_ipv4?.message ? { error: errors.peer_ipv4.message } : {})}
                />

                {serverSupportsIPv6 && (
                  <IPCIDRInput
                    label="IPv6 Address (CIDR)"
                    value={peerIPv6 || ""}
                    onChange={(value) => setValue("peer_ipv6", value || null)}
                    allowIPv4={false}
                    allowIPv6
                    placeholder="fd00:8::2/128"
                    {...(errors.peer_ipv6?.message ? { error: errors.peer_ipv6.message } : {})}
                  />
                )}
              </div>
            )}
          </div>

          {/* Key Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Key Configuration</h3>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="generate_keys"
                checked={generateKeys}
                onChange={(e) => setValue("generate_keys", e.target.checked)}
              />
              <Label htmlFor="generate_keys">Automatically generate keys</Label>
            </div>

            {!generateKeys && (
              <div className="space-y-2">
                <Label htmlFor="public_key">
                  Public Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="public_key"
                  {...register("public_key")}
                  placeholder="base64-encoded-public-key"
                  className="font-mono text-xs"
                />
                {errors.public_key && (
                  <p className="text-sm text-red-500">{errors.public_key.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Provide the peer&apos;s public key if generated externally
                </p>
              </div>
            )}

            {generateKeys && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  A key pair will be generated and included in the configuration file
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Advanced Settings (Optional)</h3>

            <div className="space-y-2">
              <Label htmlFor="expires_at">Expiration Date</Label>
              <Input id="expires_at" type="datetime-local" {...register("expires_at")} />
              <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                {...register("notes")}
                placeholder="Additional notes about this peer"
              />
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
              {mode === "create" ? "Create Peer" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
