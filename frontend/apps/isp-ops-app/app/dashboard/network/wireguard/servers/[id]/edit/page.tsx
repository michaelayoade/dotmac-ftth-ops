"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Server Edit Form
 *
 * Form for editing existing WireGuard VPN servers.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { ArrowLeft, Server, Save, AlertCircle, Info } from "lucide-react";
import { useWireGuardServer, useUpdateWireGuardServer } from "@/hooks/useWireGuard";
import type { WireGuardServerUpdate, WireGuardServerStatus } from "@/types/wireguard";

interface EditServerPageProps {
  params: {
    id: string;
  };
}

export default function EditServerPage({ params }: EditServerPageProps): JSX.Element {
  const { id } = params;
  const router = useRouter();

  const { data: server, isLoading, error: loadError } = useWireGuardServer(id);
  const { mutate: updateServer, isPending, error: updateError } = useUpdateWireGuardServer();

  const [formData, setFormData] = useState<WireGuardServerUpdate>({});
  const [dnsInput, setDnsInput] = useState("");
  const [allowedIpsInput, setAllowedIpsInput] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form data when server loads
  useEffect(() => {
    if (server) {
      setFormData({
        name: server["name"],
        description: server["description"],
        public_endpoint: server["public_endpoint"],
        status: server["status"],
        max_peers: server["max_peers"],
        dns_servers: server["dns_servers"],
        allowed_ips: server["allowed_ips"],
        persistent_keepalive: server["persistent_keepalive"],
        location: server["location"],
        metadata: server["metadata_"],
      });
      setDnsInput(server["dns_servers"].join(", "));
      setAllowedIpsInput(server["allowed_ips"].join(", "));
    }
  }, [server]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData["name"] && !formData["name"].trim()) {
      errors["name"] = "Server name cannot be empty";
    }

    if (formData["public_endpoint"] && !formData["public_endpoint"].trim()) {
      errors["public_endpoint"] = "Public endpoint cannot be empty";
    }

    if (formData["max_peers"] && (formData["max_peers"] < 1 || formData["max_peers"] > 65535)) {
      errors["max_peers"] = "Max peers must be between 1 and 65535";
    }

    const dns_servers = dnsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (dns_servers.length === 0) {
      errors["dns_servers"] = "At least one DNS server is required";
    }

    const allowed_ips = allowedIpsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (allowed_ips.length === 0) {
      errors["allowed_ips"] = "At least one allowed IP range is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Parse DNS servers and allowed IPs
    const dns_servers = dnsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    const allowed_ips = allowedIpsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    const submitData: WireGuardServerUpdate = {
      ...formData,
      dns_servers,
      allowed_ips,
      description: formData["description"] || null,
      location: formData["location"] || null,
    };

    updateServer(
      { serverId: id, data: submitData },
      {
        onSuccess: () => {
          router.push(`/dashboard/network/wireguard/servers/${id}`);
        },
      },
    );
  };

  const handleFieldChange = (field: keyof WireGuardServerUpdate, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading server...</p>
        </div>
      </div>
    );
  }

  if (loadError || !server) {
    return (
      <div className="space-y-6 p-6">
        <Card className="p-6">
          <p className="text-red-500">
            Error loading server: {String(loadError) || "Server not found"}
          </p>
          <Button className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="h-8 w-8" />
            Edit Server: {server["name"]}
          </h1>
          <p className="text-muted-foreground mt-1">Update server configuration and settings</p>
        </div>
      </div>

      {/* Info Notice */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2 text-blue-900">
          <Info className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Note</p>
            <p className="text-sm mt-1">
              Network configuration fields (IPv4, IPv6, listen port, keys) cannot be changed after
              server creation for security reasons.
            </p>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {updateError && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-900">
            <AlertCircle className="h-5 w-5" />
            <p className="font-semibold">Error updating server</p>
          </div>
          <p className="text-sm text-red-800 mt-1">{String(updateError)}</p>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Server Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData["name"] || ""}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["name"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["name"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["name"]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData["description"] || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input
                type="text"
                value={formData["location"] || ""}
                onChange={(e) => handleFieldChange("location", e.target.value)}
                placeholder="e.g., New York, US"
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData["status"] || server["status"]}
                onChange={(e) =>
                  handleFieldChange("status", e.target.value as WireGuardServerStatus)
                }
                className="w-full px-4 py-2 border rounded-md"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="degraded">Degraded</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Set to inactive or maintenance to prevent new connections
              </p>
            </div>
          </div>
        </Card>

        {/* Read-Only Network Configuration */}
        <Card className="p-6 bg-gray-50">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Network Configuration
            <Badge variant="outline">Read Only</Badge>
          </h2>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">
                  Public Endpoint
                </label>
                <input
                  type="text"
                  value={server["public_endpoint"]}
                  disabled
                  className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Listen Port</label>
                <input
                  type="text"
                  value={server["listen_port"]}
                  disabled
                  className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Server IPv4</label>
                <input
                  type="text"
                  value={server["server_ipv4"]}
                  disabled
                  className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              {server["server_ipv6"] && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">
                    Server IPv6
                  </label>
                  <input
                    type="text"
                    value={server["server_ipv6"]}
                    disabled
                    className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Public Key</label>
              <input
                type="text"
                value={server["public_key"]}
                disabled
                className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed font-mono text-xs"
              />
            </div>
          </div>
        </Card>

        {/* Editable Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Server Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Public Endpoint <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData["public_endpoint"] || ""}
                onChange={(e) => handleFieldChange("public_endpoint", e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["public_endpoint"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["public_endpoint"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["public_endpoint"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Update if the public DNS or IP changes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Max Peers <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData["max_peers"] || 0}
                onChange={(e) => handleFieldChange("max_peers", parseInt(e.target.value))}
                min={server["current_peers"]}
                max={65535}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["max_peers"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["max_peers"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["max_peers"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Current peers: {server["current_peers"]}. Cannot set below this value.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                DNS Servers <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={dnsInput}
                onChange={(e) => setDnsInput(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["dns_servers"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["dns_servers"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["dns_servers"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated DNS servers (affects new peer configs)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Allowed IPs <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={allowedIpsInput}
                onChange={(e) => setAllowedIpsInput(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["allowed_ips"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["allowed_ips"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["allowed_ips"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated CIDR ranges (affects new peer configs)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Persistent Keepalive (seconds)
              </label>
              <input
                type="number"
                value={formData["persistent_keepalive"] || 0}
                onChange={(e) =>
                  handleFieldChange("persistent_keepalive", parseInt(e.target.value))
                }
                min={0}
                max={300}
                className="w-full px-4 py-2 border rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Keepalive interval (0 = disabled, default: 25)
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending} size="lg" className="flex-1">
            <Save className="mr-2 h-5 w-5" />
            {isPending ? "Saving Changes..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
