"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  useSites,
  useDevices,
  useInterfaces,
  useCreateSite,
  useCreateDevice,
  useCreateInterface,
  useNetBoxHealth,
} from "@/hooks/useNetBox";
import type {
  CreateSiteRequest,
  CreateDeviceRequest,
  CreateInterfaceRequest,
} from "@/types/netbox";
import {
  MapPin,
  Server,
  Network,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export default function DCIMPage() {
  const { toast } = useToast();

  // Search and filters
  const [siteSearch, setSiteSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [interfaceSearch, setInterfaceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSiteForDevices, setSelectedSiteForDevices] = useState<number | undefined>();
  const [selectedDeviceForInterfaces, setSelectedDeviceForInterfaces] = useState<
    number | undefined
  >();

  // Dialog states
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [showCreateDevice, setShowCreateDevice] = useState(false);
  const [showCreateInterface, setShowCreateInterface] = useState(false);

  // Form states
  const [newSite, setNewSite] = useState<CreateSiteRequest>({
    name: "",
    slug: "",
    status: "active",
    description: "",
    physical_address: "",
  });

  const [newDevice, setNewDevice] = useState<CreateDeviceRequest>({
    name: "",
    device_type: 0,
    device_role: 0,
    site: 0,
    status: "active",
    serial: "",
  });

  const [newInterface, setNewInterface] = useState<CreateInterfaceRequest>({
    device: 0,
    name: "",
    type: "1000base-t",
    enabled: true,
    description: "",
  });

  // Data fetching
  const { data: netboxHealth } = useNetBoxHealth();
  const { data: sites = [], isLoading: sitesLoading } = useSites({});
  const deviceParams = selectedSiteForDevices ? { site: selectedSiteForDevices.toString() } : {};
  const { data: devices = [], isLoading: devicesLoading } = useDevices(deviceParams);
  const interfaceParams =
    selectedDeviceForInterfaces !== undefined ? { device: selectedDeviceForInterfaces } : {};
  const { data: interfaces = [], isLoading: interfacesLoading } = useInterfaces(interfaceParams);

  // Mutations
  const createSite = useCreateSite();
  const createDevice = useCreateDevice();
  const createInterface = useCreateInterface();

  // Filter sites
  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
      site.slug.toLowerCase().includes(siteSearch.toLowerCase()) ||
      site.physical_address?.toLowerCase().includes(siteSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || site.status.value === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      device.serial?.toLowerCase().includes(deviceSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || device.status.value === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter interfaces
  const filteredInterfaces = interfaces.filter((iface) => {
    const matchesSearch =
      iface.name.toLowerCase().includes(interfaceSearch.toLowerCase()) ||
      iface["description"]?.toLowerCase().includes(interfaceSearch.toLowerCase());
    return matchesSearch;
  });

  // Calculate statistics
  const totalSites = sites.length;
  const activeSites = sites.filter((s) => s.status.value === "active").length;
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status.value === "active").length;
  const totalInterfaces = interfaces.length;
  const enabledInterfaces = interfaces.filter((i) => i.enabled).length;

  // Handle create site
  const handleCreateSite = async () => {
    if (!newSite.name || !newSite.slug) {
      toast({
        title: "Validation Error",
        description: "Name and slug are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createSite.mutateAsync(newSite);
      logger.info("DCIM site created", { siteName: newSite.name, slug: newSite.slug });
      toast({
        title: "Success",
        description: `Site "${newSite.name}" created successfully`,
      });
      setShowCreateSite(false);
      setNewSite({
        name: "",
        slug: "",
        status: "active",
        description: "",
        physical_address: "",
      });
    } catch (error) {
      logger.error("Failed to create DCIM site", error);
      toast({
        title: "Error",
        description: "Failed to create site",
        variant: "destructive",
      });
    }
  };

  // Handle create device
  const handleCreateDevice = async () => {
    if (!newDevice.name || !newDevice.device_type || !newDevice.device_role || !newDevice.site) {
      toast({
        title: "Validation Error",
        description: "Name, device type, role, and site are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createDevice.mutateAsync(newDevice);
      logger.info("DCIM device created", { deviceName: newDevice.name, siteId: newDevice.site });
      toast({
        title: "Success",
        description: `Device "${newDevice.name}" created successfully`,
      });
      setShowCreateDevice(false);
      setNewDevice({
        name: "",
        device_type: 0,
        device_role: 0,
        site: 0,
        status: "active",
        serial: "",
      });
    } catch (error) {
      logger.error("Failed to create DCIM device", error);
      toast({
        title: "Error",
        description: "Failed to create device",
        variant: "destructive",
      });
    }
  };

  // Handle create interface
  const handleCreateInterface = async () => {
    if (!newInterface.device || !newInterface.name || !newInterface.type) {
      toast({
        title: "Validation Error",
        description: "Device, name, and type are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createInterface.mutateAsync(newInterface);
      logger.info("DCIM interface created", {
        interfaceName: newInterface.name,
        deviceId: newInterface.device,
      });
      toast({
        title: "Success",
        description: `Interface "${newInterface.name}" created successfully`,
      });
      setShowCreateInterface(false);
      setNewInterface({
        device: 0,
        name: "",
        type: "1000base-t",
        enabled: true,
        description: "",
      });
    } catch (error) {
      logger.error("Failed to create DCIM interface", error);
      toast({
        title: "Error",
        description: "Failed to create interface",
        variant: "destructive",
      });
    }
  };

  // Auto-generate slug from name
  const handleSiteNameChange = (name: string) => {
    setNewSite((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      planned: "secondary",
      offline: "destructive",
      maintenance: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === "active") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "offline") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">DCIM Management</h1>
          <p className="text-muted-foreground">
            Data Center Infrastructure - Sites, Devices, Interfaces
          </p>
        </div>
        <div className="flex items-center gap-2">
          {netboxHealth?.healthy ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              NetBox Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              NetBox Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSites}</div>
            <p className="text-xs text-muted-foreground">{activeSites} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDevices}</div>
            <p className="text-xs text-muted-foreground">{onlineDevices} online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interfaces</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInterfaces}</div>
            <p className="text-xs text-muted-foreground">{enabledInterfaces} enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="sites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="interfaces">Interfaces</TabsTrigger>
        </TabsList>

        {/* Sites Tab */}
        <TabsContent value="sites" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sites</CardTitle>
                  <CardDescription>Physical locations and facilities</CardDescription>
                </div>
                <Button onClick={() => setShowCreateSite(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Site
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search sites..."
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={statusFilter || "all"} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sites Grid */}
              {sitesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sites...</div>
              ) : filteredSites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sites found. Create your first site to get started.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSites.map((site) => (
                    <Card key={site.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(site.status.value)}
                            <CardTitle className="text-base">{site.name}</CardTitle>
                          </div>
                          {getStatusBadge(site.status.value)}
                        </div>
                        <CardDescription className="font-mono text-xs">{site.slug}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {site.physical_address && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground line-clamp-2">
                              {site.physical_address}
                            </span>
                          </div>
                        )}
                        {site.latitude && site.longitude && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                          </div>
                        )}
                        {site.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {site.description}
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setSelectedSiteForDevices(site.id)}
                        >
                          View Devices
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Devices</CardTitle>
                  <CardDescription>Network devices and equipment inventory</CardDescription>
                </div>
                <Button onClick={() => setShowCreateDevice(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Device
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search devices..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={selectedSiteForDevices?.toString() ?? "all"}
                  onValueChange={(value) =>
                    setSelectedSiteForDevices(value === "all" ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter || "all"} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Devices Table */}
              {devicesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
              ) : filteredDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No devices found. Create your first device to get started.
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left text-sm font-medium">Status</th>
                        <th className="p-3 text-left text-sm font-medium">Name</th>
                        <th className="p-3 text-left text-sm font-medium">Type</th>
                        <th className="p-3 text-left text-sm font-medium">Role</th>
                        <th className="p-3 text-left text-sm font-medium">Site</th>
                        <th className="p-3 text-left text-sm font-medium">Primary IP</th>
                        <th className="p-3 text-left text-sm font-medium">Serial</th>
                        <th className="p-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((device) => (
                        <tr key={device.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(device.status.value)}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{device.name}</div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            <div>{device.device_type.manufacturer.name}</div>
                            <div className="text-xs">{device.device_type.model}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{device.device_role.name}</Badge>
                          </td>
                          <td className="p-3 text-sm">{device.site.name}</td>
                          <td className="p-3">
                            {device.primary_ip4 ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {device.primary_ip4.address}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {device.serial ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {device.serial}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDeviceForInterfaces(device.id)}
                            >
                              Interfaces
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interfaces Tab */}
        <TabsContent value="interfaces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Interfaces</CardTitle>
                  <CardDescription>Network interfaces and connections</CardDescription>
                </div>
                <Button onClick={() => setShowCreateInterface(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Interface
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search interfaces..."
                    value={interfaceSearch}
                    onChange={(e) => setInterfaceSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={selectedDeviceForInterfaces?.toString() ?? "all"}
                  onValueChange={(value) =>
                    setSelectedDeviceForInterfaces(value === "all" ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interfaces Table */}
              {interfacesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading interfaces...</div>
              ) : filteredInterfaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No interfaces found. Select a device or create a new interface.
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left text-sm font-medium">Status</th>
                        <th className="p-3 text-left text-sm font-medium">Device</th>
                        <th className="p-3 text-left text-sm font-medium">Name</th>
                        <th className="p-3 text-left text-sm font-medium">Type</th>
                        <th className="p-3 text-left text-sm font-medium">MTU</th>
                        <th className="p-3 text-left text-sm font-medium">Untagged VLAN</th>
                        <th className="p-3 text-left text-sm font-medium">Tagged VLANs</th>
                        <th className="p-3 text-left text-sm font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInterfaces.map((iface) => (
                        <tr key={iface.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            {iface.enabled ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                          <td className="p-3 font-medium">{iface.device.name}</td>
                          <td className="p-3">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {iface.name}
                            </code>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{iface.type.label}</td>
                          <td className="p-3 text-sm">
                            {iface.mtu || <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="p-3">
                            {iface.untagged_vlan ? (
                              <Badge variant="secondary">
                                {iface.untagged_vlan.vid} - {iface.untagged_vlan.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {iface.tagged_vlans.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {iface.tagged_vlans.map((vlan) => (
                                  <Badge key={vlan.id} variant="outline" className="text-xs">
                                    {vlan.vid}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {iface.description || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Site Dialog */}
      <Dialog open={showCreateSite} onOpenChange={setShowCreateSite}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Site</DialogTitle>
            <DialogDescription>Add a new physical location or facility</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Name *</Label>
                <Input
                  id="site-name"
                  placeholder="Headquarters"
                  value={newSite.name}
                  onChange={(e) => handleSiteNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-slug">Slug *</Label>
                <Input
                  id="site-slug"
                  placeholder="hq"
                  value={newSite.slug}
                  onChange={(e) => setNewSite({ ...newSite, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-status">Status</Label>
              <Select
                value={newSite.status || "active"}
                onValueChange={(value) => setNewSite({ ...newSite, status: value })}
              >
                <SelectTrigger id="site-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-address">Physical Address</Label>
              <Input
                id="site-address"
                placeholder="123 Main St, City, State 12345"
                value={newSite.physical_address}
                onChange={(e) => setNewSite({ ...newSite, physical_address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site-lat">Latitude</Label>
                <Input
                  id="site-lat"
                  type="number"
                  step="0.000001"
                  placeholder="40.712776"
                  value={newSite.latitude ?? ""}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    setNewSite((prev) => {
                      const next = { ...prev };
                      if (Number.isNaN(parsed)) {
                        delete next.latitude;
                      } else {
                        next.latitude = parsed;
                      }
                      return next;
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-lon">Longitude</Label>
                <Input
                  id="site-lon"
                  type="number"
                  step="0.000001"
                  placeholder="-74.005974"
                  value={newSite.longitude ?? ""}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    setNewSite((prev) => {
                      const next = { ...prev };
                      if (Number.isNaN(parsed)) {
                        delete next.longitude;
                      } else {
                        next.longitude = parsed;
                      }
                      return next;
                    });
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-desc">Description</Label>
              <Input
                id="site-desc"
                placeholder="Primary data center facility"
                value={newSite.description}
                onChange={(e) => setNewSite({ ...newSite, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSite(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSite} disabled={createSite.isPending}>
              {createSite.isPending ? "Creating..." : "Create Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Device Dialog */}
      <Dialog open={showCreateDevice} onOpenChange={setShowCreateDevice}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Device</DialogTitle>
            <DialogDescription>Add a new network device to your inventory</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Name *</Label>
              <Input
                id="device-name"
                placeholder="core-sw-01"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device-type">Device Type ID *</Label>
                <Input
                  id="device-type"
                  type="number"
                  placeholder="1"
                  value={newDevice.device_type || ""}
                  onChange={(e) =>
                    setNewDevice({
                      ...newDevice,
                      device_type: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Select device type from NetBox (e.g., Cisco Catalyst 9300)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-role">Device Role ID *</Label>
                <Input
                  id="device-role"
                  type="number"
                  placeholder="1"
                  value={newDevice.device_role || ""}
                  onChange={(e) =>
                    setNewDevice({
                      ...newDevice,
                      device_role: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Select device role (e.g., Core Switch, Access Switch)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device-site">Site *</Label>
                <Select
                  value={newDevice.site.toString()}
                  onValueChange={(value) => setNewDevice({ ...newDevice, site: parseInt(value) })}
                >
                  <SelectTrigger id="device-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-status">Status</Label>
                <Select
                  value={newDevice.status || "active"}
                  onValueChange={(value) => setNewDevice({ ...newDevice, status: value })}
                >
                  <SelectTrigger id="device-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-serial">Serial Number</Label>
              <Input
                id="device-serial"
                placeholder="ABC123XYZ"
                value={newDevice.serial}
                onChange={(e) => setNewDevice({ ...newDevice, serial: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDevice(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDevice} disabled={createDevice.isPending}>
              {createDevice.isPending ? "Creating..." : "Create Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Interface Dialog */}
      <Dialog open={showCreateInterface} onOpenChange={setShowCreateInterface}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Interface</DialogTitle>
            <DialogDescription>Add a new network interface to a device</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="interface-device">Device *</Label>
              <Select
                value={newInterface.device.toString()}
                onValueChange={(value) =>
                  setNewInterface({ ...newInterface, device: parseInt(value) })
                }
              >
                <SelectTrigger id="interface-device">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interface-name">Name *</Label>
                <Input
                  id="interface-name"
                  placeholder="GigabitEthernet1/0/1"
                  value={newInterface.name}
                  onChange={(e) => setNewInterface({ ...newInterface, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interface-type">Type *</Label>
                <Select
                  value={newInterface.type}
                  onValueChange={(value) => setNewInterface({ ...newInterface, type: value })}
                >
                  <SelectTrigger id="interface-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000base-t">1000BASE-T (1GE)</SelectItem>
                    <SelectItem value="10gbase-x">10GBASE-X (10GE)</SelectItem>
                    <SelectItem value="25gbase-x">25GBASE-X (25GE)</SelectItem>
                    <SelectItem value="40gbase-x">40GBASE-X (40GE)</SelectItem>
                    <SelectItem value="100gbase-x">100GBASE-X (100GE)</SelectItem>
                    <SelectItem value="sfp-plus">SFP+</SelectItem>
                    <SelectItem value="qsfp-plus">QSFP+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interface-desc">Description</Label>
              <Input
                id="interface-desc"
                placeholder="Uplink to core router"
                value={newInterface.description}
                onChange={(e) =>
                  setNewInterface({
                    ...newInterface,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="interface-enabled"
                checked={newInterface.enabled}
                onChange={(e) =>
                  setNewInterface({
                    ...newInterface,
                    enabled: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="interface-enabled" className="cursor-pointer">
                Enabled
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInterface(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInterface} disabled={createInterface.isPending}>
              {createInterface.isPending ? "Creating..." : "Create Interface"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
