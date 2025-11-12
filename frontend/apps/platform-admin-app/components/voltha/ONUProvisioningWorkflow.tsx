"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Server,
  Radio,
  Wifi,
  Info,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import {
  DiscoveredONU,
  ONUProvisionRequest,
  LogicalDevice,
} from "@/types/voltha";

interface ONUProvisioningWorkflowProps {
  olts: LogicalDevice[];
}

export function ONUProvisioningWorkflow({ olts }: ONUProvisioningWorkflowProps) {
  const { toast } = useToast();

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [discoveredONUs, setDiscoveredONUs] = useState<DiscoveredONU[]>([]);
  const [selectedONU, setSelectedONU] = useState<DiscoveredONU | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  // Provision form state
  const createEmptyProvisionForm = (): ONUProvisionRequest => ({
    serial_number: "",
    olt_device_id: "",
    pon_port: 0,
  });
  const [provisionForm, setProvisionForm] = useState<ONUProvisionRequest>(createEmptyProvisionForm);

  const discoverONUs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<DiscoveredONU[]>("/access/discover-onus");
      const discoveries = (response.data || []).map((onu) => ({ ...onu, metadata: onu.metadata ?? {} }));
      setDiscoveredONUs(discoveries);

      toast({
        title: "ONU Discovery Complete",
        description: `Found ${discoveries.length} ONUs`,
      });
    } catch (err: any) {
      toast({
        title: "Discovery Failed",
        description: err?.response?.data?.detail || "Could not discover ONUs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (showDiscoveryModal) {
      discoverONUs();
    }
  }, [discoverONUs, showDiscoveryModal]);

  const handleSelectONU = (onu: DiscoveredONU) => {
    setSelectedONU(onu);
    const metadata = onu.metadata || {};
    const ponPort = Number(metadata['pon_port'] ?? 0);
    setProvisionForm({
      serial_number: onu.serial_number,
      olt_device_id: String(metadata['olt_id'] ?? ""),
      pon_port: Number.isFinite(ponPort) ? ponPort : 0,
      subscriber_id: metadata['subscriber_id'],
      vlan: metadata['vlan'],
      bandwidth_profile: metadata['bandwidth_profile'],
      line_profile_id: metadata['line_profile_id'],
      service_profile_id: metadata['service_profile_id'],
    });
    setShowDiscoveryModal(false);
    setShowProvisionModal(true);
  };

  const handleProvisionONU = async () => {
    if (!provisionForm.serial_number || !provisionForm.olt_device_id) {
      toast({
        title: "Invalid Form",
        description: "Serial number and OLT device ID are required",
        variant: "destructive",
      });
      return;
    }

    setProvisioning(true);
    try {
      const response = await apiClient.post(
        `/access/olts/${encodeURIComponent(provisionForm.olt_device_id)}/onus`,
        provisionForm,
      );

      const message = response.data?.message || "Provisioning request submitted";
      toast({
        title: "ONU Provisioned",
        description: message,
      });

      setShowProvisionModal(false);
      setSelectedONU(null);
      setProvisionForm(createEmptyProvisionForm());

      // Refresh discovered ONUs
      if (showDiscoveryModal) {
        discoverONUs();
      }
    } catch (err: any) {
      toast({
        title: "Provisioning Failed",
        description: err?.response?.data?.detail || "Could not provision ONU",
        variant: "destructive",
      });
    } finally {
      setProvisioning(false);
    }
  };

  const handleManualProvision = () => {
    setSelectedONU(null);
    const defaultOltId = olts.length > 0 ? olts[0]?.root_device_id || olts[0]?.id || "" : "";
    const base = createEmptyProvisionForm();
    setProvisionForm({
      ...base,
      olt_device_id: defaultOltId,
    });
    setShowProvisionModal(true);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setShowDiscoveryModal(true)}>
          <Search className="w-4 h-4 mr-2" />
          Discover ONUs
        </Button>
        <Button variant="outline" onClick={handleManualProvision}>
          <Plus className="w-4 h-4 mr-2" />
          Manual Provision
        </Button>
      </div>

      {/* ONU Discovery Modal */}
      <Dialog open={showDiscoveryModal} onOpenChange={setShowDiscoveryModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discovered ONUs</DialogTitle>
            <DialogDescription>
              Select an ONU to provision or refresh to scan again
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : discoveredONUs.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No ONUs Found</AlertTitle>
                <AlertDescription>
                  No unprovisioned ONUs were discovered. Make sure ONUs are connected and powered
                  on.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-3">
                  {discoveredONUs.map((onu) => {
                    const metadata = onu.metadata || {};
                    const isProvisioned = (onu.state || "").toLowerCase() === "provisioned";
                    return (
                      <Card
                        key={`${onu.serial_number}-${metadata['olt_id'] ?? "unknown"}-${metadata['pon_port'] ?? "na"}`}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isProvisioned ? "opacity-60" : ""
                        }`}
                        onClick={() => !isProvisioned && handleSelectONU(onu)}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Server className="w-5 h-5" />
                              <div>
                                <div className="font-medium">{onu.serial_number}</div>
                                <div className="text-xs text-muted-foreground">
                                  OLT: {metadata['olt_id'] || "Unknown"} • Port: {metadata['pon_port'] ?? "N/A"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  State: {onu.state || "Unknown"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isProvisioned ? (
                                <Badge variant="outline" className="bg-green-50">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Provisioned
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Unprovisioned
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscoveryModal(false)}>
              Close
            </Button>
            <Button onClick={discoverONUs} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ONU Provisioning Modal */}
      <Dialog open={showProvisionModal} onOpenChange={setShowProvisionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Provision ONU</DialogTitle>
            <DialogDescription>Configure and provision an optical network unit</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedONU && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Auto-filled from Discovery</AlertTitle>
                <AlertDescription>
                  ONU details have been automatically populated from discovery
                </AlertDescription>
              </Alert>
            )}

            {/* Serial Number */}
            <div className="space-y-2">
              <Label htmlFor="serial_number">
                Serial Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="serial_number"
                value={provisionForm.serial_number}
                onChange={(e) =>
                  setProvisionForm({
                    ...provisionForm,
                    serial_number: e.target.value,
                  })
                }
                placeholder="ABCD12345678"
                disabled={!!selectedONU}
              />
            </div>

            {/* Parent OLT */}
            <div className="space-y-2">
              <Label htmlFor="olt_device_id">
                Parent OLT <span className="text-red-500">*</span>
              </Label>
              <Select
                value={provisionForm.olt_device_id}
                onValueChange={(value) =>
                  setProvisionForm({
                    ...provisionForm,
                    olt_device_id: value,
                  })
                }
              >
                <SelectTrigger id="olt_device_id">
                  <SelectValue placeholder="Select OLT" />
                </SelectTrigger>
                <SelectContent>
                  {olts.map((olt) => (
                    <SelectItem key={olt.id} value={olt.root_device_id || olt.id}>
                      {olt.id} ({olt.desc?.serial_num || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PON Port */}
            <div className="space-y-2">
              <Label htmlFor="pon_port">
                PON Port Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pon_port"
                type="number"
                min="0"
                value={provisionForm.pon_port}
                onChange={(e) =>
                  setProvisionForm({
                    ...provisionForm,
                    pon_port: Number.parseInt(e.target.value, 10) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">PON port on the OLT (typically 0-15)</p>
            </div>

            {/* Subscriber ID */}
            <div className="space-y-2">
              <Label htmlFor="subscriber_id">Subscriber ID (Optional)</Label>
              <Input
                id="subscriber_id"
                value={provisionForm.subscriber_id || ""}
                onChange={(e) => {
                  const newForm = { ...provisionForm };
                  if (e.target.value) {
                    newForm.subscriber_id = e.target.value;
                  } else {
                    delete newForm.subscriber_id;
                  }
                  setProvisionForm(newForm);
                }}
              />
            </div>

            {/* VLAN */}
            <div className="space-y-2">
              <Label htmlFor="vlan">Service VLAN (Optional)</Label>
              <Input
                id="vlan"
                type="number"
                min="1"
                max="4094"
                value={provisionForm.vlan ?? ""}
                onChange={(e) => {
                  const newForm = { ...provisionForm };
                  if (e.target.value) {
                    newForm.vlan = parseInt(e.target.value, 10);
                  } else {
                    delete newForm.vlan;
                  }
                  setProvisionForm(newForm);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Service VLAN for subscriber traffic (1-4094)
              </p>
            </div>

            {/* Bandwidth Profile */}
            <div className="space-y-2">
              <Label htmlFor="bandwidth_profile">Bandwidth Profile (Optional)</Label>
              <Input
                id="bandwidth_profile"
                value={provisionForm.bandwidth_profile || ""}
                onChange={(e) => {
                  const newForm = { ...provisionForm };
                  if (e.target.value) {
                    newForm.bandwidth_profile = e.target.value;
                  } else {
                    delete newForm.bandwidth_profile;
                  }
                  setProvisionForm(newForm);
                }}
              />
            </div>

            {/* Line Profile */}
            <div className="space-y-2">
              <Label htmlFor="line_profile_id">Line Profile ID (Optional)</Label>
              <Input
                id="line_profile_id"
                value={provisionForm.line_profile_id || ""}
                onChange={(e) => {
                  const newForm = { ...provisionForm };
                  if (e.target.value) {
                    newForm.line_profile_id = e.target.value;
                  } else {
                    delete newForm.line_profile_id;
                  }
                  setProvisionForm(newForm);
                }}
              />
            </div>

            {/* Service Profile */}
            <div className="space-y-2">
              <Label htmlFor="service_profile_id">Service Profile ID (Optional)</Label>
              <Input
                id="service_profile_id"
                value={provisionForm.service_profile_id || ""}
                onChange={(e) => {
                  const newForm = { ...provisionForm };
                  if (e.target.value) {
                    newForm.service_profile_id = e.target.value;
                  } else {
                    delete newForm.service_profile_id;
                  }
                  setProvisionForm(newForm);
                }}
              />
            </div>

            {/* Provisioning Steps Info */}
            <Alert>
              <Radio className="h-4 w-4" />
              <AlertTitle>Provisioning Steps</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 text-xs mt-2">
                  <li>Validate ONU serial number and parent OLT</li>
                  <li>Send configuration to the access network driver</li>
                  <li>Enable device and wait for activation</li>
                  <li>Configure VLAN and bandwidth profiles</li>
                  <li>Verify ONU comes online</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowProvisionModal(false);
                setSelectedONU(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleProvisionONU} disabled={provisioning}>
              {provisioning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Provision ONU
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
