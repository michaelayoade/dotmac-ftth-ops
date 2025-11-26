"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Peer Create Form Page
 *
 * Form to create a new WireGuard peer with validation.
 * Auto-generates keys and IP allocation on the backend.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateWireGuardPeer, useWireGuardServers } from "@/hooks/useWireGuard";
import type { CreateWireGuardPeerRequest } from "@/types/wireguard";
import { WireGuardServerStatus } from "@/types/wireguard";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { ArrowLeft, Loader2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@dotmac/ui";

export default function CreatePeerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const createPeer = useCreateWireGuardPeer();
  const { data: servers, isLoading: serversLoading } = useWireGuardServers({
    status: WireGuardServerStatus.ACTIVE,
  });

  const [formData, setFormData] = useState<CreateWireGuardPeerRequest>({
    server_id: "",
    name: "",
    peer_name: "",
    customer_id: "",
    allowed_ips: "0.0.0.0/0, ::/0",
    persistent_keepalive: 25,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasCustomerInfo, setHasCustomerInfo] = useState(false);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData["server_id"]) {
      newErrors["server_id"] = "Server is required";
    }

    if (!formData["peer_name"] || formData["peer_name"].trim().length === 0) {
      newErrors["peer_name"] = "Peer name is required";
    } else if (formData["peer_name"].length > 100) {
      newErrors["peer_name"] = "Peer name must be 100 characters or less";
    }

    if (hasCustomerInfo && !formData["customer_id"]) {
      newErrors["customer_id"] = "Customer ID is required when customer info is enabled";
    }

    if (formData["allowed_ips"]) {
      // Basic validation for IP ranges
      const ips =
        typeof formData["allowed_ips"] === "string"
          ? formData["allowed_ips"].split(",").map((ip: string) => ip.trim())
          : formData["allowed_ips"];
      for (const ip of ips) {
        if (!ip) continue;
        // Check if it's a valid CIDR notation (basic check)
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

    // Prepare request data
    const peerName = (formData["peer_name"] || formData["name"] || "").trim();
    const allowedIps = formData["allowed_ips"];
    const allowedIpsStr =
      typeof allowedIps === "string"
        ? allowedIps.trim()
        : Array.isArray(allowedIps)
          ? allowedIps[0]
          : "0.0.0.0/0, ::/0";
    const requestData: CreateWireGuardPeerRequest = {
      server_id: formData["server_id"],
      name: peerName || "WireGuard Peer",
      allowed_ips: allowedIpsStr || "0.0.0.0/0, ::/0",
      persistent_keepalive:
        formData["persistent_keepalive"] !== undefined ? formData["persistent_keepalive"] : 25,
    };

    if (peerName) {
      requestData.peer_name = peerName;
    }

    if (hasCustomerInfo) {
      const customerId = formData["customer_id"]?.trim();
      if (customerId) {
        requestData.customer_id = customerId;
      }
    }

    if (formData["notes"]) {
      const trimmedNotes = formData["notes"].trim();
      if (trimmedNotes) {
        requestData.notes = trimmedNotes;
      }
    }

    if (formData["expiration_date"]) {
      requestData.expiration_date = formData["expiration_date"];
    }

    createPeer.mutate(requestData, {
      onSuccess: (data) => {
        toast({
          title: "Peer Created",
          description: `Peer "${data["peer_name"]}" has been created successfully`,
        });
        router.push(`/dashboard/network/wireguard/peers/${data["id"]}`);
      },
      onError: (error: any) => {
        toast({
          title: "Error Creating Peer",
          description: error["response"]?.["data"]?.detail || "Failed to create peer",
          variant: "destructive",
        });
      },
    });
  };

  const handleChange = (field: keyof CreateWireGuardPeerRequest, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (serversLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/network/wireguard/peers">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Peers
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Create WireGuard Peer</h1>
          <p className="text-muted-foreground mt-1">Add a new VPN peer to a WireGuard server</p>
        </div>
      </div>

      {/* No servers warning */}
      {servers && servers.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active WireGuard servers available. Please{" "}
            <Link href="/dashboard/network/wireguard/servers/new" className="underline font-medium">
              create a server
            </Link>{" "}
            first.
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Peer Configuration</CardTitle>
            <CardDescription>
              Enter the peer details. Keys and IP address will be generated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Server Selection */}
            <div className="space-y-2">
              <Label htmlFor="server_id">
                WireGuard Server <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData["server_id"]}
                onValueChange={(value) => handleChange("server_id", value)}
              >
                <SelectTrigger id="server_id">
                  <SelectValue placeholder="Select a server" />
                </SelectTrigger>
                <SelectContent>
                  {servers?.map((server) => (
                    <SelectItem key={server["id"]} value={server["id"]}>
                      {server["name"]} ({server["public_endpoint"]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors["server_id"] && <p className="text-sm text-red-500">{errors["server_id"]}</p>}
            </div>

            {/* Peer Name */}
            <div className="space-y-2">
              <Label htmlFor="peer_name">
                Peer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="peer_name"
                value={formData["peer_name"]}
                onChange={(e) => handleChange("peer_name", e.target.value)}
                placeholder="e.g., john-laptop, office-router"
                maxLength={100}
              />
              <p className="text-sm text-muted-foreground">Friendly name to identify this peer</p>
              {errors["peer_name"] && <p className="text-sm text-red-500">{errors["peer_name"]}</p>}
            </div>

            {/* Customer Information Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="has_customer"
                checked={hasCustomerInfo}
                onChange={(e) => setHasCustomerInfo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="has_customer" className="font-normal cursor-pointer">
                Associate with customer (optional)
              </Label>
            </div>

            {/* Customer ID */}
            {hasCustomerInfo && (
              <div className="space-y-2">
                <Label htmlFor="customer_id">
                  Customer ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customer_id"
                  value={formData["customer_id"] || ""}
                  onChange={(e) => handleChange("customer_id", e.target.value)}
                  placeholder="Enter customer ID"
                />
                <p className="text-sm text-muted-foreground">
                  Link this peer to a customer account
                </p>
                {errors["customer_id"] && (
                  <p className="text-sm text-red-500">{errors["customer_id"]}</p>
                )}
              </div>
            )}

            {/* Allowed IPs */}
            <div className="space-y-2">
              <Label htmlFor="allowed_ips">Allowed IPs</Label>
              <Input
                id="allowed_ips"
                value={formData["allowed_ips"]}
                onChange={(e) => handleChange("allowed_ips", e.target.value)}
                placeholder="0.0.0.0/0, ::/0"
              />
              <p className="text-sm text-muted-foreground">
                Comma-separated list of IP ranges this peer can route (default: all traffic)
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
                value={formData["persistent_keepalive"] || 25}
                onChange={(e) => handleChange("persistent_keepalive", parseInt(e.target.value, 10))}
              />
              <p className="text-sm text-muted-foreground">
                How often to send keepalive packets (0 = disabled, recommended: 25)
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
                value={formData["expiration_date"] || ""}
                onChange={(e) => handleChange("expiration_date", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                When this peer&apos;s access should expire (leave blank for no expiration)
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
              <p className="text-sm text-muted-foreground">Internal notes for reference</p>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={createPeer.isPending || servers?.length === 0}>
                {createPeer.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Peer
                  </>
                )}
              </Button>
              <Link href="/dashboard/network/wireguard/peers">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>When you create a peer, the system will automatically:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Generate a unique public/private key pair for the peer</li>
            <li>Allocate an available IP address from the server&apos;s subnet</li>
            <li>Create the WireGuard configuration file</li>
            <li>Make the configuration available for download</li>
          </ul>
          <p className="mt-4 font-medium">
            After creation, you can download the configuration file and import it into the WireGuard
            client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
