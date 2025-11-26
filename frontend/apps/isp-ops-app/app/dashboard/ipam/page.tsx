"use client";

/**
 * IPAM (IP Address Management) Dashboard
 *
 * Comprehensive IP management with prefixes, VLANs, VRFs, and allocation
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import {
  useIPAddresses,
  usePrefixes,
  useVLANs,
  useVRFs,
  useNetBoxHealth,
  useCreateIPAddress,
  useDeleteIPAddress,
  useCreatePrefix,
  useCreateVLAN,
  useCreateVRF,
  useAvailableIPs,
  useAllocateIP,
} from "@/hooks/useNetBox";
import type {
  Prefix,
  CreateIPAddressRequest,
  CreatePrefixRequest,
  CreateVLANRequest,
  CreateVRFRequest,
} from "@/types/netbox";
import {
  Network,
  Globe,
  Shield,
  Wifi,
  Plus,
  Search,
  Trash2,
  Activity,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export default function IPAMDashboardPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefix, setSelectedPrefix] = useState<number | undefined>(undefined);
  const [isCreateIPOpen, setIsCreateIPOpen] = useState(false);
  const [isCreatePrefixOpen, setIsCreatePrefixOpen] = useState(false);
  const [isCreateVLANOpen, setIsCreateVLANOpen] = useState(false);
  const [isCreateVRFOpen, setIsCreateVRFOpen] = useState(false);
  const [isAllocateIPOpen, setIsAllocateIPOpen] = useState(false);

  // Fetch data
  const { data: health } = useNetBoxHealth();
  const { data: ipAddresses = [], isLoading: loadingIPs } = useIPAddresses({});
  const { data: prefixes = [], isLoading: loadingPrefixes } = usePrefixes({});
  const { data: vlans = [], isLoading: loadingVLANs } = useVLANs({});
  const { data: vrfs = [], isLoading: loadingVRFs } = useVRFs();
  const { data: availableIPs = [] } = useAvailableIPs(selectedPrefix);

  // Mutations
  const createIP = useCreateIPAddress();
  const deleteIP = useDeleteIPAddress();
  const createPrefix = useCreatePrefix();
  const createVLAN = useCreateVLAN();
  const createVRF = useCreateVRF();
  const allocateIP = useAllocateIP();

  // Form states
  const [newIP, setNewIP] = useState<CreateIPAddressRequest>({
    address: "",
    status: "active",
    description: "",
    dns_name: "",
  });

  const [newPrefix, setNewPrefix] = useState<CreatePrefixRequest>({
    prefix: "",
    status: "active",
    is_pool: false,
    description: "",
  });

  const [newVLAN, setNewVLAN] = useState<CreateVLANRequest>({
    vid: 1,
    name: "",
    status: "active",
    description: "",
  });

  const [newVRF, setNewVRF] = useState<CreateVRFRequest>({
    name: "",
    rd: "",
    enforce_unique: true,
    description: "",
  });

  // Filter IPs by search
  const filteredIPs = ipAddresses.filter(
    (ip) =>
      ip.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip.dns_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip["description"]?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculate statistics
  const stats = {
    totalIPs: ipAddresses.length,
    activeIPs: ipAddresses.filter((ip) => ip.status.value === "active").length,
    reservedIPs: ipAddresses.filter((ip) => ip.status.value === "reserved").length,
    totalPrefixes: prefixes.length,
    totalVLANs: vlans.length,
    totalVRFs: vrfs.length,
  };

  // Calculate prefix utilization
  const getPrefixUtilization = (prefix: Prefix) => {
    if (!prefix.prefix) return 0;
    const [, maskBits] = prefix.prefix.split("/");
    if (!maskBits) return 0;
    const totalIPs = Math.pow(2, 32 - parseInt(maskBits)) - 2; // Exclude network and broadcast
    const usedIPs = ipAddresses.filter((ip) => {
      if (!ip.address || !prefix.prefix) return false;
      const ipPrefix = ip.address.split("/")[0] ?? "";
      const prefixNet = prefix.prefix.split("/")[0] ?? "";
      // Simple check - in production would use proper IP range checking
      const networkFragment = prefixNet.split(".").slice(0, 3).join(".");
      return networkFragment.length > 0 && ipPrefix.startsWith(networkFragment);
    }).length;
    return totalIPs > 0 ? (usedIPs / totalIPs) * 100 : 0;
  };

  const getStatusBadge = (status: { value: string; label: string }) => {
    const variant =
      status.value === "active" ? "default" : status.value === "reserved" ? "secondary" : "outline";
    return <Badge variant={variant as any}>{status.label}</Badge>;
  };

  const handleCreateIP = async () => {
    if (!newIP.address) {
      toast({
        title: "Validation Error",
        description: "IP address is required",
        variant: "destructive",
      });
      return;
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!ipRegex.test(newIP.address)) {
      toast({
        title: "Validation Error",
        description: "Invalid IP address format. Use CIDR notation (e.g., 192.168.1.1/24)",
        variant: "destructive",
      });
      return;
    }

    try {
      await createIP.mutateAsync(newIP);
      logger.info("IP address created", { address: newIP.address });
      toast({
        title: "Success",
        description: `IP address ${newIP.address} created successfully`,
      });
      setIsCreateIPOpen(false);
      setNewIP({
        address: "",
        status: "active",
        description: "",
        dns_name: "",
      });
    } catch (error) {
      logger.error("Failed to create IP address", error);
      toast({
        title: "Error",
        description: "Failed to create IP address. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreatePrefix = async () => {
    if (!newPrefix.prefix) {
      toast({
        title: "Validation Error",
        description: "Prefix is required",
        variant: "destructive",
      });
      return;
    }

    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(newPrefix.prefix)) {
      toast({
        title: "Validation Error",
        description: "Invalid prefix format. Use CIDR notation (e.g., 10.0.0.0/24)",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPrefix.mutateAsync(newPrefix);
      logger.info("Prefix created", { prefix: newPrefix.prefix });
      toast({
        title: "Success",
        description: `Prefix ${newPrefix.prefix} created successfully`,
      });
      setIsCreatePrefixOpen(false);
      setNewPrefix({
        prefix: "",
        status: "active",
        is_pool: false,
        description: "",
      });
    } catch (error) {
      logger.error("Failed to create prefix", error);
      toast({
        title: "Error",
        description: "Failed to create prefix. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateVLAN = async () => {
    if (!newVLAN.name || newVLAN.vid < 1 || newVLAN.vid > 4094) {
      toast({
        title: "Validation Error",
        description: "VLAN name is required and VLAN ID must be between 1 and 4094",
        variant: "destructive",
      });
      return;
    }

    try {
      await createVLAN.mutateAsync(newVLAN);
      logger.info("VLAN created", { vlanId: newVLAN.vid, name: newVLAN.name });
      toast({
        title: "Success",
        description: `VLAN ${newVLAN.vid} (${newVLAN.name}) created successfully`,
      });
      setIsCreateVLANOpen(false);
      setNewVLAN({
        vid: 1,
        name: "",
        status: "active",
        description: "",
      });
    } catch (error) {
      logger.error("Failed to create VLAN", error);
      toast({
        title: "Error",
        description: "Failed to create VLAN. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateVRF = async () => {
    if (!newVRF.name) {
      toast({
        title: "Validation Error",
        description: "VRF name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createVRF.mutateAsync(newVRF);
      logger.info("VRF created", { vrfName: newVRF.name });
      toast({
        title: "Success",
        description: `VRF ${newVRF.name} created successfully`,
      });
      setIsCreateVRFOpen(false);
      setNewVRF({
        name: "",
        rd: "",
        enforce_unique: true,
        description: "",
      });
    } catch (error) {
      logger.error("Failed to create VRF", error);
      toast({
        title: "Error",
        description: "Failed to create VRF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAllocateIP = async (description: string, dnsName: string) => {
    if (!selectedPrefix) return;

    try {
      await allocateIP.mutateAsync({
        prefixId: selectedPrefix,
        data: {
          description,
          dns_name: dnsName,
        },
      });
      logger.info("IP allocated from prefix", { prefixId: selectedPrefix, description });
      toast({
        title: "Success",
        description: "IP address allocated successfully",
      });
      setIsAllocateIPOpen(false);
    } catch (error) {
      logger.error("Failed to allocate IP", error);
      toast({
        title: "Error",
        description: "Failed to allocate IP address. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IPAM</h1>
          <p className="text-muted-foreground">
            IP Address Management - Manage IP addresses, prefixes, VLANs, and VRFs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <Badge variant={health.healthy ? "default" : "destructive"}>
              {health.healthy ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  NetBox Connected
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  NetBox Disconnected
                </>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total IP Addresses</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIPs}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats.activeIPs} active</span>
              {" • "}
              <span className="text-yellow-600">{stats.reservedIPs} reserved</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prefixes</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPrefixes}</div>
            <p className="text-xs text-muted-foreground">IP subnets managed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VLANs</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVLANs}</div>
            <p className="text-xs text-muted-foreground">Virtual LANs configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VRFs</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVRFs}</div>
            <p className="text-xs text-muted-foreground">Virtual routing instances</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="ip-addresses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ip-addresses">IP Addresses</TabsTrigger>
          <TabsTrigger value="prefixes">Prefixes</TabsTrigger>
          <TabsTrigger value="vlans">VLANs</TabsTrigger>
          <TabsTrigger value="vrfs">VRFs</TabsTrigger>
        </TabsList>

        {/* IP Addresses Tab */}
        <TabsContent value="ip-addresses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>IP Addresses</CardTitle>
                  <CardDescription>Manage IP address assignments</CardDescription>
                </div>
                <Dialog open={isCreateIPOpen} onOpenChange={setIsCreateIPOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add IP Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create IP Address</DialogTitle>
                      <DialogDescription>Add a new IP address to NetBox</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="ip-address">IP Address (CIDR)</Label>
                        <Input
                          id="ip-address"
                          placeholder="192.168.1.1/24"
                          value={newIP.address}
                          onChange={(e) => setNewIP({ ...newIP, address: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ip-status">Status</Label>
                        <Select
                          value={newIP.status || "active"}
                          onValueChange={(value) => setNewIP({ ...newIP, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
                            <SelectItem value="dhcp">DHCP</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ip-dns">DNS Name</Label>
                        <Input
                          id="ip-dns"
                          placeholder="server.example.com"
                          value={newIP.dns_name}
                          onChange={(e) => setNewIP({ ...newIP, dns_name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ip-description">Description</Label>
                        <Input
                          id="ip-description"
                          placeholder="Web server primary IP"
                          value={newIP.description}
                          onChange={(e) => setNewIP({ ...newIP, description: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateIPOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateIP} disabled={createIP.isPending}>
                        Create IP
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search IP addresses, DNS names, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* IP Address Table */}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">IP Address</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">DNS Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">VRF</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Assigned To</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingIPs ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          Loading IP addresses...
                        </td>
                      </tr>
                    ) : filteredIPs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          No IP addresses found
                        </td>
                      </tr>
                    ) : (
                      filteredIPs.map((ip) => (
                        <tr key={ip.id} className="border-b">
                          <td className="p-4 font-mono text-xs font-medium">{ip.address}</td>
                          <td className="p-4">{getStatusBadge(ip.status)}</td>
                          <td className="p-4">{ip.dns_name || "-"}</td>
                          <td className="p-4">
                            {ip.vrf ? <Badge variant="outline">{ip.vrf.name}</Badge> : "-"}
                          </td>
                          <td className="p-4">
                            {ip.assigned_object ? (
                              <span className="text-xs">
                                {ip.assigned_object_type?.split(".")[1]}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-4 max-w-xs truncate">{ip.description || "-"}</td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteIP.mutate(ip.id)}
                              disabled={deleteIP.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prefixes Tab */}
        <TabsContent value="prefixes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>IP Prefixes</CardTitle>
                  <CardDescription>Manage IP subnets and allocation pools</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={isAllocateIPOpen} onOpenChange={setIsAllocateIPOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={!selectedPrefix}>
                        <Activity className="mr-2 h-4 w-4" />
                        Allocate IP
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Allocate IP Address</DialogTitle>
                        <DialogDescription>
                          Allocate next available IP from selected prefix
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {availableIPs.length > 0 && (
                          <div className="rounded-md bg-muted p-4">
                            <p className="text-sm font-medium">Next Available IP:</p>
                            <p className="text-lg font-mono">{availableIPs[0]?.address}</p>
                          </div>
                        )}
                        <div className="grid gap-2">
                          <Label>Description</Label>
                          <Input placeholder="Web server" id="alloc-description" />
                        </div>
                        <div className="grid gap-2">
                          <Label>DNS Name</Label>
                          <Input placeholder="web01.example.com" id="alloc-dns" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAllocateIPOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const desc =
                              (document.getElementById("alloc-description") as HTMLInputElement)
                                ?.value || "";
                            const dns =
                              (document.getElementById("alloc-dns") as HTMLInputElement)?.value ||
                              "";
                            handleAllocateIP(desc, dns);
                          }}
                          disabled={allocateIP.isPending || availableIPs.length === 0}
                        >
                          Allocate
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isCreatePrefixOpen} onOpenChange={setIsCreatePrefixOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Prefix
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Prefix</DialogTitle>
                        <DialogDescription>Add a new IP prefix/subnet</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="prefix">Prefix (CIDR)</Label>
                          <Input
                            id="prefix"
                            placeholder="10.0.0.0/24"
                            value={newPrefix.prefix}
                            onChange={(e) =>
                              setNewPrefix({
                                ...newPrefix,
                                prefix: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="prefix-status">Status</Label>
                          <Select
                            value={newPrefix.status || "active"}
                            onValueChange={(value) => setNewPrefix({ ...newPrefix, status: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="reserved">Reserved</SelectItem>
                              <SelectItem value="deprecated">Deprecated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="is-pool"
                            checked={newPrefix.is_pool}
                            onChange={(e) =>
                              setNewPrefix({
                                ...newPrefix,
                                is_pool: e.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          <Label htmlFor="is-pool">Mark as IP allocation pool</Label>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="prefix-description">Description</Label>
                          <Input
                            id="prefix-description"
                            placeholder="Production network"
                            value={newPrefix.description}
                            onChange={(e) =>
                              setNewPrefix({
                                ...newPrefix,
                                description: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatePrefixOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreatePrefix} disabled={createPrefix.isPending}>
                          Create Prefix
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingPrefixes ? (
                  <div className="text-center py-8">Loading prefixes...</div>
                ) : prefixes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No prefixes configured
                  </div>
                ) : (
                  prefixes.map((prefix) => {
                    const utilization = getPrefixUtilization(prefix);
                    return (
                      <div
                        key={prefix.id}
                        className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                          selectedPrefix === prefix["id"]
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedPrefix(prefix.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-mono font-semibold">
                                {prefix.prefix}
                              </span>
                              {getStatusBadge(prefix.status)}
                              {prefix.is_pool && (
                                <Badge variant="outline">
                                  <Activity className="h-3 w-3 mr-1" />
                                  Pool
                                </Badge>
                              )}
                            </div>
                            {prefix.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {prefix.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {utilization.toFixed(1)}% utilized
                            </div>
                            {prefix.site && (
                              <Badge variant="outline" className="mt-1">
                                {prefix.site.name}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Utilization Bar */}
                        <div className="w-full bg-muted rounded-full h-2 mt-3">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              utilization > 80
                                ? "bg-red-500"
                                : utilization > 60
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>

                        {/* Prefix Details */}
                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                          {prefix.vlan && (
                            <div>
                              <span className="text-muted-foreground">VLAN:</span>{" "}
                              <Badge variant="outline">
                                {prefix.vlan.vid} - {prefix.vlan.name}
                              </Badge>
                            </div>
                          )}
                          {prefix.role && (
                            <div>
                              <span className="text-muted-foreground">Role:</span>{" "}
                              {prefix.role.name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VLANs Tab */}
        <TabsContent value="vlans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>VLANs</CardTitle>
                  <CardDescription>Virtual LAN configuration</CardDescription>
                </div>
                <Dialog open={isCreateVLANOpen} onOpenChange={setIsCreateVLANOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add VLAN
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create VLAN</DialogTitle>
                      <DialogDescription>Add a new VLAN configuration</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="vlan-id">VLAN ID (1-4094)</Label>
                        <Input
                          id="vlan-id"
                          type="number"
                          min="1"
                          max="4094"
                          value={newVLAN.vid}
                          onChange={(e) =>
                            setNewVLAN({
                              ...newVLAN,
                              vid: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vlan-name">Name</Label>
                        <Input
                          id="vlan-name"
                          placeholder="Production"
                          value={newVLAN.name}
                          onChange={(e) => setNewVLAN({ ...newVLAN, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vlan-status">Status</Label>
                        <Select
                          value={newVLAN.status || "active"}
                          onValueChange={(value) => setNewVLAN({ ...newVLAN, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vlan-description">Description</Label>
                        <Input
                          id="vlan-description"
                          placeholder="Production network VLAN"
                          value={newVLAN.description}
                          onChange={(e) =>
                            setNewVLAN({
                              ...newVLAN,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateVLANOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateVLAN} disabled={createVLAN.isPending}>
                        Create VLAN
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">VLAN ID</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Site</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Role</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingVLANs ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center">
                          Loading VLANs...
                        </td>
                      </tr>
                    ) : vlans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center">
                          No VLANs configured
                        </td>
                      </tr>
                    ) : (
                      vlans.map((vlan) => (
                        <tr key={vlan.id} className="border-b">
                          <td className="p-4">
                            <Badge variant="outline" className="font-mono">
                              {vlan.vid}
                            </Badge>
                          </td>
                          <td className="p-4 font-medium">{vlan.name}</td>
                          <td className="p-4">{getStatusBadge(vlan.status)}</td>
                          <td className="p-4">{vlan.site ? vlan.site.name : "-"}</td>
                          <td className="p-4">{vlan.role ? vlan.role.name : "-"}</td>
                          <td className="p-4">{vlan.description || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VRFs Tab */}
        <TabsContent value="vrfs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>VRFs (Virtual Routing and Forwarding)</CardTitle>
                  <CardDescription>Virtual routing instances for multi-tenancy</CardDescription>
                </div>
                <Dialog open={isCreateVRFOpen} onOpenChange={setIsCreateVRFOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add VRF
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create VRF</DialogTitle>
                      <DialogDescription>Add a new virtual routing instance</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="vrf-name">Name</Label>
                        <Input
                          id="vrf-name"
                          placeholder="Customer-A"
                          value={newVRF.name}
                          onChange={(e) => setNewVRF({ ...newVRF, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vrf-rd">Route Distinguisher</Label>
                        <Input
                          id="vrf-rd"
                          placeholder="65000:100"
                          value={newVRF.rd}
                          onChange={(e) => setNewVRF({ ...newVRF, rd: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enforce-unique"
                          checked={newVRF.enforce_unique}
                          onChange={(e) =>
                            setNewVRF({
                              ...newVRF,
                              enforce_unique: e.target.checked,
                            })
                          }
                          className="h-4 w-4"
                        />
                        <Label htmlFor="enforce-unique">Enforce unique IP addresses</Label>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vrf-description">Description</Label>
                        <Input
                          id="vrf-description"
                          placeholder="Customer A routing instance"
                          value={newVRF.description}
                          onChange={(e) =>
                            setNewVRF({
                              ...newVRF,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateVRFOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateVRF} disabled={createVRF.isPending}>
                        Create VRF
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">
                        Route Distinguisher
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium">
                        Enforce Unique
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Tenant</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingVRFs ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center">
                          Loading VRFs...
                        </td>
                      </tr>
                    ) : vrfs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center">
                          No VRFs configured
                        </td>
                      </tr>
                    ) : (
                      vrfs.map((vrf) => (
                        <tr key={vrf.id} className="border-b">
                          <td className="p-4 font-medium">{vrf.name}</td>
                          <td className="p-4 font-mono text-xs">{vrf.rd || "-"}</td>
                          <td className="p-4">
                            {vrf.enforce_unique ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                          <td className="p-4">{vrf.tenant ? vrf.tenant.name : "-"}</td>
                          <td className="p-4">{vrf.description || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
