"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Edit,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  Settings,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Parameter {
  name: string;
  value: string | number | boolean;
  writable: boolean;
  type: string;
  path: string;
}

interface ParameterGroup {
  name: string;
  path: string;
  parameters: Parameter[];
  children: ParameterGroup[];
}

function ParametersPageContent() {
  const params = useParams();
  const deviceId = params["deviceId"] as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Device"]));
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Fetch device parameters
  const { data: parametersData, isLoading } = useQuery<ParameterGroup[]>({
    queryKey: ["device-parameters", deviceId, refreshKey],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/parameters`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch parameters");
      return response.json();
    },
  });

  // Fetch device info for header
  const { data: device } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch device");
      return response.json();
    },
  });

  // Update parameter mutation
  const updateMutation = useMutation({
    mutationFn: async ({ path, value }: { path: string; value: string }) => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/parameters`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, value }),
      });
      if (!response.ok) throw new Error("Failed to update parameter");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-parameters", deviceId] });
      setEditingParam(null);
      setEditValue("");
      toast({
        title: "Parameter updated",
        description: "The parameter has been successfully updated on the device.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update the parameter.",
        variant: "destructive",
      });
    },
  });

  // Refresh parameters
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to refresh");
      return response.json();
    },
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast({ title: "Refresh initiated", description: "Device parameters will update shortly." });
    },
  });

  const toggleGroup = (path: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const startEdit = (param: Parameter) => {
    setEditingParam(param.path);
    setEditValue(String(param.value));
  };

  const cancelEdit = () => {
    setEditingParam(null);
    setEditValue("");
  };

  const saveEdit = (param: Parameter) => {
    updateMutation.mutate({ path: param.path, value: editValue });
  };

  const filterParameters = (groups: ParameterGroup[]): ParameterGroup[] => {
    if (!searchQuery) return groups;

    const searchLower = searchQuery.toLowerCase();

    const filterGroup = (group: ParameterGroup): ParameterGroup | null => {
      const matchingParams = group.parameters.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.path.toLowerCase().includes(searchLower) ||
          String(p.value).toLowerCase().includes(searchLower),
      );

      const matchingChildren = group.children
        .map(filterGroup)
        .filter((g): g is ParameterGroup => g !== null);

      if (matchingParams.length > 0 || matchingChildren.length > 0) {
        return {
          ...group,
          parameters: matchingParams,
          children: matchingChildren,
        };
      }

      return null;
    };

    return groups.map(filterGroup).filter((g): g is ParameterGroup => g !== null);
  };

  const renderParameterValue = (param: Parameter) => {
    if (editingParam === param.path) {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8"
            autoFocus
          />
          <Button size="sm" onClick={() => saveEdit(param)} disabled={updateMutation.isPending}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm break-all">{String(param.value)}</span>
        {param.writable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => startEdit(param)}
            className="flex-shrink-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "string":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400";
      case "number":
      case "integer":
        return "bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400";
      case "boolean":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400";
    }
  };

  const renderParameterGroup = (group: ParameterGroup, level: number = 0) => {
    const isExpanded = expandedGroups.has(group.path);
    const hasContent = group.parameters.length > 0 || group.children.length > 0;

    return (
      <div key={group.path} className="space-y-1">
        {/* Group Header */}
        <button
          onClick={() => hasContent && toggleGroup(group.path)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors ${
            level === 0 ? "font-medium" : ""
          }`}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
          disabled={!hasContent}
        >
          {hasContent ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">{group.name}</span>
          <Badge variant="secondary" className="text-xs">
            {group.parameters.length}
          </Badge>
        </button>

        {/* Group Content */}
        {isExpanded && hasContent && (
          <div className="space-y-1">
            {/* Parameters */}
            {group.parameters.map((param) => (
              <div
                key={param.path}
                className="px-3 py-2 rounded-md border ml-6"
                style={{ marginLeft: `${(level + 1) * 1.5}rem` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{param.name}</span>
                      <Badge className={`text-xs ${getTypeColor(param.type)}`}>{param.type}</Badge>
                      {!param.writable && (
                        <Badge variant="outline" className="text-xs">
                          Read-only
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all mb-2">
                      {param.path}
                    </p>
                    <div className="mt-2">{renderParameterValue(param)}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Child Groups */}
            {group.children.map((child) => renderParameterGroup(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredGroups = parametersData ? filterParameters(parametersData) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/devices/${deviceId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Device Parameters</h1>
            <p className="text-sm text-muted-foreground">
              TR-069 parameters for {device?.summary?.serialNumber || deviceId}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button asChild>
            <Link href={`/dashboard/devices/${deviceId}`}>
              <Settings className="h-4 w-4 mr-2" />
              Back to Device
            </Link>
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                About TR-069 Parameters
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                These parameters are defined by the TR-069 protocol standard. Only writable
                parameters can be modified. Changes are applied immediately to the device.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
          <CardDescription>Filter parameters by name, path, or value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Parameters Tree */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Parameter Tree</CardTitle>
              <CardDescription>
                {filteredGroups.length > 0
                  ? `Showing ${filteredGroups.reduce(
                      (acc, g) => acc + g.parameters.length,
                      0,
                    )} parameters`
                  : "No parameters found"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedGroups(new Set(filteredGroups.map((g) => g.path)))}
              >
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setExpandedGroups(new Set())}>
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading parameters...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No parameters match your search"
                : "No parameters available for this device"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredGroups.map((group) => renderParameterGroup(group))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Parameter Types</CardTitle>
          <CardDescription>Understanding parameter types and attributes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Data Types:</p>
              <div className="flex flex-wrap gap-2">
                <Badge className={getTypeColor("string")}>String</Badge>
                <Badge className={getTypeColor("number")}>Number</Badge>
                <Badge className={getTypeColor("boolean")}>Boolean</Badge>
                <Badge className={getTypeColor("object")}>Object</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Access Control:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Read-only - Cannot be modified</Badge>
                <Badge variant="secondary">Writable - Can be edited</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ParametersPage() {
  return (
    <RouteGuard permission="devices.write">
      <ParametersPageContent />
    </RouteGuard>
  );
}
