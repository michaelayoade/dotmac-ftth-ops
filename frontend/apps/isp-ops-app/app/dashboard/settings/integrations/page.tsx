"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Plug,
  Plus,
  Settings,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Unlink,
  Play,
  Pause,
  Loader2,
  Zap,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import {
  pluginsService,
  type PluginInstance,
  type PluginConfig,
} from "@/lib/services/plugins-service";
import { webhooksService, type WebhookSubscriptionResponse } from "@/lib/services/webhooks-service";

export default function IntegrationsPage() {
  const { toast } = useToast();

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Data states
  const [availablePlugins, setAvailablePlugins] = useState<PluginConfig[]>([]);
  const [pluginInstances, setPluginInstances] = useState<PluginInstance[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscriptionResponse[]>([]);

  // Dialog states
  const [selectedPlugin, setSelectedPlugin] = useState<PluginConfig | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<PluginInstance | null>(null);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [newPluginName, setNewPluginName] = useState("");
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    events: [] as string[],
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [pluginsResponse, instancesResponse, webhooksResponse] = await Promise.all([
        pluginsService.listAvailablePlugins(),
        pluginsService.listPluginInstances(),
        webhooksService.listSubscriptions(),
      ]);

      setAvailablePlugins(pluginsResponse);
      setPluginInstances(instancesResponse.plugins);
      setWebhooks(webhooksResponse);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load all data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Plugin handlers
  const handleConnect = (plugin: PluginConfig) => {
    setSelectedPlugin(plugin);
    setNewPluginName(`${plugin.name} Instance`);
    setIsConnectOpen(true);
  };

  const handleCompleteConnection = async () => {
    if (!selectedPlugin || !newPluginName) return;

    try {
      setIsActionLoading(true);
      await pluginsService.createPluginInstance({
        plugin_name: selectedPlugin.name,
        instance_name: newPluginName,
        configuration: {},
      });

      await loadData();
      setIsConnectOpen(false);
      setNewPluginName("");
      toast({
        title: "Success",
        description: `Connected to ${selectedPlugin.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect plugin",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      setIsActionLoading(true);
      await pluginsService.deletePluginInstance(instanceId);
      await loadData();
      toast({
        title: "Success",
        description: "Plugin disconnected",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect plugin",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefreshPlugin = async (instanceId: string) => {
    try {
      setIsActionLoading(true);
      await pluginsService.refreshPluginInstance(instanceId);
      await loadData();
      toast({
        title: "Success",
        description: "Plugin refreshed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh plugin",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Webhook handlers
  const handleCreateWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) return;

    try {
      setIsActionLoading(true);
      await webhooksService.createSubscription({
        url: newWebhook.url,
        event_types: newWebhook.events,
        is_active: true,
      });

      await loadData();
      setIsWebhookOpen(false);
      setNewWebhook({ url: "", events: [] });
      toast({
        title: "Success",
        description: "Webhook created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create webhook",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      setIsActionLoading(true);
      if (isActive) {
        await webhooksService.pauseSubscription(webhookId);
      } else {
        await webhooksService.activateSubscription(webhookId);
      }
      await loadData();
      toast({
        title: "Success",
        description: `Webhook ${isActive ? "paused" : "activated"}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle webhook",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      setIsActionLoading(true);
      await webhooksService.deleteSubscription(webhookId);
      await loadData();
      toast({
        title: "Success",
        description: "Webhook deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete webhook",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      setIsActionLoading(true);
      await webhooksService.testWebhook(webhookId);
      toast({
        title: "Success",
        description: "Test webhook sent",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to test webhook",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Helper functions
  const getStatusBadge = (status: string) => {
    const color = pluginsService.getStatusColor(status);
    return <Badge className={color}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const isPluginConnected = (pluginName: string) => {
    return pluginInstances.some((instance) => instance.plugin_name === pluginName);
  };

  // Filter available plugins
  const searchLower = searchTerm.toLowerCase();
  const filteredPlugins = availablePlugins.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchLower) ||
      (plugin["description"]?.toLowerCase() ?? "").includes(searchLower),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Connect your favorite tools and services
        </p>
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected">Connected ({pluginInstances.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({availablePlugins.length})</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks ({webhooks.length})</TabsTrigger>
        </TabsList>

        {/* Connected Tab */}
        <TabsContent value="connected" className="space-y-4">
          {pluginInstances.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No integrations connected yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() =>
                    document.querySelector<HTMLElement>('[value="available"]')?.click()
                  }
                >
                  Browse Integrations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pluginInstances.map((instance) => (
                <Card key={instance.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{instance.instance_name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {instance.plugin_name}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={`Open actions for ${instance.instance_name}`}
                            title={`Open actions for ${instance.instance_name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInstance(instance);
                              setIsConfigureOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRefreshPlugin(instance.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDisconnect(instance.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getStatusBadge(instance.status)}
                    </div>
                    {instance.error_message && (
                      <div className="flex items-start gap-2 p-2 bg-red-100 dark:bg-red-950/20 rounded-md">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {instance.error_message}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm">
                        {new Date(instance.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {instance.last_health_check && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Last Check</span>
                        <span className="text-sm">
                          {new Date(instance.last_health_check).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Available Tab */}
        <TabsContent value="available" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
              <Plug className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => {
              const connected = isPluginConnected(plugin.name);
              return (
                <Card key={plugin.name} className={connected ? "opacity-50" : ""}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Plug className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{plugin.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {plugin.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {plugin.category}
                      </Badge>
                      <Button size="sm" onClick={() => handleConnect(plugin)} disabled={connected}>
                        {connected ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </>
                        ) : (
                          <>
                            <Plug className="h-3 w-3 mr-1" />
                            Connect
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>Manage webhook endpoints for real-time events</CardDescription>
                </div>
                <Button onClick={() => setIsWebhookOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No webhooks configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-mono text-sm">{webhook.url}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {webhook.event_types.slice(0, 2).map((event, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                            {webhook.event_types.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.event_types.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={webhooksService.getActiveStatusColor(webhook.is_active)}
                          >
                            {webhook.is_active ? "Active" : "Paused"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {webhooksService.formatSuccessRate(webhook.success_rate)}
                            </span>
                            {webhooksService.needsAttention(webhook) && (
                              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                aria-label={`Open actions for webhook ${webhook["description"] ?? webhook.url}`}
                                title={`Open actions for webhook ${webhook["description"] ?? webhook.url}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                              >
                                {webhook.is_active ? (
                                  <>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestWebhook(webhook.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Test Webhook
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteWebhook(webhook.id)}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Plugin Dialog */}
      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to {selectedPlugin?.name}</DialogTitle>
            <DialogDescription>Create a new instance of this integration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Instance Name</Label>
              <Input
                id="instance-name"
                value={newPluginName}
                onChange={(e) => setNewPluginName(e.target.value)}
                placeholder="e.g., My GitHub Integration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteConnection} disabled={!newPluginName || isActionLoading}>
              {isActionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={isWebhookOpen} onOpenChange={setIsWebhookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>Configure a new webhook endpoint</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://api.example.com/webhooks"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {webhooksService.getAvailableEventTypes().map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={event}
                      checked={newWebhook.events.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewWebhook({
                            ...newWebhook,
                            events: [...newWebhook.events, event],
                          });
                        } else {
                          setNewWebhook({
                            ...newWebhook,
                            events: newWebhook.events.filter((e) => e !== event),
                          });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <Label htmlFor={event} className="text-sm font-normal">
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWebhookOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={!newWebhook.url || newWebhook.events.length === 0 || isActionLoading}
            >
              {isActionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Webhook"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
