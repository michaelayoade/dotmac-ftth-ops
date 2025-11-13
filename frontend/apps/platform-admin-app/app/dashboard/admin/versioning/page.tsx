"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code,
  GitBranch,
  Info,
  Plus,
  RefreshCw,
  Settings,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  useVersions,
  useBreakingChanges,
  useVersionAdoption,
  useVersioningConfiguration,
} from "@/hooks/useVersioning";
import type { VersionStatus } from "@/hooks/useVersioning";

// ============================================
// Status Badge Component
// ============================================

function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const statusConfig: Record<
    VersionStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: any;
    }
  > = {
    active: {
      label: "Active",
      variant: "default",
      icon: CheckCircle2,
    },
    deprecated: {
      label: "Deprecated",
      variant: "secondary",
      icon: AlertCircle,
    },
    sunset: {
      label: "Sunset",
      variant: "outline",
      icon: Clock,
    },
    removed: {
      label: "Removed",
      variant: "destructive",
      icon: XCircle,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ============================================
// Overview Tab Component
// ============================================

function OverviewTab() {
  const { data: versions = [], isLoading: versionsLoading } = useVersions();
  const { data: adoption, isLoading: adoptionLoading } = useVersionAdoption(30);
  const { data: config, isLoading: configLoading } = useVersioningConfiguration();

  const activeVersions = versions.filter((v) => v.status === "active");
  const deprecatedVersions = versions.filter((v) => v.status === "deprecated");
  const defaultVersion = versions.find((v) => v.is_default);

  if (versionsLoading || adoptionLoading || configLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-slate-700 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Versions</p>
                <p className="text-3xl font-bold text-white">{versions.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <GitBranch className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Active Versions</p>
                <p className="text-3xl font-bold text-white">{activeVersions.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Deprecated</p>
                <p className="text-3xl font-bold text-white">{deprecatedVersions.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <AlertCircle className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Clients</p>
                <p className="text-3xl font-bold text-white">{adoption?.total_clients || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/20">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Default Version */}
      {defaultVersion && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Default Version</CardTitle>
            <CardDescription>Currently active default API version</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Code className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{defaultVersion.version}</p>
                  <p className="text-sm text-slate-400">{defaultVersion.description}</p>
                </div>
              </div>
              <VersionStatusBadge status={defaultVersion.status} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Summary */}
      {config && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Versioning Strategy</p>
                <p className="text-white font-medium">{config.versioning_strategy}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Strict Mode</p>
                <Badge variant={config.strict_mode ? "default" : "outline"} className="text-xs">
                  {config.strict_mode ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Auto Upgrade</p>
                <Badge variant={config.auto_upgrade ? "default" : "outline"} className="text-xs">
                  {config.auto_upgrade ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Supported Versions</p>
                <p className="text-white font-medium">{config.supported_versions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adoption Metrics */}
      {adoption && adoption.versions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Version Adoption (Last 30 Days)</CardTitle>
            <CardDescription>Usage distribution across API versions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adoption.versions
                .sort((a, b) => b.request_count - a.request_count)
                .map((versionStats) => {
                  const version = versions.find((v) => v.version === versionStats.version);
                  return (
                    <div
                      key={versionStats.version}
                      className="flex items-center justify-between p-4 bg-slate-900 rounded-lg"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div>
                          <p className="text-white font-medium">{versionStats.version}</p>
                          {version && <VersionStatusBadge status={version.status} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{
                                  width: `${versionStats.adoption_percentage}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-slate-400 w-12">
                              {versionStats.adoption_percentage.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {versionStats.request_count.toLocaleString()} requests •{" "}
                            {versionStats.unique_clients} clients
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Error Rate</p>
                        <p className="text-white font-medium">
                          {(versionStats.error_rate * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Versions Tab Component
// ============================================

function VersionsTab() {
  const { data: versions = [], isLoading, refetch } = useVersions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400">Loading versions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400">{versions.length} versions</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="border-slate-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Version
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {versions.map((version) => (
          <Card
            key={version.version}
            className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white text-2xl">{version.version}</CardTitle>
                  <CardDescription className="mt-1">{version.description}</CardDescription>
                </div>
                <div className="flex flex-col gap-2">
                  <VersionStatusBadge status={version.status} />
                  {version.is_default && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-400">Release Date</p>
                <p className="text-sm text-white">
                  {new Date(version.release_date).toLocaleDateString()}
                </p>
              </div>

              {version.deprecation_date && (
                <div>
                  <p className="text-xs text-slate-400">Deprecation Date</p>
                  <p className="text-sm text-yellow-400">
                    {new Date(version.deprecation_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {version.sunset_date && (
                <div>
                  <p className="text-xs text-slate-400">Sunset Date</p>
                  <p className="text-sm text-orange-400">
                    {new Date(version.sunset_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" size="sm" className="flex-1 border-slate-700">
                  Edit
                </Button>
                {version.status === "active" && !version.is_default && (
                  <Button variant="outline" size="sm" className="flex-1 border-slate-700">
                    Deprecate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {versions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <GitBranch className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg mb-2">No versions found</p>
          <p className="text-slate-500 text-sm mb-4">
            Create your first API version to get started
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Version
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Breaking Changes Tab Component
// ============================================

function BreakingChangesTab() {
  const { data: changes = [], isLoading, refetch } = useBreakingChanges();

  const getSeverityColor = (severity: string) => {
    const colorMap: Record<string, string> = {
      critical: "text-red-400 bg-red-500/20",
      high: "text-orange-400 bg-orange-500/20",
      medium: "text-yellow-400 bg-yellow-500/20",
      low: "text-blue-400 bg-blue-500/20",
    };
    return colorMap[severity] || "text-gray-400 bg-gray-500/20";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400">Loading breaking changes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400">{changes.length} breaking changes</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="border-slate-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Breaking Change
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {changes.map((change) => (
          <Card key={change.id} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline">{change.version}</Badge>
                    <Badge className={getSeverityColor(change.severity)}>{change.severity}</Badge>
                    <Badge variant="secondary">{change.change_type}</Badge>
                  </div>
                  <h3 className="text-white font-medium text-lg">{change.title}</h3>
                  <p className="text-slate-400 text-sm mt-1">{change.description}</p>
                </div>
              </div>

              {change.affected_endpoints.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-2">Affected Endpoints:</p>
                  <div className="flex flex-wrap gap-2">
                    {change.affected_endpoints.map((endpoint, idx) => (
                      <code
                        key={idx}
                        className="text-xs bg-slate-900 px-2 py-1 rounded text-blue-400"
                      >
                        {endpoint}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {change.migration_steps.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Migration Steps:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {change.migration_steps.map((step, idx) => (
                      <li key={idx} className="text-sm text-slate-300">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                <Button variant="outline" size="sm" className="border-slate-700">
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700 text-red-400">
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {changes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Info className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg mb-2">No breaking changes found</p>
          <p className="text-slate-500 text-sm mb-4">
            Document breaking changes to help API consumers migrate
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Breaking Change
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function VersioningPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">API Versioning</h1>
          <p className="text-slate-400 mt-1">
            Manage API versions, track adoption, and document breaking changes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="changes">Breaking Changes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <VersionsTab />
        </TabsContent>

        <TabsContent value="changes" className="mt-6">
          <BreakingChangesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
