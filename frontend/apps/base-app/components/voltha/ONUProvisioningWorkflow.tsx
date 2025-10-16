"use client";

import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  DiscoveredONU,
  ONUDiscoveryResponse,
  ONUProvisionRequest,
  ONUProvisionResponse,
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
  const [provisionForm, setProvisionForm] = useState({
    serial_number: "",
    parent_device_id: "",
    parent_port_no: 0,
    vlan: 100,
  });

  useEffect(() => {
    if (showDiscoveryModal) {
      discoverONUs();
    }
  }, [showDiscoveryModal]);

  const discoverONUs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ONUDiscoveryResponse>("/api/v1/voltha/onus/discover");
      setDiscoveredONUs(response.data.discovered_onus);

      toast({
        title: "ONU Discovery Complete",
        description: `Found ${response.data.total} ONUs (${response.data.unprovisioned_count} unprovisioned)`,
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
  };

  const handleSelectONU = (onu: DiscoveredONU) => {
    setSelectedONU(onu);
    setProvisionForm({
      serial_number: onu.serial_number,
      parent_device_id: onu.parent_device_id,
      parent_port_no: onu.parent_port_no,
      vlan: 100,
    });
    setShowDiscoveryModal(false);
    setShowProvisionModal(true);
  };

  const handleProvisionONU = async () => {
    if (!provisionForm.serial_number || !provisionForm.parent_device_id) {
      toast({
        title: "Invalid Form",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setProvisioning(true);
    try {
      const response = await apiClient.post<ONUProvisionResponse>(
        "/api/v1/voltha/onus/provision",
        provisionForm as ONUProvisionRequest
      );

      toast({
        title: "ONU Provisioned",
        description: response.data.message || `ONU ${response.data.serial_number} provisioned successfully`,
      });

      setShowProvisionModal(false);
      setSelectedONU(null);
      setProvisionForm({
        serial_number: "",
        parent_device_id: "",
        parent_port_no: 0,
        vlan: 100,
      });

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
    setProvisionForm({
      serial_number: "",
      parent_device_id: olts.length > 0 ? olts[0].root_device_id || "" : "",
      parent_port_no: 0,
      vlan: 100,
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
                  No unprovisioned ONUs were discovered. Make sure ONUs are connected and powered on.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-3">
                  {discoveredONUs.map((onu) => (
                    <Card
                      key={onu.serial_number}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        onu.provisioned ? "opacity-60" : ""
                      }`}
                      onClick={() => !onu.provisioned && handleSelectONU(onu)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server className="w-5 h-5" />
                            <div>
                              <div className="font-medium">{onu.serial_number}</div>
                              <div className="text-xs text-muted-foreground">
                                Vendor: {onu.vendor_id || "Unknown"} • Port: {onu.parent_port_no}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Discovered: {new Date(onu.discovered_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {onu.provisioned ? (
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
                  ))}
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
            <DialogDescription>
              Configure and provision an optical network unit
            </DialogDescription>
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
                  setProvisionForm({ ...provisionForm, serial_number: e.target.value })
                }
                placeholder="ABCD12345678"
                disabled={!!selectedONU}
              />
            </div>

            {/* Parent OLT */}
            <div className="space-y-2">
              <Label htmlFor="parent_device_id">
                Parent OLT <span className="text-red-500">*</span>
              </Label>
              <Select
                value={provisionForm.parent_device_id}
                onValueChange={(value) =>
                  setProvisionForm({ ...provisionForm, parent_device_id: value })
                }
                disabled={!!selectedONU}
              >
                <SelectTrigger id="parent_device_id">
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
              <Label htmlFor="parent_port_no">
                PON Port Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="parent_port_no"
                type="number"
                min="0"
                max="15"
                value={provisionForm.parent_port_no}
                onChange={(e) =>
                  setProvisionForm({ ...provisionForm, parent_port_no: parseInt(e.target.value) || 0 })
                }
                disabled={!!selectedONU}
              />
              <p className="text-xs text-muted-foreground">
                PON port on the OLT (typically 0-15)
              </p>
            </div>

            {/* VLAN */}
            <div className="space-y-2">
              <Label htmlFor="vlan">VLAN ID</Label>
              <Input
                id="vlan"
                type="number"
                min="1"
                max="4094"
                value={provisionForm.vlan}
                onChange={(e) =>
                  setProvisionForm({ ...provisionForm, vlan: parseInt(e.target.value) || 100 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Service VLAN for subscriber traffic (1-4094, default: 100)
              </p>
            </div>

            {/* Provisioning Steps Info */}
            <Alert>
              <Radio className="h-4 w-4" />
              <AlertTitle>Provisioning Steps</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 text-xs mt-2">
                  <li>Validate ONU serial number and parent OLT</li>
                  <li>Create device configuration in VOLTHA</li>
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
