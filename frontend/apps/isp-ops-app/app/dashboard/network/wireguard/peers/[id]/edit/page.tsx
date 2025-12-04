"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Peer Edit Form Page
 *
 * Form to update an existing WireGuard peer.
 * Some fields (like keys and IP) are immutable and displayed read-only.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useWireGuardPeer,
  useUpdateWireGuardPeer,
  useWireGuardServers,
} from "@/hooks/useWireGuard";
import type { UpdateWireGuardPeerRequest, WireGuardPeerStatus } from "@/types/wireguard";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { ArrowLeft, Loader2, Save, AlertCircle, Info } from "lucide-react";
import { useToast } from "@dotmac/ui";

interface EditPeerPageProps {
  params: {
    id: string;
  };
}

export default function EditPeerPage({ params }: EditPeerPageProps) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const { data: peer, isLoading, error } = useWireGuardPeer(id);
  const { data: servers } = useWireGuardServers();
  const updatePeer = useUpdateWireGuardPeer();

  const [formData, setFormData] = useState<UpdateWireGuardPeerRequest>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when peer loads
  useEffect(() => {
    if (peer) {
      setFormData({
        peer_name: peer["peer_name"],
        status: peer["status"],
        allowed_ips: peer["allowed_ips"],
        persistent_keepalive: peer["persistent_keepalive"],
        expiration_date: peer["expiration_date"],
        notes: peer["notes"] || "",
      });
    }
  }, [peer]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData["peer_name"] !== undefined) {
      if (!formData["peer_name"] || formData["peer_name"].trim().length === 0) {
        newErrors["peer_name"] = "Peer name is required";
      } else if (formData["peer_name"].length > 100) {
        newErrors["peer_name"] = "Peer name must be 100 characters or less";
      }
    }

    if (formData["allowed_ips"] !== undefined) {
      const ips =
        typeof formData["allowed_ips"] === "string"
          ? formData["allowed_ips"].split(",").map((ip: string) => ip.trim())
          : formData["allowed_ips"];
      for (const ip of ips) {
        if (!ip) continue;
        if (!/^[\d\.:a-fA-F]+\/\d+$/.test(ip)) {
          newErrors["allowed_ips"] = `Invalid IP range: ${ip}`;
          break;
        }
      }
    }

    if (
      formData["persistent_keepalive"] !== undefined &&
      formData["persistent_keepalive"] !== null
    ) {
      if (formData["persistent_keepalive"] < 0 || formData["persistent_keepalive"] > 3600) {
        newErrors["persistent_keepalive"] =
          "Persistent keepalive must be between 0 and 3600 seconds";
      }
    }

    if (formData["expiration_date"]) {
      const expirationDate = new Date(formData["expiration_date"]);
      const now = new Date();
      if (expirationDate < now) {
        newErrors["expiration_date"] = "Expiration date must be in the future";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    // Only send changed fields
    const updates: UpdateWireGuardPeerRequest = {};
    if (formData["peer_name"] !== peer?.["peer_name"]) {
      updates.peer_name = formData["peer_name"];
    }
    if (formData["status"] !== peer?.["status"]) {
      updates.status = formData["status"];
    }
    if (formData["allowed_ips"] !== peer?.["allowed_ips"]) {
      updates.allowed_ips = formData["allowed_ips"];
    }
    if (formData["persistent_keepalive"] !== peer?.["persistent_keepalive"]) {
      updates.persistent_keepalive = formData["persistent_keepalive"];
    }
    if (formData["expiration_date"] !== peer?.["expiration_date"]) {
      updates.expiration_date = formData["expiration_date"];
    }
    if (formData["notes"] !== peer?.["notes"]) {
      updates.notes = formData["notes"];
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No Changes",
        description: "No fields were modified",
      });
      return;
    }

    updatePeer.mutate(
      { peerId: id, data: updates },
      {
        onSuccess: (data) => {
          toast({
            title: "Peer Updated",
            description: `Peer "${data["peer_name"]}" has been updated successfully`,
          });
          router.push(`/dashboard/network/wireguard/peers/${id}`);
        },
        onError: (error: any) => {
          toast({
            title: "Error Updating Peer",
            description: error["response"]?.["data"]?.detail || "Failed to update peer",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleChange = (field: keyof UpdateWireGuardPeerRequest, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !peer) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load peer details</AlertDescription>
        </Alert>
        <Link href="/dashboard/network/wireguard/peers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Peers
          </Button>
        </Link>
      </div>
    );
  }

  const server = servers?.find((s) => s.id === peer["server_id"]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/dashboard/network/wireguard/peers/${id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Peer Details
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Edit WireGuard Peer</h1>
          <p className="text-muted-foreground mt-1">
            Update configuration for peer: {peer["peer_name"]}
          </p>
        </div>
      </div>

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Some fields like public key, IP address, and server assignment are immutable and cannot be
          changed. To change these, you must regenerate the peer configuration or create a new peer.
        </AlertDescription>
      </Alert>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Peer Configuration</CardTitle>
            <CardDescription>Update the peer details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Read-Only: Server */}
            <div className="space-y-2">
              <Label>WireGuard Server (Read-Only)</Label>
              <div className="flex items-center gap-2">
                <Input value={server?.["name"] || "Unknown Server"} disabled />
                <Badge variant="outline">{server?.["status"] || "unknown"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Server assignment cannot be changed</p>
            </div>

            {/* Read-Only: Peer IP */}
            <div className="space-y-2">
              <Label>Peer IP Address (Read-Only)</Label>
              <Input value={peer["peer_ip"] || "Not assigned"} disabled />
              <p className="text-sm text-muted-foreground">
                IP address is assigned automatically and cannot be changed
              </p>
            </div>

            {/* Read-Only: Public Key */}
            <div className="space-y-2">
              <Label>Public Key (Read-Only)</Label>
              <Input value={peer["public_key"] || "N/A"} disabled className="font-mono text-xs" />
              <p className="text-sm text-muted-foreground">
                To change keys, use the &quot;Regenerate Configuration&quot; feature
              </p>
            </div>

            {/* Peer Name */}
            <div className="space-y-2">
              <Label htmlFor="peer_name">
                Peer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="peer_name"
                value={formData["peer_name"] || ""}
                onChange={(e) => handleChange("peer_name", e.target.value)}
                placeholder="e.g., john-laptop"
                maxLength={100}
              />
              {errors["peer_name"] && <p className="text-sm text-red-500">{errors["peer_name"]}</p>}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData["status"] || peer["status"]}
                onValueChange={(value) => handleChange("status", value as WireGuardPeerStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Control peer&apos;s access status</p>
            </div>

            {/* Allowed IPs */}
            <div className="space-y-2">
              <Label htmlFor="allowed_ips">Allowed IPs</Label>
              <Input
                id="allowed_ips"
                value={formData["allowed_ips"] || ""}
                onChange={(e) => handleChange("allowed_ips", e.target.value)}
                placeholder="0.0.0.0/0, ::/0"
              />
              <p className="text-sm text-muted-foreground">
                Comma-separated list of IP ranges this peer can route
              </p>
              {errors["allowed_ips"] && (
                <p className="text-sm text-red-500">{errors["allowed_ips"]}</p>
              )}
            </div>

            {/* Persistent Keepalive */}
            <div className="space-y-2">
              <Label htmlFor="persistent_keepalive">Persistent Keepalive (seconds)</Label>
              <Input
                id="persistent_keepalive"
                type="number"
                min={0}
                max={3600}
                value={formData["persistent_keepalive"] ?? 25}
                onChange={(e) => handleChange("persistent_keepalive", parseInt(e.target.value, 10))}
              />
              <p className="text-sm text-muted-foreground">
                How often to send keepalive packets (0 = disabled)
              </p>
              {errors["persistent_keepalive"] && (
                <p className="text-sm text-red-500">{errors["persistent_keepalive"]}</p>
              )}
            </div>

            {/* Expiration Date */}
            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date (optional)</Label>
              <Input
                id="expiration_date"
                type="datetime-local"
                value={
                  formData["expiration_date"]
                    ? new Date(formData["expiration_date"]).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) => handleChange("expiration_date", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                When this peer&apos;s access should expire
              </p>
              {errors["expiration_date"] && (
                <p className="text-sm text-red-500">{errors["expiration_date"]}</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData["notes"] || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Additional information about this peer..."
                rows={4}
              />
            </div>

            {/* Read-Only: Customer ID */}
            {peer["customer_id"] && (
              <div className="space-y-2">
                <Label>Customer ID (Read-Only)</Label>
                <Input value={peer["customer_id"]} disabled />
                <p className="text-sm text-muted-foreground">
                  Customer association cannot be changed
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={updatePeer.isPending}>
                {updatePeer.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Link href={`/dashboard/network/wireguard/peers/${id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {peer["created_at"] ? new Date(peer["created_at"]).toLocaleString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">
                {peer["updated_at"] ? new Date(peer["updated_at"]).toLocaleString() : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
