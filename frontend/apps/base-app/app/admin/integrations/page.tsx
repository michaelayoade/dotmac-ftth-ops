"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import {
  Plug,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Key,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useIntegrations,
  useHealthCheck,
  getStatusColor,
  getStatusIcon,
  getTypeColor,
  getTypeIcon,
  getProviderDisplayName,
  groupByType,
  calculateHealthStats,
  formatLastCheck,
  type IntegrationType,
  type IntegrationResponse,
} from "@/hooks/useIntegrations";

export default function IntegrationsPage() {
  const [selectedType, setSelectedType] = useState<IntegrationType | "all">("all");

  // Query hooks
  const { data, isLoading, error, refetch } = useIntegrations();
  const healthCheck = useHealthCheck();

  const integrations = data?.integrations ?? [];
  const total = data?.total ?? 0;

  // Filter integrations by type
  const filteredIntegrations =
    selectedType === "all"
      ? integrations
      : integrations.filter((i: IntegrationResponse) => i.type === selectedType);

  // Group by type for categorized view
  const groupedIntegrations = groupByType(integrations);

  // Calculate statistics
  const stats = calculateHealthStats(integrations);

  const handleHealthCheck = async (integrationName: string) => {
    await healthCheck.mutateAsync(integrationName);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              External Services
            </p>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
              <Plug className="h-8 w-8 text-primary" />
              Service Integrations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage external service connections for email, SMS, storage, and more
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load integrations: {error.message}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && integrations.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading integrations...</span>
        </div>
      )}

      {/* Statistics Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Configured</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Ready
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats.ready}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? `${((stats.ready / stats.total) * 100).toFixed(0)}%` : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-400" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats.error}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-400">{stats.disabled}</div>
              <p className="text-xs text-muted-foreground mt-1">Not active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Configuring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{stats.configuring}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">Filter by type:</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as IntegrationType | "all")}
          className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Types ({total})</option>
          {Object.keys(groupedIntegrations).map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)} (
              {groupedIntegrations[type as IntegrationType].length})
            </option>
          ))}
        </select>
      </div>

      {/* Integrations List */}
      {!isLoading && filteredIntegrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No integrations found. Configure integrations in platform settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration: IntegrationResponse) => (
            <Card key={integration.name} className="border-primary/30">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getTypeIcon(integration.type)}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {getProviderDisplayName(integration.provider)}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={getTypeColor(integration.type)}>
                    {integration.type}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${getStatusColor(
                      integration.status,
                    )}`}
                  >
                    {getStatusIcon(integration.status)} {integration.status}
                  </span>
                </div>

                {/* Status Message */}
                {integration.message && (
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {integration.message}
                  </div>
                )}

                {/* Last Health Check */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last check
                  </span>
                  <span className="font-medium">{formatLastCheck(integration.last_check)}</span>
                </div>

                {/* Configuration Details */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-1 text-xs">
                    <Settings className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {integration.settings_count} settings
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Key className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {integration.has_secrets ? "Has secrets" : "No secrets"}
                    </span>
                  </div>
                </div>

                {/* Required Packages */}
                {integration.required_packages.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span>Required packages:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {integration.required_packages.map((pkg: string) => (
                        <Badge key={pkg} variant="secondary" className="text-xs">
                          {pkg}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Health Check Button */}
                {integration.enabled && (
                  <Button
                    onClick={() => handleHealthCheck(integration.name)}
                    disabled={healthCheck.isPending}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                  >
                    {healthCheck.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        Health Check
                      </>
                    )}
                  </Button>
                )}

                {/* Metadata */}
                {integration.metadata && Object.keys(integration.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View metadata
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(integration.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
