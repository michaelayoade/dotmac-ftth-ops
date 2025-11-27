"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@dotmac/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { NetworkProfile } from "./NetworkProfileCard";

interface NetworkProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriberId: string;
  profile: NetworkProfile | null;
  onSuccess: () => void;
}

export function NetworkProfileEditDialog({
  open,
  onOpenChange,
  subscriberId,
  profile,
  onSuccess,
}: NetworkProfileEditDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildFormState = (currentProfile: NetworkProfile | null) => ({
    // VLAN
    serviceVlan: currentProfile?.serviceVlan?.toString() || "",
    innerVlan: currentProfile?.innerVlan?.toString() || "",
    vlanPool: currentProfile?.vlanPool || "",
    qinqEnabled: currentProfile?.qinqEnabled || false,

    // IP Addressing
    staticIpv4: currentProfile?.staticIpv4 || "",
    staticIpv6: currentProfile?.staticIpv6 || "",
    delegatedIpv6Prefix: currentProfile?.delegatedIpv6Prefix || "",
    ipv6PdSize: currentProfile?.ipv6PdSize?.toString() || "",
    ipv6AssignmentMode: currentProfile?.ipv6AssignmentMode || "none",

    // Option 82
    circuitId: currentProfile?.circuitId || "",
    remoteId: currentProfile?.remoteId || "",
    option82Policy: currentProfile?.option82Policy || "log",
  });

  // Form state
  const [formData, setFormData] = useState(() => buildFormState(profile ?? null));

  // Reset form when profile changes
  useEffect(() => {
    setFormData(buildFormState(profile ?? null));
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Build the profile input
      const profileInput: Record<string, unknown> = {};

      // VLAN configuration
      if (formData["serviceVlan"]) {
        profileInput["serviceVlan"] = parseInt(formData["serviceVlan"]);
      }
      if (formData["innerVlan"]) {
        profileInput["innerVlan"] = parseInt(formData["innerVlan"]);
      }
      if (formData["vlanPool"]) {
        profileInput["vlanPool"] = formData["vlanPool"];
      }
      profileInput["qinqEnabled"] = formData["qinqEnabled"];

      // IP addressing
      if (formData["staticIpv4"]) {
        profileInput["staticIpv4"] = formData["staticIpv4"];
      }
      if (formData["staticIpv6"]) {
        profileInput["staticIpv6"] = formData["staticIpv6"];
      }
      if (formData["delegatedIpv6Prefix"]) {
        profileInput["delegatedIpv6Prefix"] = formData["delegatedIpv6Prefix"];
      }
      if (formData["ipv6PdSize"]) {
        profileInput["ipv6PdSize"] = parseInt(formData["ipv6PdSize"]);
      }
      profileInput["ipv6AssignmentMode"] = formData["ipv6AssignmentMode"];

      // Option 82
      if (formData["circuitId"]) {
        profileInput["circuitId"] = formData["circuitId"];
      }
      if (formData["remoteId"]) {
        profileInput["remoteId"] = formData["remoteId"];
      }
      profileInput["option82Policy"] = formData["option82Policy"];

      // Make REST API call (you can also use GraphQL here)
      const response = await fetch(`/api/v1/network/subscribers/${subscriberId}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileInput),
      });

      if (!response["ok"]) {
        const error = await response.json();
        throw new Error(error["detail"] || "Failed to update network profile");
      }

      toast({
        title: "Success",
        description: "Network profile updated successfully",
      });

      onSuccess();
    } catch (error) {
      console.error("Error updating network profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error["message"] : "Failed to update network profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit" : "Configure"} Network Profile</DialogTitle>
          <DialogDescription>
            Configure VLAN, IP addressing, and DHCP Option 82 settings for this subscriber
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="vlan" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vlan">VLAN</TabsTrigger>
              <TabsTrigger value="ip">IP Addressing</TabsTrigger>
              <TabsTrigger value="option82">Option 82</TabsTrigger>
            </TabsList>

            {/* VLAN Configuration */}
            <TabsContent value="vlan" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceVlan">Service VLAN (S-VLAN)</Label>
                  <Input
                    id="serviceVlan"
                    type="number"
                    min="1"
                    max="4094"
                    placeholder="100"
                    value={formData["serviceVlan"]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, serviceVlan: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="innerVlan">Inner VLAN (C-VLAN)</Label>
                  <Input
                    id="innerVlan"
                    type="number"
                    min="1"
                    max="4094"
                    placeholder="200"
                    value={formData["innerVlan"]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, innerVlan: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vlanPool">VLAN Pool</Label>
                <Input
                  id="vlanPool"
                  placeholder="pool-business"
                  value={formData["vlanPool"]}
                  onChange={(e) => setFormData({ ...formData, vlanPool: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="qinqEnabled"
                  checked={formData["qinqEnabled"]}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, qinqEnabled: checked })
                  }
                />
                <Label htmlFor="qinqEnabled">Enable QinQ (802.1ad)</Label>
              </div>
            </TabsContent>

            {/* IP Addressing */}
            <TabsContent value="ip" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="staticIpv4">Static IPv4 Address</Label>
                <Input
                  id="staticIpv4"
                  placeholder="10.0.0.100"
                  value={formData["staticIpv4"]}
                  onChange={(e) => setFormData({ ...formData, staticIpv4: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staticIpv6">Static IPv6 Address</Label>
                <Input
                  id="staticIpv6"
                  placeholder="2001:db8::100"
                  value={formData["staticIpv6"]}
                  onChange={(e) => setFormData({ ...formData, staticIpv6: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delegatedIpv6Prefix">IPv6 Prefix Delegation</Label>
                <Input
                  id="delegatedIpv6Prefix"
                  placeholder="2001:db8:1000::/56"
                  value={formData["delegatedIpv6Prefix"]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delegatedIpv6Prefix: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ipv6PdSize">PD Size</Label>
                  <Input
                    id="ipv6PdSize"
                    type="number"
                    min="0"
                    max="128"
                    placeholder="56"
                    value={formData["ipv6PdSize"]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, ipv6PdSize: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ipv6AssignmentMode">IPv6 Assignment Mode</Label>
                  <Select
                    value={formData["ipv6AssignmentMode"]}
                    onValueChange={(value: string) =>
                      setFormData({
                        ...formData,
                        ipv6AssignmentMode: value as
                          | "none"
                          | "slaac"
                          | "stateful"
                          | "pd"
                          | "dual_stack",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="slaac">SLAAC</SelectItem>
                      <SelectItem value="stateful">Stateful DHCPv6</SelectItem>
                      <SelectItem value="pd">Prefix Delegation</SelectItem>
                      <SelectItem value="dual_stack">Dual Stack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Option 82 Configuration */}
            <TabsContent value="option82" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="circuitId">Circuit ID</Label>
                <Input
                  id="circuitId"
                  placeholder="OLT1:1/1/1"
                  value={formData["circuitId"]}
                  onChange={(e) => setFormData({ ...formData, circuitId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remoteId">Remote ID</Label>
                <Input
                  id="remoteId"
                  placeholder="OLT1"
                  value={formData["remoteId"]}
                  onChange={(e) => setFormData({ ...formData, remoteId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="option82Policy">Enforcement Policy</Label>
                <Select
                  value={formData["option82Policy"]}
                  onValueChange={(value: string) =>
                    setFormData({
                      ...formData,
                      option82Policy: value as "enforce" | "log" | "ignore",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enforce">Enforce - Block mismatches</SelectItem>
                    <SelectItem value="log">Log - Allow but log</SelectItem>
                    <SelectItem value="ignore">Ignore - No validation</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData["option82Policy"] === "enforce" &&
                    "Sessions will be rejected if Option 82 doesn't match"}
                  {formData["option82Policy"] === "log" &&
                    "Sessions will be allowed but mismatches will be logged"}
                  {formData["option82Policy"] === "ignore" && "Option 82 validation is disabled"}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {profile ? "Update" : "Create"} Profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
