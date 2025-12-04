"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Server,
  Radio,
  Wifi,
  Info,
  Loader2,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import { Card, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { useDiscoveredONUs, useProvisionONU } from "@/hooks/useVOLTHA";
import {
  validateProvisionForm,
  getFirstError,
  sanitizeSerialNumber,
  sanitizeStringField,
} from "@/lib/utils/voltha-validation";
import { VLAN_CONFIG, PON_PORT_CONFIG } from "@/lib/constants/voltha";
import { DiscoveredONU, LogicalDevice, ONUProvisionRequest } from "@/types/voltha";

interface ONUProvisioningWorkflowProps {
  olts: LogicalDevice[];
}

export function ONUProvisioningWorkflow({ olts }: ONUProvisioningWorkflowProps) {
  const { toast } = useToast();

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [selectedONU, setSelectedONU] = useState<DiscoveredONU | null>(null);
  const [oltSelectOpen, setOltSelectOpen] = useState(false);

  // Use React Query hooks
  const { data: discoveredONUs = [], isLoading, refetch: discoverONUs } = useDiscoveredONUs();
  const provisionMutation = useProvisionONU({
    onSuccess: (data) => {
      toast({
        title: "ONU Provisioned",
        description: data.message || "ONU has been provisioned successfully",
      });
      setShowProvisionModal(false);
      setSelectedONU(null);
      setProvisionForm(createEmptyProvisionForm());
      if (showDiscoveryModal) {
        discoverONUs();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Provisioning Failed",
        description: error.message || "Could not provision ONU",
        variant: "destructive",
      });
    },
  });

  // Provision form state
  const createEmptyProvisionForm = (): ONUProvisionRequest => ({
    serial_number: "",
    olt_device_id: "",
    pon_port: 0,
    subscriber_id: undefined,
    vlan: undefined,
    bandwidth_profile: undefined,
    line_profile_id: undefined,
    service_profile_id: undefined,
  });

  const [provisionForm, setProvisionForm] = useState<ONUProvisionRequest>(
    createEmptyProvisionForm(),
  );

  // Trigger discovery when modal opens
  useEffect(() => {
    if (showDiscoveryModal) {
      discoverONUs();
      toast({
        title: "Discovering ONUs",
        description: "Scanning for unprovisioned ONUs...",
      });
    }
  }, [showDiscoveryModal, discoverONUs, toast]);

  const handleSelectONU = (onu: DiscoveredONU) => {
    setSelectedONU(onu);
    const metadata = onu.metadata || {};
    const ponPort = Number(metadata?.["pon_port"] ?? 0);

    setProvisionForm({
      serial_number: sanitizeSerialNumber(onu.serial_number),
      olt_device_id: String(metadata?.["olt_id"] ?? ""),
      pon_port: Number.isFinite(ponPort) ? ponPort : 0,
      subscriber_id: sanitizeStringField(metadata?.["subscriber_id"]),
      vlan: metadata?.["vlan"] ? Number(metadata["vlan"]) : undefined,
      bandwidth_profile: sanitizeStringField(metadata?.["bandwidth_profile"]),
      line_profile_id: sanitizeStringField(metadata?.["line_profile_id"]),
      service_profile_id: sanitizeStringField(metadata?.["service_profile_id"]),
    });
    setShowDiscoveryModal(false);
    setShowProvisionModal(true);
  };

  const handleProvisionONU = () => {
    // Validate form
    const validation = validateProvisionForm(provisionForm);
    if (!validation.isValid) {
      const errorMessage = getFirstError(validation);
      toast({
        title: "Validation Error",
        description: errorMessage || "Please check your input and try again",
        variant: "destructive",
      });
      return;
    }

    // Submit provision request
    provisionMutation.mutate(provisionForm);
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
        <Button
          onClick={() => setShowDiscoveryModal(true)}
          aria-label="Discover unprovisioned ONUs"
        >
          <Search className="w-4 h-4 mr-2" />
          Discover ONUs
        </Button>
        <Button
          variant="outline"
          onClick={handleManualProvision}
          aria-label="Manually provision an ONU"
        >
          <Plus className="w-4 h-4 mr-2" />
          Manual Provision
        </Button>
      </div>

      {/* ONU Discovery Modal */}
      <Dialog open={showDiscoveryModal} onOpenChange={setShowDiscoveryModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="">
            <DialogTitle>Discovered ONUs</DialogTitle>
            <DialogDescription>
              Select an ONU to provision or refresh to scan again
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoading ? (
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
              <div className="grid gap-3" role="list" aria-label="Discovered ONUs list">
                {discoveredONUs.map((onu) => {
                  const metadata = onu.metadata || {};
                  const isProvisioned = (onu.state || "").toLowerCase() === "provisioned";
                  return (
                    <Card
                      key={`${onu.serial_number}-${metadata?.["olt_id"] ?? "unknown"}-${metadata?.["pon_port"] ?? "na"}`}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isProvisioned ? "opacity-60" : ""
                      }`}
                      onClick={() => !isProvisioned && handleSelectONU(onu)}
                      role="button"
                      tabIndex={isProvisioned ? -1 : 0}
                      aria-label={`${isProvisioned ? "Provisioned" : "Select"} ONU ${onu.serial_number}`}
                      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === "Enter" && !isProvisioned) {
                          handleSelectONU(onu);
                        }
                      }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server className="w-5 h-5" aria-hidden="true" />
                            <div>
                              <div className="font-medium">{onu.serial_number}</div>
                              <div className="text-xs text-muted-foreground">
                                OLT: {metadata?.["olt_id"] || "Unknown"} • Port:{" "}
                                {metadata?.["pon_port"] ?? "N/A"}
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
                              <Badge variant="secondary" className="">
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
            )}
          </div>

          <DialogFooter className="">
            <Button variant="outline" onClick={() => setShowDiscoveryModal(false)}>
              Close
            </Button>
            <Button
              onClick={() => discoverONUs()}
              disabled={isLoading}
              aria-label="Refresh discovered ONUs"
            >
              <Search className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ONU Provisioning Modal */}
      <Dialog open={showProvisionModal} onOpenChange={setShowProvisionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="">
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
                Serial Number{" "}
                <span className="text-red-500" aria-label="required">
                  *
                </span>
              </Label>
              <Input
                id="serial_number"
                value={provisionForm.serial_number}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    serial_number: e.target.value,
                  })
                }
                placeholder="ABCD12345678"
                disabled={!!selectedONU}
                aria-required="true"
                aria-describedby="serial_number_help"
              />
              <p id="serial_number_help" className="text-xs text-muted-foreground">
                Alphanumeric, 8-16 characters
              </p>
            </div>

            {/* Parent OLT */}
            <div className="space-y-2">
              <Label htmlFor="olt_device_id">
                Parent OLT{" "}
                <span className="text-red-500" aria-label="required">
                  *
                </span>
              </Label>
              <Select
                value={provisionForm.olt_device_id}
                onValueChange={(value: string) =>
                  setProvisionForm({
                    ...provisionForm,
                    olt_device_id: value,
                  })
                }
                open={oltSelectOpen}
                onOpenChange={setOltSelectOpen}
              >
                <SelectTrigger id="olt_device_id" aria-required="true">
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
                PON Port Number{" "}
                <span className="text-red-500" aria-label="required">
                  *
                </span>
              </Label>
              <Input
                id="pon_port"
                type="number"
                min={PON_PORT_CONFIG.MIN_PORT}
                max={PON_PORT_CONFIG.MAX_PORT}
                value={provisionForm.pon_port}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    pon_port: Number.parseInt(e.target.value, 10) || 0,
                  })
                }
                aria-required="true"
                aria-describedby="pon_port_help"
              />
              <p id="pon_port_help" className="text-xs text-muted-foreground">
                PON port on the OLT (typically {PON_PORT_CONFIG.MIN_PORT}-{PON_PORT_CONFIG.MAX_PORT}
                )
              </p>
            </div>

            {/* Subscriber ID */}
            <div className="space-y-2">
              <Label htmlFor="subscriber_id">Subscriber ID (Optional)</Label>
              <Input
                id="subscriber_id"
                value={provisionForm.subscriber_id || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    subscriber_id: e.target.value || undefined,
                  })
                }
                aria-describedby="subscriber_id_help"
              />
              <p id="subscriber_id_help" className="text-xs text-muted-foreground">
                Link this ONU to a subscriber account
              </p>
            </div>

            {/* VLAN */}
            <div className="space-y-2">
              <Label htmlFor="vlan">Service VLAN (Optional)</Label>
              <Input
                id="vlan"
                type="number"
                min={VLAN_CONFIG.MIN_VLAN}
                max={VLAN_CONFIG.MAX_VLAN}
                value={provisionForm.vlan ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    vlan: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                aria-describedby="vlan_help"
              />
              <p id="vlan_help" className="text-xs text-muted-foreground">
                Service VLAN for subscriber traffic ({VLAN_CONFIG.MIN_VLAN}-{VLAN_CONFIG.MAX_VLAN})
              </p>
            </div>

            {/* Bandwidth Profile */}
            <div className="space-y-2">
              <Label htmlFor="bandwidth_profile">Bandwidth Profile (Optional)</Label>
              <Input
                id="bandwidth_profile"
                value={provisionForm.bandwidth_profile || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    bandwidth_profile: e.target.value || undefined,
                  })
                }
                aria-describedby="bandwidth_profile_help"
              />
              <p id="bandwidth_profile_help" className="text-xs text-muted-foreground">
                QoS bandwidth profile identifier
              </p>
            </div>

            {/* Line Profile */}
            <div className="space-y-2">
              <Label htmlFor="line_profile_id">Line Profile ID (Optional)</Label>
              <Input
                id="line_profile_id"
                value={provisionForm.line_profile_id || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    line_profile_id: e.target.value || undefined,
                  })
                }
                aria-describedby="line_profile_help"
              />
              <p id="line_profile_help" className="text-xs text-muted-foreground">
                ONU line configuration profile
              </p>
            </div>

            {/* Service Profile */}
            <div className="space-y-2">
              <Label htmlFor="service_profile_id">Service Profile ID (Optional)</Label>
              <Input
                id="service_profile_id"
                value={provisionForm.service_profile_id || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProvisionForm({
                    ...provisionForm,
                    service_profile_id: e.target.value || undefined,
                  })
                }
                aria-describedby="service_profile_help"
              />
              <p id="service_profile_help" className="text-xs text-muted-foreground">
                Service tier configuration profile
              </p>
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

          <DialogFooter className="">
            <Button
              variant="outline"
              onClick={() => {
                setShowProvisionModal(false);
                setSelectedONU(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProvisionONU}
              disabled={provisionMutation.isPending}
              aria-label="Provision ONU with current configuration"
            >
              {provisionMutation.isPending ? (
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
