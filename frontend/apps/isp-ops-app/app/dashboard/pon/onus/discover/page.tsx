"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { ArrowLeft, Search, RefreshCw, AlertCircle, CheckCircle, Play, Zap } from "lucide-react";
import Link from "next/link";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { DiscoveredONU, ONUProvisionRequest } from "@/types/voltha";

interface ProvisionForm {
  serial_number: string;
  olt_device_id: string;
  pon_port: number;
  subscriber_id?: string | undefined;
  vlan?: number | undefined;
  bandwidth_profile?: string | undefined;
  line_profile_id?: string | undefined;
  service_profile_id?: string | undefined;
}

const initialForm: ProvisionForm = {
  serial_number: "",
  olt_device_id: "",
  pon_port: 0,
};

const normalizeDiscovery = (onu: DiscoveredONU): DiscoveredONU => ({
  ...onu,
  metadata: onu["metadata"] ?? {},
});

function ONUDiscoverPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedONU, setSelectedONU] = useState<DiscoveredONU | null>(null);
  const [provisionForm, setProvisionForm] = useState<ProvisionForm>(initialForm);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: discoveredONUs = [],
    isLoading,
    refetch,
  } = useQuery<DiscoveredONU[]>({
    queryKey: ["access-discover-onus"],
    queryFn: async () => {
      const response = await apiClient.get<DiscoveredONU[]>("/access/discover-onus");
      return (response["data"] || []).map(normalizeDiscovery);
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (form: ProvisionForm) => {
      const payload: ONUProvisionRequest = {
        serial_number: form["serial_number"],
        olt_device_id: form["olt_device_id"],
        pon_port: form["pon_port"],
      };
      if (form["subscriber_id"]) {
        payload.subscriber_id = form["subscriber_id"];
      }
      if (form["vlan"] !== undefined) {
        payload.vlan = form["vlan"];
      }
      if (form["bandwidth_profile"]) {
        payload.bandwidth_profile = form["bandwidth_profile"];
      }
      if (form["line_profile_id"]) {
        payload.line_profile_id = form["line_profile_id"];
      }
      if (form["service_profile_id"]) {
        payload.service_profile_id = form["service_profile_id"];
      }
      const response = await apiClient.post(
        `/access/olts/${encodeURIComponent(form["olt_device_id"])}/onus`,
        payload,
      );
      return response["data"];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-discover-onus"] });
      queryClient.invalidateQueries({ queryKey: ["access-devices"] });
      setSelectedONU(null);
      setProvisionForm(initialForm);
      toast({ title: "ONU provisioned successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Provisioning failed",
        description:
          error?.["response"]?.["data"]?.detail || error?.["message"] || "Failed to provision ONU",
        variant: "destructive",
      });
    },
  });

  const filteredONUs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return discoveredONUs;
    }
    return discoveredONUs.filter((onu) => {
      const metadata = onu["metadata"] || {};
      const oltId = String(metadata["olt_id"] ?? "").toLowerCase();
      const vendor = String(metadata["vendor_id"] ?? "").toLowerCase();
      return (
        onu["serial_number"].toLowerCase().includes(query) ||
        oltId.includes(query) ||
        vendor.includes(query)
      );
    });
  }, [discoveredONUs, searchQuery]);

  const handleSelectONU = (onu: DiscoveredONU) => {
    const metadata = onu["metadata"] || {};
    const ponPort = Number(metadata["pon_port"] ?? metadata["port"] ?? 0);
    setSelectedONU(onu);
    const nextForm: ProvisionForm = {
      serial_number: onu["serial_number"],
      olt_device_id: String(metadata["olt_id"] ?? onu["onu_id"].split(":")[0] ?? ""),
      pon_port: Number.isFinite(ponPort) ? ponPort : 0,
    };
    if (metadata["subscriber_id"]) {
      nextForm.subscriber_id = metadata["subscriber_id"];
    }
    if (metadata["vlan"] !== undefined && metadata["vlan"] !== null) {
      nextForm.vlan = Number(metadata["vlan"]);
    }
    if (metadata["bandwidth_profile"]) {
      nextForm.bandwidth_profile = metadata["bandwidth_profile"];
    }
    if (metadata["line_profile_id"]) {
      nextForm.line_profile_id = metadata["line_profile_id"];
    }
    if (metadata["service_profile_id"]) {
      nextForm.service_profile_id = metadata["service_profile_id"];
    }
    setProvisionForm(nextForm);
  };

  const handleProvision = () => {
    if (!provisionForm.serial_number || !provisionForm.olt_device_id) {
      toast({
        title: "Missing required fields",
        description: "Serial number and OLT device ID are required",
        variant: "destructive",
      });
      return;
    }

    provisionMutation.mutate(provisionForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/pon/onus">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">ONU Discovery</h1>
            <p className="text-sm text-muted-foreground">
              Discover and provision new ONUs on the access network
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Scan Network
        </Button>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                About ONU Discovery
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This page scans registered OLTs for ONUs that are detected by drivers but have not
                yet been provisioned. Select a discovered ONU to review metadata and push service
                configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Discovered ONUs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Discovered ONUs ({filteredONUs.length})</CardTitle>
                <CardDescription>Results provided by access drivers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by serial number, vendor, or OLT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Scanning network for ONUs...</p>
              </div>
            ) : filteredONUs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No ONUs match your search" : "No discovered ONUs found"}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredONUs.map((onu) => {
                  const metadata = onu["metadata"] || {};
                  return (
                    <button
                      type="button"
                      key={`${onu["serial_number"]}-${metadata["olt_id"] ?? ""}-${metadata["pon_port"] ?? ""}`}
                      className={`w-full text-left border rounded-lg p-3 transition-colors ${
                        selectedONU?.serial_number === onu["serial_number"]
                          ? "border-primary bg-accent"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => handleSelectONU(onu)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-600" />
                          <span className="font-medium">{onu["serial_number"]}</span>
                        </div>
                        <Badge
                          variant={
                            onu["state"].toLowerCase() === "provisioned" ? "secondary" : "outline"
                          }
                        >
                          {onu["state"]}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>OLT: {metadata["olt_id"] ?? "Unknown"}</p>
                        <p>PON Port: {metadata["pon_port"] ?? "Unknown"}</p>
                        {metadata["vendor_id"] && <p>Vendor: {metadata["vendor_id"]}</p>}
                        {metadata["rssi"] && <p>RSSI: {metadata["rssi"]}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provisioning Form */}
        <Card>
          <CardHeader>
            <CardTitle>Provision ONU</CardTitle>
            <CardDescription>Configure and activate the selected ONU</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedONU ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a discovered ONU to begin provisioning</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number *</Label>
                  <Input id="serial" value={provisionForm.serial_number} readOnly />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="olt">OLT Device ID *</Label>
                  <Input
                    id="olt"
                    value={provisionForm.olt_device_id}
                    onChange={(e) =>
                      setProvisionForm({ ...provisionForm, olt_device_id: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">PON Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={provisionForm.pon_port}
                    onChange={(e) =>
                      setProvisionForm({
                        ...provisionForm,
                        pon_port: Number.isFinite(parseInt(e.target.value, 10))
                          ? parseInt(e.target.value, 10)
                          : 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscriber">Subscriber ID (Optional)</Label>
                  <Input
                    id="subscriber"
                    placeholder="Enter subscriber ID"
                    value={provisionForm.subscriber_id || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setProvisionForm((prev) => {
                        const next = { ...prev };
                        if (value) {
                          next.subscriber_id = value;
                        } else {
                          delete next.subscriber_id;
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vlan">Service VLAN (Optional)</Label>
                  <Input
                    id="vlan"
                    type="number"
                    placeholder="e.g., 100"
                    value={provisionForm.vlan ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProvisionForm((prev) => {
                        const next = { ...prev };
                        if (value) {
                          const parsed = parseInt(value, 10);
                          if (!Number.isNaN(parsed)) {
                            next.vlan = parsed;
                          } else {
                            delete next.vlan;
                          }
                        } else {
                          delete next.vlan;
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bandwidth">Bandwidth Profile (Optional)</Label>
                  <Input
                    id="bandwidth"
                    placeholder="e.g., 100M"
                    value={provisionForm.bandwidth_profile || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setProvisionForm((prev) => {
                        const next = { ...prev };
                        if (value) {
                          next.bandwidth_profile = value;
                        } else {
                          delete next.bandwidth_profile;
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="line-profile">Line Profile ID (Optional)</Label>
                  <Input
                    id="line-profile"
                    placeholder="Driver-specific line profile"
                    value={provisionForm.line_profile_id || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setProvisionForm((prev) => {
                        const next = { ...prev };
                        if (value) {
                          next.line_profile_id = value;
                        } else {
                          delete next.line_profile_id;
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-profile">Service Profile ID (Optional)</Label>
                  <Input
                    id="service-profile"
                    placeholder="Driver-specific service profile"
                    value={provisionForm.service_profile_id || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setProvisionForm((prev) => {
                        const next = { ...prev };
                        if (value) {
                          next.service_profile_id = value;
                        } else {
                          delete next.service_profile_id;
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="pt-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedONU(null);
                      setProvisionForm(initialForm);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleProvision}
                    disabled={provisionMutation.isPending}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Provision ONU
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ONUDiscoverPage() {
  return (
    <RouteGuard permission="isp.network['pon'].write">
      <ONUDiscoverPageContent />
    </RouteGuard>
  );
}
