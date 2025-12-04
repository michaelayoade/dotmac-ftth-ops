"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Server Create Form
 *
 * Form for creating new WireGuard VPN servers with validation.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { ArrowLeft, Server, Save, AlertCircle } from "lucide-react";
import { useCreateWireGuardServer } from "@/hooks/useWireGuard";
import type { WireGuardServerCreate } from "@/types/wireguard";

export default function CreateServerPage(): JSX.Element {
  const router = useRouter();
  const { mutate: createServer, isPending, error } = useCreateWireGuardServer();

  const [formData, setFormData] = useState<WireGuardServerCreate>({
    name: "",
    description: "",
    public_endpoint: "",
    listen_port: 51820,
    server_ipv4: "10.10.0.1/24",
    server_ipv6: "",
    location: "",
    max_peers: 254,
    dns_servers: ["1.1.1.1", "1.0.0.1"],
    allowed_ips: ["0.0.0.0/0", "::/0"],
    persistent_keepalive: 25,
    metadata: {},
  });

  const [dnsInput, setDnsInput] = useState((formData["dns_servers"] ?? []).join(", "));
  const [allowedIpsInput, setAllowedIpsInput] = useState(
    (formData["allowed_ips"] ?? []).join(", "),
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData["name"].trim()) {
      errors["name"] = "Server name is required";
    }

    if (!formData["public_endpoint"].trim()) {
      errors["public_endpoint"] = "Public endpoint is required";
    }

    const listenPort = formData["listen_port"] ?? 0;
    if (listenPort < 1 || listenPort > 65535) {
      errors["listen_port"] = "Port must be between 1 and 65535";
    }

    if (!formData["server_ipv4"]?.trim()) {
      errors["server_ipv4"] = "Server IPv4 address is required";
    } else if (!isValidCIDR(formData["server_ipv4"])) {
      errors["server_ipv4"] = "Invalid IPv4 CIDR format (e.g., 10.10.0.1/24)";
    }

    if (formData["server_ipv6"] && !isValidIPv6CIDR(formData["server_ipv6"])) {
      errors["server_ipv6"] = "Invalid IPv6 CIDR format";
    }

    const maxPeers = formData["max_peers"] ?? 0;
    if (maxPeers < 1 || maxPeers > 65535) {
      errors["max_peers"] = "Max peers must be between 1 and 65535";
    }

    if ((formData["dns_servers"]?.length ?? 0) === 0) {
      errors["dns_servers"] = "At least one DNS server is required";
    }

    if ((formData["allowed_ips"]?.length ?? 0) === 0) {
      errors["allowed_ips"] = "At least one allowed IP range is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidCIDR = (cidr: string): boolean => {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    return pattern.test(cidr);
  };

  const isValidIPv6CIDR = (cidr: string): boolean => {
    const pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;
    return pattern.test(cidr);
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

    const submitData: WireGuardServerCreate = {
      ...formData,
      description: formData["description"] || null,
      server_ipv6: formData["server_ipv6"] || null,
      location: formData["location"] || null,
      dns_servers,
      allowed_ips,
    };

    createServer(submitData, {
      onSuccess: (data) => {
        router.push(`/dashboard/network/wireguard/servers/${data["id"]}`);
      },
    });
  };

  const handleFieldChange = (field: keyof WireGuardServerCreate, value: unknown) => {
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
            Create WireGuard Server
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure a new VPN server to manage peer connections
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-900">
            <AlertCircle className="h-5 w-5" />
            <p className="font-semibold">Error creating server</p>
          </div>
          <p className="text-sm text-red-800 mt-1">{String(error)}</p>
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
                value={formData["name"]}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="e.g., US-East-VPN-1"
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
                placeholder="Optional description for this server"
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
          </div>
        </Card>

        {/* Network Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Network Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Public Endpoint <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData["public_endpoint"]}
                onChange={(e) => handleFieldChange("public_endpoint", e.target.value)}
                placeholder="e.g., vpn['example'].com:51820 or 203.0.113.1:51820"
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["public_endpoint"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["public_endpoint"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["public_endpoint"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The public address and port clients will connect to
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Listen Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData["listen_port"] ?? ""}
                onChange={(e) =>
                  handleFieldChange("listen_port", parseInt(e.target.value) || undefined)
                }
                min={1}
                max={65535}
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["listen_port"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["listen_port"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["listen_port"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Default: 51820</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Server IPv4 (CIDR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData["server_ipv4"] ?? ""}
                  onChange={(e) => handleFieldChange("server_ipv4", e.target.value)}
                  placeholder="e.g., 10.10.0.1/24"
                  className={`w-full px-4 py-2 border rounded-md ${
                    validationErrors["server_ipv4"] ? "border-red-500" : ""
                  }`}
                  required
                />
                {validationErrors["server_ipv4"] && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors["server_ipv4"]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Server IPv6 (CIDR)</label>
                <input
                  type="text"
                  value={formData["server_ipv6"] || ""}
                  onChange={(e) => handleFieldChange("server_ipv6", e.target.value)}
                  placeholder="e.g., fd42:42:42::1/64"
                  className={`w-full px-4 py-2 border rounded-md ${
                    validationErrors["server_ipv6"] ? "border-red-500" : ""
                  }`}
                />
                {validationErrors["server_ipv6"] && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors["server_ipv6"]}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Capacity & Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Capacity & Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Peers <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData["max_peers"] ?? ""}
                onChange={(e) =>
                  handleFieldChange("max_peers", parseInt(e.target.value) || undefined)
                }
                min={1}
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
                Maximum number of peer connections (default: 254)
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
                placeholder="e.g., 1.1.1.1, 1.0.0.1"
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["dns_servers"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["dns_servers"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["dns_servers"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated list of DNS servers for peers
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
                placeholder="e.g., 0.0.0.0/0, ::/0"
                className={`w-full px-4 py-2 border rounded-md ${
                  validationErrors["allowed_ips"] ? "border-red-500" : ""
                }`}
                required
              />
              {validationErrors["allowed_ips"] && (
                <p className="text-sm text-red-500 mt-1">{validationErrors["allowed_ips"]}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated CIDR ranges that peers can route through VPN
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Persistent Keepalive (seconds)
              </label>
              <input
                type="number"
                value={formData["persistent_keepalive"]}
                onChange={(e) =>
                  handleFieldChange("persistent_keepalive", parseInt(e.target.value))
                }
                min={0}
                max={300}
                className="w-full px-4 py-2 border rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Send keepalive packets every N seconds (0 = disabled, default: 25)
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending} size="lg" className="flex-1">
            <Save className="mr-2 h-5 w-5" />
            {isPending ? "Creating Server..." : "Create Server"}
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
