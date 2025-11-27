"use client";

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
import { Textarea } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import {
  Settings,
  Wifi,
  Network,
  Save,
  Edit,
  Trash2,
  Copy,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Router,
} from "lucide-react";
import { useState } from "react";

import {
  WiFiConfig,
  LANConfig,
  WANConfig,
  MassConfigRequest,
  MassConfigResponse,
  ConfigTemplate,
} from "../types";

interface CPEConfigTemplatesProps {
  apiClient: {
    post: <T = any>(url: string, data?: any) => Promise<{ data: T }>;
  };
  massConfigEndpoint: string;
}

const defaultTemplates: ConfigTemplate[] = [
  {
    id: "residential-basic",
    name: "Residential - Basic",
    description: "Standard residential configuration with basic WiFi and DHCP",
    category: "residential",
    wifi: {
      ssid: "MyHome-WiFi",
      password: "changeme123",
      security_mode: "WPA2-PSK",
      channel: 0,
      enabled: true,
    },
    lan: {
      ip_address: "192.168.1.1",
      subnet_mask: "255.255.255.0",
      dhcp_enabled: true,
      dhcp_start: "192.168.1.100",
      dhcp_end: "192.168.1.200",
    },
    wan: {
      connection_type: "PPPoE",
      vlan_id: 100,
    },
  },
  {
    id: "residential-premium",
    name: "Residential - Premium",
    description: "Premium residential with dual-band WiFi and guest network",
    category: "residential",
    wifi: {
      ssid: "Premium-Home",
      password: "SecurePass2024!",
      security_mode: "WPA3-PSK",
      channel: 0,
      enabled: true,
    },
    lan: {
      ip_address: "192.168.10.1",
      subnet_mask: "255.255.255.0",
      dhcp_enabled: true,
      dhcp_start: "192.168.10.50",
      dhcp_end: "192.168.10.250",
    },
    wan: {
      connection_type: "PPPoE",
      vlan_id: 100,
    },
  },
  {
    id: "business-basic",
    name: "Business - Basic",
    description: "Small business configuration with static IP WAN",
    category: "business",
    wifi: {
      ssid: "BusinessNet",
      password: "Corp@2024Secure",
      security_mode: "WPA2-Enterprise",
      channel: 0,
      enabled: true,
    },
    lan: {
      ip_address: "10.0.0.1",
      subnet_mask: "255.255.255.0",
      dhcp_enabled: true,
      dhcp_start: "10.0.0.50",
      dhcp_end: "10.0.0.200",
    },
    wan: {
      connection_type: "Static",
      vlan_id: 200,
    },
  },
  {
    id: "business-enterprise",
    name: "Business - Enterprise",
    description: "Enterprise configuration with VLANs and advanced security",
    category: "business",
    wifi: {
      ssid: "Enterprise-Secure",
      password: "Enterpr1se@Secure!",
      security_mode: "WPA3-Enterprise",
      channel: 0,
      enabled: true,
    },
    lan: {
      ip_address: "172.16.0.1",
      subnet_mask: "255.255.0.0",
      dhcp_enabled: true,
      dhcp_start: "172.16.1.1",
      dhcp_end: "172.16.254.254",
    },
    wan: {
      connection_type: "Static",
      vlan_id: 300,
    },
  },
];

export function CPEConfigTemplates({ apiClient, massConfigEndpoint }: CPEConfigTemplatesProps) {
  const { toast } = useToast();

  const [templates, setTemplates] = useState<ConfigTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigTemplate | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConfigTemplate | null>(null);

  const [applyForm, setApplyForm] = useState({
    name: "",
    description: "",
    device_filter: "{}",
    max_concurrent: 10,
    dry_run: true,
  });

  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    let parsedFilter: Record<string, any>;
    try {
      parsedFilter = JSON.parse(applyForm.device_filter);
    } catch (e) {
      toast({
        title: "Invalid Device Filter",
        description: "Device filter must be valid JSON",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);
    try {
      const request: MassConfigRequest = {
        name: applyForm.name,
        description: applyForm.description,
        device_filter: { query: parsedFilter },
        wifi: selectedTemplate.wifi,
        lan: selectedTemplate.lan,
        wan: selectedTemplate.wan,
        custom_parameters: selectedTemplate.custom_parameters,
        max_concurrent: applyForm.max_concurrent,
        dry_run: applyForm.dry_run,
      };

      const response = await apiClient.post<MassConfigResponse>(massConfigEndpoint, request);

      toast({
        title: applyForm.dry_run ? "Dry Run Complete" : "Configuration Job Created",
        description: applyForm.dry_run
          ? `Would affect ${response.data.preview?.length || 0} devices`
          : `Configuration job created for ${response.data.job.total_devices} devices`,
      });

      setShowApplyModal(false);
      setSelectedTemplate(null);
      setApplyForm({
        name: "",
        description: "",
        device_filter: "{}",
        max_concurrent: 10,
        dry_run: true,
      });
    } catch (err: any) {
      toast({
        title: "Failed to apply template",
        description: err?.response?.data?.detail || "Could not create configuration job",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleEditTemplate = (template: ConfigTemplate) => {
    setEditingTemplate({ ...template });
    setShowEditModal(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;

    if (editingTemplate.id.startsWith("custom-")) {
      setTemplates(templates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)));
    } else {
      const newTemplate: ConfigTemplate = {
        ...editingTemplate,
        id: `custom-${Date.now()}`,
        category: "custom",
      };
      setTemplates([...templates, newTemplate]);
    }

    toast({
      title: "Template Saved",
      description: "Configuration template has been saved",
    });

    setShowEditModal(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!templateId.startsWith("custom-")) {
      toast({
        title: "Cannot Delete",
        description: "Default templates cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    setTemplates(templates.filter((t) => t.id !== templateId));
    toast({
      title: "Template Deleted",
      description: "Configuration template has been deleted",
    });
  };

  const handleDuplicateTemplate = (template: ConfigTemplate) => {
    const newTemplate: ConfigTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      category: "custom",
    };
    setTemplates([...templates, newTemplate]);
    toast({
      title: "Template Duplicated",
      description: "Configuration template has been duplicated",
    });
  };

  const handleCreateNew = () => {
    const newTemplate: ConfigTemplate = {
      id: `custom-${Date.now()}`,
      name: "New Template",
      description: "Custom configuration template",
      category: "custom",
      wifi: {
        ssid: "",
        password: "",
        security_mode: "WPA2-PSK",
        channel: 0,
        enabled: true,
      },
      lan: {
        ip_address: "192.168.1.1",
        subnet_mask: "255.255.255.0",
        dhcp_enabled: true,
        dhcp_start: "192.168.1.100",
        dhcp_end: "192.168.1.200",
      },
      wan: {
        connection_type: "PPPoE",
        vlan_id: 100,
      },
    };
    setEditingTemplate(newTemplate);
    setShowEditModal(true);
  };

  const filteredTemplates = templates.filter((t) => {
    if (activeTab === "all") return true;
    return t.category === activeTab;
  });

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, { variant: any; color: string }> = {
      residential: { variant: "default", color: "bg-blue-100 text-blue-800" },
      business: {
        variant: "secondary",
        color: "bg-purple-100 text-purple-800",
      },
      custom: { variant: "outline", color: "bg-gray-100 text-gray-800" },
    };

    const normalizedCategory = category as keyof typeof styles;
    const styleRecord = styles[normalizedCategory] ?? styles["custom"]!;

    return (
      <Badge variant={styleRecord.variant} className={styleRecord.color}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CPE Configuration Templates</h2>
          <p className="text-muted-foreground">
            Pre-defined configuration templates for common CPE setups
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="residential">Residential</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    </div>
                    {getCategoryBadge(template.category)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Configuration Summary */}
                  <div className="space-y-2 text-sm">
                    {template.wifi && (
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">WiFi:</span>
                        <span className="font-medium">{template.wifi.ssid || "Not set"}</span>
                      </div>
                    )}
                    {template.lan && (
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">LAN:</span>
                        <span className="font-medium">{template.lan.ip_address}</span>
                      </div>
                    )}
                    {template.wan && (
                      <div className="flex items-center gap-2">
                        <Router className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">WAN:</span>
                        <span className="font-medium">{template.wan.connection_type}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setApplyForm({
                          ...applyForm,
                          name: `Apply ${template.name}`,
                          description: template.description,
                        });
                        setShowApplyModal(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    {template.category === "custom" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Templates</AlertTitle>
              <AlertDescription>
                No templates found in this category. Create a new template to get started.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Apply Template Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply Configuration Template</DialogTitle>
            <DialogDescription>
              Apply &quot;{selectedTemplate?.name}&quot; to selected CPE devices
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Template Configuration</AlertTitle>
              <AlertDescription className="text-xs mt-2 space-y-1">
                {selectedTemplate?.wifi && <div>WiFi SSID: {selectedTemplate.wifi.ssid}</div>}
                {selectedTemplate?.lan && <div>LAN IP: {selectedTemplate.lan.ip_address}</div>}
                {selectedTemplate?.wan && (
                  <div>WAN Type: {selectedTemplate.wan.connection_type}</div>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="job_name">Job Name</Label>
              <Input
                id="job_name"
                value={applyForm.name}
                onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                placeholder="Configuration job name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_description">Description</Label>
              <Input
                id="job_description"
                value={applyForm.description}
                onChange={(e) => setApplyForm({ ...applyForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="device_filter">Device Filter (JSON)</Label>
              <Textarea
                id="device_filter"
                value={applyForm.device_filter}
                onChange={(e) => setApplyForm({ ...applyForm, device_filter: e.target.value })}
                placeholder='{"_tags": "production"}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_concurrent">Max Concurrent</Label>
              <Input
                id="max_concurrent"
                type="number"
                min="1"
                max="50"
                value={applyForm.max_concurrent}
                onChange={(e) =>
                  setApplyForm({
                    ...applyForm,
                    max_concurrent: parseInt(e.target.value) || 10,
                  })
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="dry_run"
                checked={applyForm.dry_run}
                onCheckedChange={(checked) => setApplyForm({ ...applyForm, dry_run: checked })}
              />
              <Label htmlFor="dry_run">Dry run (preview only, no changes)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyTemplate} disabled={applying}>
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {applyForm.dry_run ? "Previewing..." : "Applying..."}
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  {applyForm.dry_run ? "Preview" : "Apply Template"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Configuration Template</DialogTitle>
            <DialogDescription>Customize template configuration settings</DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="wifi">WiFi</TabsTrigger>
                <TabsTrigger value="lan">LAN</TabsTrigger>
                <TabsTrigger value="wan">WAN</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template_name">Template Name</Label>
                  <Input
                    id="template_name"
                    value={editingTemplate.name}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template_description">Description</Label>
                  <Textarea
                    id="template_description"
                    value={editingTemplate.description}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="wifi" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wifi_ssid">SSID</Label>
                  <Input
                    id="wifi_ssid"
                    value={editingTemplate.wifi?.ssid || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        wifi: {
                          ...(editingTemplate.wifi || ({} as WiFiConfig)),
                          ssid: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wifi_password">Password</Label>
                  <Input
                    id="wifi_password"
                    type="password"
                    value={editingTemplate.wifi?.password || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        wifi: {
                          ...(editingTemplate.wifi || ({} as WiFiConfig)),
                          password: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wifi_security">Security Mode</Label>
                  <Select
                    value={editingTemplate.wifi?.security_mode || "WPA2-PSK"}
                    onValueChange={(value) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        wifi: {
                          ...(editingTemplate.wifi || ({} as WiFiConfig)),
                          security_mode: value,
                        },
                      })
                    }
                  >
                    <SelectTrigger id="wifi_security">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA2-PSK">WPA2-PSK</SelectItem>
                      <SelectItem value="WPA3-PSK">WPA3-PSK</SelectItem>
                      <SelectItem value="WPA2-Enterprise">WPA2-Enterprise</SelectItem>
                      <SelectItem value="WPA3-Enterprise">WPA3-Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="lan" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lan_ip">IP Address</Label>
                  <Input
                    id="lan_ip"
                    value={editingTemplate.lan?.ip_address || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        lan: {
                          ...(editingTemplate.lan || ({} as LANConfig)),
                          ip_address: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lan_subnet">Subnet Mask</Label>
                  <Input
                    id="lan_subnet"
                    value={editingTemplate.lan?.subnet_mask || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        lan: {
                          ...(editingTemplate.lan || ({} as LANConfig)),
                          subnet_mask: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="lan_dhcp"
                    checked={editingTemplate.lan?.dhcp_enabled || false}
                    onCheckedChange={(checked) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        lan: {
                          ...(editingTemplate.lan || ({} as LANConfig)),
                          dhcp_enabled: checked,
                        },
                      })
                    }
                  />
                  <Label htmlFor="lan_dhcp">DHCP Enabled</Label>
                </div>
                {editingTemplate.lan?.dhcp_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dhcp_start">DHCP Start</Label>
                      <Input
                        id="dhcp_start"
                        value={editingTemplate.lan?.dhcp_start || ""}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            lan: {
                              ...(editingTemplate.lan || ({} as LANConfig)),
                              dhcp_start: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dhcp_end">DHCP End</Label>
                      <Input
                        id="dhcp_end"
                        value={editingTemplate.lan?.dhcp_end || ""}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            lan: {
                              ...(editingTemplate.lan || ({} as LANConfig)),
                              dhcp_end: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="wan" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wan_type">Connection Type</Label>
                  <Select
                    value={editingTemplate.wan?.connection_type || "PPPoE"}
                    onValueChange={(value) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        wan: {
                          ...(editingTemplate.wan || ({} as WANConfig)),
                          connection_type: value,
                        },
                      })
                    }
                  >
                    <SelectTrigger id="wan_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PPPoE">PPPoE</SelectItem>
                      <SelectItem value="Static">Static IP</SelectItem>
                      <SelectItem value="DHCP">DHCP</SelectItem>
                      <SelectItem value="IPoE">IPoE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wan_vlan">VLAN ID</Label>
                  <Input
                    id="wan_vlan"
                    type="number"
                    min="1"
                    max="4094"
                    value={editingTemplate.wan?.vlan_id || 100}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        wan: {
                          ...(editingTemplate.wan || ({} as WANConfig)),
                          vlan_id: parseInt(e.target.value) || 100,
                        },
                      })
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
