"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard VPN Provisioning Page
 *
 * One-click provisioning wizard to create a complete VPN service:
 * - Creates a WireGuard server
 * - Creates initial peer(s)
 * - Provides download links for configuration
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProvisionVPNService } from "@/hooks/useWireGuard";
import type { VPNProvisionRequest } from "@/types/wireguard";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  ArrowLeft,
  Loader2,
  Zap,
  Server,
  Users,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@dotmac/ui";

type ProvisioningStep = "form" | "provisioning" | "success" | "error";

interface ProvisioningResult {
  server_id: string;
  server_name: string;
  peer_ids: string[];
  peer_names: string[];
}

export default function ProvisionVPNPage() {
  const router = useRouter();
  const { toast } = useToast();
  const provisionService = useProvisionVPNService();

  const [step, setStep] = useState<ProvisioningStep>("form");
  const [result, setResult] = useState<ProvisioningResult | null>(null);

  const [formData, setFormData] = useState<VPNProvisionRequest>({
    customer_id: "",
    peer_name: "",
    server_name: "",
    server_location: "",
    listen_port: 51820,
    subnet: "10.8.0.0/24",
    dns_servers: "1.1.1.1, 8.8.8.8",
    initial_peer_count: 1,
    peer_name_prefix: "peer",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData["server_name"] || formData["server_name"].trim().length === 0) {
      newErrors["server_name"] = "Server name is required";
    }

    if (!formData["server_location"] || formData["server_location"].trim().length === 0) {
      newErrors["server_location"] = "Server location is required";
    }

    if (
      !formData["listen_port"] ||
      formData["listen_port"] < 1 ||
      formData["listen_port"] > 65535
    ) {
      newErrors["listen_port"] = "Port must be between 1 and 65535";
    }

    if (!formData["subnet"]) {
      newErrors["subnet"] = "Subnet is required";
    } else if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(formData["subnet"])) {
      newErrors["subnet"] = "Invalid subnet format (use CIDR notation, e.g., 10.8.0.0/24)";
    }

    if ((formData["initial_peer_count"] ?? 0) < 0 || (formData["initial_peer_count"] ?? 0) > 10) {
      newErrors["initial_peer_count"] = "Peer count must be between 0 and 10";
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

    setStep("provisioning");

    provisionService.mutate(formData, {
      onSuccess: (data) => {
        setResult({
          server_id: data["server"].id,
          server_name: data["server"].name,
          peer_ids: data["peers"]?.map((p: any) => p.id) ?? [],
          peer_names: data["peers"]?.map((p: any) => p.peer_name) ?? [],
        });
        setStep("success");
        toast({
          title: "VPN Service Provisioned",
          description: `Server "${data["server"].name}" and ${data["peers"]?.length ?? 0} peer(s) created successfully`,
        });
      },
      onError: (error: any) => {
        setStep("error");
        toast({
          title: "Provisioning Failed",
          description: error["response"]?.["data"]?.detail || "Failed to provision VPN service",
          variant: "destructive",
        });
      },
    });
  };

  const handleChange = (field: keyof VPNProvisionRequest, value: any) => {
    setFormData((prev: VPNProvisionRequest) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: any) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Form Step
  if (step === "form") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/dashboard/network/wireguard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">Provision VPN Service</h1>
            <p className="text-muted-foreground mt-1">
              One-click setup for a complete WireGuard VPN service
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            This wizard will create a complete VPN service including server configuration, key
            generation, and initial peer(s). Perfect for quick deployments!
          </AlertDescription>
        </Alert>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Server Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Server Configuration
                </CardTitle>
                <CardDescription>Basic server settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server_name">
                    Server Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="server_name"
                    value={formData["server_name"]}
                    onChange={(e) => handleChange("server_name", e.target.value)}
                    placeholder="e.g., vpn-us-east-1"
                  />
                  {errors["server_name"] && (
                    <p className="text-sm text-red-500">{errors["server_name"]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="server_location">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="server_location"
                    value={formData["server_location"]}
                    onChange={(e) => handleChange("server_location", e.target.value)}
                    placeholder="e.g., US East (Virginia)"
                  />
                  {errors["server_location"] && (
                    <p className="text-sm text-red-500">{errors["server_location"]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="listen_port">Listen Port</Label>
                  <Input
                    id="listen_port"
                    type="number"
                    min={1}
                    max={65535}
                    value={formData["listen_port"]}
                    onChange={(e) => handleChange("listen_port", parseInt(e.target.value, 10))}
                  />
                  <p className="text-sm text-muted-foreground">Default: 51820</p>
                  {errors["listen_port"] && (
                    <p className="text-sm text-red-500">{errors["listen_port"]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subnet">VPN Subnet</Label>
                  <Input
                    id="subnet"
                    value={formData["subnet"]}
                    onChange={(e) => handleChange("subnet", e.target.value)}
                    placeholder="10.8.0.0/24"
                  />
                  <p className="text-sm text-muted-foreground">CIDR notation</p>
                  {errors["subnet"] && <p className="text-sm text-red-500">{errors["subnet"]}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dns_servers">DNS Servers</Label>
                  <Input
                    id="dns_servers"
                    value={formData["dns_servers"]}
                    onChange={(e) => handleChange("dns_servers", e.target.value)}
                    placeholder="1.1.1.1, 8.8.8.8"
                  />
                  <p className="text-sm text-muted-foreground">Comma-separated</p>
                </div>
              </CardContent>
            </Card>

            {/* Peer Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Initial Peers
                </CardTitle>
                <CardDescription>Configure initial peer creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="initial_peer_count">Number of Peers</Label>
                  <Select
                    value={formData["initial_peer_count"]?.toString() ?? "0"}
                    onValueChange={(value) =>
                      handleChange("initial_peer_count", parseInt(value, 10))
                    }
                  >
                    <SelectTrigger id="initial_peer_count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 (server only)</SelectItem>
                      <SelectItem value="1">1 peer</SelectItem>
                      <SelectItem value="2">2 peers</SelectItem>
                      <SelectItem value="3">3 peers</SelectItem>
                      <SelectItem value="5">5 peers</SelectItem>
                      <SelectItem value="10">10 peers</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    How many peers to create initially
                  </p>
                  {errors["initial_peer_count"] && (
                    <p className="text-sm text-red-500">{errors["initial_peer_count"]}</p>
                  )}
                </div>

                {(formData["initial_peer_count"] ?? 0) > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="peer_name_prefix">Peer Name Prefix</Label>
                    <Input
                      id="peer_name_prefix"
                      value={formData["peer_name_prefix"]}
                      onChange={(e) => handleChange("peer_name_prefix", e.target.value)}
                      placeholder="peer"
                    />
                    <p className="text-sm text-muted-foreground">
                      Peers will be named: {formData["peer_name_prefix"]}-1,{" "}
                      {formData["peer_name_prefix"]}-2, etc.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData["notes"] || ""}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Notes about this VPN service..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* What Will Be Created */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>What Will Be Created</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    1 WireGuard server with auto-generated keys at{" "}
                    <span className="font-mono">{formData["subnet"]}</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {formData["initial_peer_count"] || 0} peer(s) with unique keys and IP addresses
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Downloadable configuration files for each peer</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Ready-to-use VPN infrastructure in seconds</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <Button type="submit" size="lg">
              <Zap className="h-4 w-4 mr-2" />
              Provision VPN Service
            </Button>
            <Link href="/dashboard/network/wireguard">
              <Button type="button" variant="outline" size="lg">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    );
  }

  // Provisioning Step
  if (step === "provisioning") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-6">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Provisioning VPN Service...</h2>
          <p className="text-muted-foreground">
            Creating server, generating keys, and configuring peers
          </p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground text-center">
          <p>⚡ Generating cryptographic keys</p>
          <p>🌐 Allocating IP addresses</p>
          <p>📝 Creating configuration files</p>
        </div>
      </div>
    );
  }

  // Success Step
  if (step === "success" && result) {
    return (
      <div className="space-y-6">
        {/* Success Header */}
        <div className="flex flex-col items-center text-center space-y-4 py-8">
          <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">VPN Service Provisioned!</h1>
            <p className="text-muted-foreground mt-2">Your WireGuard VPN service is ready to use</p>
          </div>
        </div>

        {/* Results */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Server Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Server Created
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Server Name</p>
                <p className="font-medium">{result["server_name"]}</p>
              </div>
              <Link href={`/dashboard/network/wireguard/servers/${result["server_id"]}`}>
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Server Details
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Peers Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Peers Created
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Count</p>
                <p className="font-medium">{result["peer_ids"].length} peer(s)</p>
              </div>
              {result["peer_names"].length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Peer Names</p>
                  <div className="flex flex-wrap gap-2">
                    {result["peer_names"].map((name, idx) => (
                      <Badge key={idx} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">To start using your VPN:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Download peer configuration files from the peer details pages</li>
                <li>Import the configuration into WireGuard client app</li>
                <li>Activate the VPN connection</li>
                <li>Verify connectivity</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              {result["peer_ids"].map((peerId, idx) => (
                <Link key={peerId} href={`/dashboard/network/wireguard/peers/${peerId}`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Download Config for {result["peer_names"][idx]}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href="/dashboard/network/wireguard">
            <Button>Go to WireGuard Dashboard</Button>
          </Link>
          <Link href={`/dashboard/network/wireguard/servers/${result["server_id"]}`}>
            <Button variant="outline">View Server</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setStep("form");
              setResult(null);
            }}
          >
            Provision Another
          </Button>
        </div>
      </div>
    );
  }

  // Error Step
  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-6">
        <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Provisioning Failed</h2>
          <p className="text-muted-foreground">
            An error occurred while provisioning the VPN service
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setStep("form")}>Try Again</Button>
          <Link href="/dashboard/network/wireguard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
