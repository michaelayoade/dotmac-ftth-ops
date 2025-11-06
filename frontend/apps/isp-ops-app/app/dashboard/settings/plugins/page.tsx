"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Puzzle,
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit,
  Activity,
  Search,
  Loader2,
} from "lucide-react";
import { PluginForm } from "./components/PluginForm";
import { PluginCard } from "./components/PluginCard";
import { PluginHealthDashboard } from "./components/PluginHealthDashboard";
import {
  useAvailablePlugins,
  usePluginInstances,
  useBulkHealthCheck,
  useCreatePluginInstance,
  useUpdatePluginConfiguration,
  useDeletePluginInstance,
  useTestPluginConnection,
  useRefreshPlugins,
  type PluginConfig,
  type PluginInstance,
  type PluginHealthCheck,
  type PluginType,
  type PluginStatus,
  type CreatePluginInstanceRequest,
  type PluginTestResult,
} from "@/hooks/usePlugins";
import { Alert, AlertDescription } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { logger } from "@/lib/logger";
const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

type ViewMode = "grid" | "list" | "health";

export default function PluginsPage() {
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<PluginType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<PluginStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingInstance, setEditingInstance] = useState<PluginInstance | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginConfig | null>(null);

  // Query hooks
  const {
    data: availablePluginsData,
    isLoading: loadingPlugins,
    error: pluginsError,
  } = useAvailablePlugins();
  const availablePlugins = availablePluginsData ?? [];
  const {
    data: instancesData,
    isLoading: loadingInstances,
    error: instancesError,
  } = usePluginInstances();
  const pluginInstances = instancesData?.plugins ?? [];

  // Health check state
  const [healthChecks, setHealthChecks] = useState<PluginHealthCheck[]>([]);
  const bulkHealthCheck = useBulkHealthCheck();

  // Mutation hooks
  const createInstance = useCreatePluginInstance();
  const updateConfiguration = useUpdatePluginConfiguration();
  const deleteInstance = useDeletePluginInstance();
  const testConnection = useTestPluginConnection();
  const refreshPlugins = useRefreshPlugins();
  const confirmDialog = useConfirmDialog();

  // Load health checks whenever instances change
  const loadHealthChecks = useCallback(async () => {
    try {
      const result = await bulkHealthCheck.mutateAsync(undefined);
      setHealthChecks(result);
    } catch (error) {
      logger.error("Failed to load plugin health checks", toError(error));
    }
  }, [bulkHealthCheck]);

  // Refresh health checks when instances load
  useEffect(() => {
    if (pluginInstances.length > 0) {
      loadHealthChecks();
    }
  }, [pluginInstances.length, loadHealthChecks]);

  const handleCreateInstance = async (data: CreatePluginInstanceRequest) => {
    await createInstance.mutateAsync(data);
    setShowCreateForm(false);
    setSelectedPlugin(null);
    await loadHealthChecks();
  };

  const handleUpdateInstance = async (
    instanceId: string,
    configuration: Record<string, unknown>,
  ) => {
    await updateConfiguration.mutateAsync({
      instanceId,
      data: { configuration },
    });
    setEditingInstance(null);
    await loadHealthChecks();
  };

  const handleDeleteInstance = async (instanceId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete plugin instance",
      description: "Are you sure you want to delete this plugin instance? This cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    await deleteInstance.mutateAsync(instanceId);
    setHealthChecks((prev) => prev.filter((health) => health.plugin_instance_id !== instanceId));
  };

  const handleTestConnection = async (
    instanceId: string,
    testConfig?: Record<string, unknown>,
  ): Promise<PluginTestResult> => {
    const result = await testConnection.mutateAsync({
      instanceId,
      configuration: testConfig || null,
    });
    return result;
  };

  const handleRefreshPlugins = async () => {
    await refreshPlugins.mutateAsync();
    await loadHealthChecks();
  };

  const handleTypeFilterChange = (value: string) => {
    if (value === "all") {
      setFilterType("all");
      return;
    }
    setFilterType(value as PluginType);
  };

  const handleStatusFilterChange = (value: string) => {
    if (value === "all") {
      setFilterStatus("all");
      return;
    }
    setFilterStatus(value as PluginStatus);
  };

  // Filter functions
  const filteredPlugins = availablePlugins.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || plugin.type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredInstances = pluginInstances.filter((instance) => {
    const matchesSearch =
      instance.plugin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.instance_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || instance.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getHealthStatus = (instanceId: string) => {
    return healthChecks.find((health) => health.plugin_instance_id === instanceId);
  };

  const isLoading = loadingPlugins || loadingInstances;
  const error = pluginsError || instancesError;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading plugins...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error.message || "Failed to load plugin data"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <main role="main" className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Puzzle className="h-6 w-6 text-sky-500" />
                Plugin Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure and manage plugins for extended functionality
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshPlugins}
                disabled={refreshPlugins.isPending}
                className="px-3 py-2 text-sm border border-border text-muted-foreground rounded-lg hover:bg-accent transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshPlugins.isPending ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Plugin
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Puzzle className="h-8 w-8 text-sky-500" />
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {availablePlugins.length}
                </div>
                <div className="text-sm text-muted-foreground">Available Plugins</div>
              </div>
            </div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {pluginInstances.length}
                </div>
                <div className="text-sm text-muted-foreground">Active Instances</div>
              </div>
            </div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {healthChecks.filter((h) => h.status === "healthy").length}
                </div>
                <div className="text-sm text-muted-foreground">Healthy</div>
              </div>
            </div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {healthChecks.filter((h) => h.status !== "healthy").length}
                </div>
                <div className="text-sm text-muted-foreground">Issues</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select
              value={viewMode === "grid" ? filterType : filterStatus}
              onChange={(e) =>
                viewMode === "grid"
                  ? handleTypeFilterChange(e.target.value)
                  : handleStatusFilterChange(e.target.value)
              }
              className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {viewMode === "grid" ? (
                <>
                  <option value="all">All Types</option>
                  <option value="notification">Notification</option>
                  <option value="integration">Integration</option>
                  <option value="payment">Payment</option>
                  <option value="storage">Storage</option>
                  <option value="search">Search</option>
                  <option value="analytics">Analytics</option>
                  <option value="authentication">Authentication</option>
                  <option value="workflow">Workflow</option>
                </>
              ) : (
                <>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="error">Error</option>
                  <option value="configured">Configured</option>
                </>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-sky-500 text-white"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-sky-500 text-white"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="space-y-1 w-4 h-4">
                <div className="bg-current h-0.5 rounded"></div>
                <div className="bg-current h-0.5 rounded"></div>
                <div className="bg-current h-0.5 rounded"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode("health")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "health"
                  ? "bg-sky-500 text-white"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === "health" ? (
          <PluginHealthDashboard
            instances={pluginInstances}
            healthChecks={healthChecks}
            onRefresh={loadHealthChecks}
          />
        ) : viewMode === "grid" && !showCreateForm ? (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Available Plugins</h2>
            {filteredPlugins.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No plugins found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.name}
                    plugin={plugin}
                    instances={pluginInstances.filter((inst) => inst.plugin_name === plugin.name)}
                    onInstall={(plugin) => {
                      setSelectedPlugin(plugin as any);
                      setShowCreateForm(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Plugin Instances</h2>
            {filteredInstances.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {pluginInstances.length === 0
                  ? 'No plugin instances configured yet. Click "Add Plugin" to get started.'
                  : "No instances match your search criteria."}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInstances.map((instance) => {
                  const healthStatus = getHealthStatus(instance.id);
                  return (
                    <div
                      key={instance.id}
                      className="bg-card/50 border border-border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              healthStatus?.status === "healthy"
                                ? "bg-emerald-500"
                                : healthStatus?.status === "unhealthy"
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                            }`}
                          />
                          <div>
                            <h3 className="font-medium text-foreground">
                              {instance.instance_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {instance.plugin_name} • {instance.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingInstance(instance)}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInstance(instance.id)}
                            disabled={deleteInstance.isPending}
                            className="p-2 text-muted-foreground hover:text-rose-400 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {instance.last_error && (
                        <div className="mt-2 text-sm text-rose-400 bg-rose-500/10 px-2 py-1 rounded">
                          {instance.last_error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create Plugin Modal */}
        {showCreateForm && (
          <PluginForm
            plugin={selectedPlugin}
            onSubmit={handleCreateInstance}
            onCancel={() => {
              setShowCreateForm(false);
              setSelectedPlugin(null);
            }}
            onTestConnection={handleTestConnection}
            availablePlugins={availablePlugins}
          />
        )}

        {/* Edit Plugin Modal */}
        {editingInstance && (
          <PluginForm
            plugin={editingInstance.config_schema}
            instance={editingInstance}
            onSubmit={(data) => handleUpdateInstance(editingInstance.id, data.configuration)}
            onCancel={() => setEditingInstance(null)}
            onTestConnection={(_, testConfig) =>
              handleTestConnection(editingInstance.id, testConfig)
            }
            availablePlugins={availablePlugins}
          />
        )}
      </div>
    </main>
  );
}
