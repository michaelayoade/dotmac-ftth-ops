"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  FileCode,
  Search,
  Settings,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useConfirmDialog } from "@dotmac/ui";

interface Preset {
  id: string;
  name: string;
  description: string;
  configuration: Record<string, unknown>;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PresetFormData {
  name: string;
  description: string;
  configuration: string; // JSON string
}

function PresetsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  const [formData, setFormData] = useState<PresetFormData>({
    name: "",
    description: "",
    configuration: "{\n  \n}",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();
  const confirmDialog = useConfirmDialog();

  // Fetch presets
  const { data: presets = [], isLoading } = useQuery<Preset[]>({
    queryKey: ["device-presets"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch presets");
      return response.json();
    },
  });

  // Create preset
  const createMutation = useMutation({
    mutationFn: async (data: PresetFormData) => {
      let config;
      try {
        config = JSON.parse(data.configuration);
      } catch (e) {
        throw new Error("Invalid JSON configuration");
      }

      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          configuration: config,
        }),
      });
      if (!response.ok) throw new Error("Failed to create preset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-presets"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Preset created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update preset
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PresetFormData }) => {
      let config;
      try {
        config = JSON.parse(data.configuration);
      } catch (e) {
        throw new Error("Invalid JSON configuration");
      }

      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          configuration: config,
        }),
      });
      if (!response.ok) throw new Error("Failed to update preset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-presets"] });
      setIsEditDialogOpen(false);
      setSelectedPreset(null);
      resetForm();
      toast({ title: "Preset updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete preset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete preset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-presets"] });
      toast({ title: "Preset deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Duplicate preset
  const duplicateMutation = useMutation({
    mutationFn: async (preset: Preset) => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${preset.name} (Copy)`,
          description: preset.description,
          configuration: preset.configuration,
        }),
      });
      if (!response.ok) throw new Error("Failed to duplicate preset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-presets"] });
      toast({ title: "Preset duplicated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to duplicate preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      configuration: "{\n  \n}",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (preset: Preset) => {
    setSelectedPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description,
      configuration: JSON.stringify(preset.configuration, null, 2),
    });
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData["name"].trim()) {
      toast({
        title: "Validation error",
        description: "Preset name is required",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedPreset || !formData["name"].trim()) {
      toast({
        title: "Validation error",
        description: "Preset name is required",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ id: selectedPreset.id, data: formData });
  };

  const handleDelete = async (preset: Preset) => {
    const confirmed = await confirmDialog({
      title: "Delete preset",
      description: `Are you sure you want to delete the preset "${preset.name}"?`,
      confirmText: "Delete preset",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(preset.id);
  };

  const filteredPresets = presets.filter(
    (preset) =>
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Example preset configurations
  const examplePresets = [
    {
      name: "Basic ONT",
      config: {
        "InternetGatewayDevice.ManagementServer.PeriodicInformInterval": 300,
        "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Enable": 1,
      },
    },
    {
      name: "WiFi Router",
      config: {
        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": 1,
        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "MyNetwork",
        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType": "WPA2",
      },
    },
  ];

  const loadExamplePreset = (example: (typeof examplePresets)[0]) => {
    setFormData({
      ...formData,
      name: example.name,
      configuration: JSON.stringify(example.config, null, 2),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/devices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configuration Presets</h1>
            <p className="text-sm text-muted-foreground">
              Manage TR-069 configuration templates for devices
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Preset
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search presets by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Presets List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading presets...
            </CardContent>
          </Card>
        ) : filteredPresets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery
                ? "No presets match your search"
                : "No presets created yet. Create your first preset to get started."}
            </CardContent>
          </Card>
        ) : (
          filteredPresets.map((preset) => (
            <Card key={preset.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileCode className="h-8 w-8 text-primary" />
                  <Badge variant="secondary">{preset.deviceCount} devices</Badge>
                </div>
                <CardTitle className="mt-2">{preset.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {preset.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="text-xs text-muted-foreground">
                  <p>Created: {new Date(preset.createdAt).toLocaleDateString()}</p>
                  <p>Updated: {new Date(preset.updatedAt).toLocaleDateString()}</p>
                </div>

                {/* Configuration Preview */}
                <div className="p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                  <pre>{JSON.stringify(preset.configuration, null, 2)}</pre>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(preset)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateMutation.mutate(preset)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleDelete(preset);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Configuration Preset</DialogTitle>
            <DialogDescription>
              Define a reusable configuration template for TR-069 devices
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Preset Name *</Label>
              <Input
                id="create-name"
                placeholder="e.g., Basic ONT Setup"
                value={formData["name"]}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Describe what this preset does..."
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-config">Configuration (JSON) *</Label>
              <Textarea
                id="create-config"
                placeholder='{\n  "parameter.path": "value"\n}'
                value={formData.configuration}
                onChange={(e) => setFormData({ ...formData, configuration: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter TR-069 parameter paths and values in JSON format
              </p>
            </div>

            {/* Example Presets */}
            <div className="space-y-2">
              <Label>Load Example:</Label>
              <div className="flex gap-2">
                {examplePresets.map((example) => (
                  <Button
                    key={example.name}
                    variant="outline"
                    size="sm"
                    onClick={() => loadExamplePreset(example)}
                  >
                    {example.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Validation Hint */}
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <p className="font-medium">Configuration Tips:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Use full TR-069 parameter paths</li>
                      <li>Values can be strings, numbers, or booleans</li>
                      <li>Configuration is validated on save</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Configuration Preset</DialogTitle>
            <DialogDescription>Modify the configuration template</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Preset Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Basic ONT Setup"
                value={formData["name"]}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe what this preset does..."
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-config">Configuration (JSON) *</Label>
              <Textarea
                id="edit-config"
                placeholder='{\n  "parameter.path": "value"\n}'
                value={formData.configuration}
                onChange={(e) => setFormData({ ...formData, configuration: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {selectedPreset && (
              <div className="text-xs text-muted-foreground">
                <p>Currently applied to {selectedPreset.deviceCount} devices</p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">
                  Note: Changes will not affect already provisioned devices
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedPreset(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PresetsPage() {
  return (
    <RouteGuard permission="devices.write">
      <PresetsPageContent />
    </RouteGuard>
  );
}
