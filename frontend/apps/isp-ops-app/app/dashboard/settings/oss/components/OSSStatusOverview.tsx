"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  CheckCircle2,
  XCircle,
  Settings,
  Network,
  Router,
  Database,
  Cog,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { OSS_SERVICE_INFO, type OSSServiceConfigResponse } from "@/lib/services/oss-config-service";

interface OSSStatusOverviewProps {
  configurations: OSSServiceConfigResponse[];
  statistics: {
    totalServices: number;
    configuredCount: number;
    overriddenCount: number;
    services: Array<{
      service: string;
      configured: boolean;
      hasOverrides: boolean;
      overrideCount: number;
    }>;
  };
}

const SERVICE_ICONS = {
  voltha: Network,
  genieacs: Router,
  netbox: Database,
  ansible: Cog,
};

export function OSSStatusOverview({ configurations, statistics }: OSSStatusOverviewProps) {
  const getStatusIcon = (configured: boolean) => {
    return configured ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (configured: boolean) => {
    return (
      <Badge variant={configured ? "default" : "destructive"} className="gap-1">
        {getStatusIcon(configured)}
        {configured ? "Configured" : "Not Configured"}
      </Badge>
    );
  };

  const getOverrideBadge = (hasOverrides: boolean, count: number) => {
    if (!hasOverrides) {
      return <Badge variant="outline">Default Settings</Badge>;
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <Settings className="h-3 w-3" />
        {count} Override{count !== 1 ? "s" : ""}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{statistics.totalServices}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">OSS integrations available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">
                {statistics.configuredCount}/{statistics.totalServices}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Services with valid configuration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tenant Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{statistics.overriddenCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Services with custom settings</p>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OSS Services Status</CardTitle>
          <CardDescription>Configuration status for all OSS integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Configuration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configurations.map((config) => {
                  const Icon = SERVICE_ICONS[config.service as keyof typeof SERVICE_ICONS];
                  const serviceInfo = OSS_SERVICE_INFO[config.service];
                  const serviceStat = statistics.services.find((s) => s.service === config.service);

                  return (
                    <TableRow key={config.service}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{serviceInfo.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {serviceInfo.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        {config.config.url ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {config.config.url}
                          </code>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(serviceStat?.configured || false)}</TableCell>
                      <TableCell>
                        {getOverrideBadge(
                          serviceStat?.hasOverrides || false,
                          serviceStat?.overrideCount || 0,
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Warning */}
      {statistics.configuredCount < statistics.totalServices && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {statistics.totalServices - statistics.configuredCount} OSS service
              {statistics.totalServices - statistics.configuredCount !== 1 ? "s are" : " is"} not
              configured. Configure each service in its respective tab to enable full functionality.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
