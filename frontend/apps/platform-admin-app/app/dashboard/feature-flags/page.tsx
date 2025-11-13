"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  ToggleLeft,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Clock,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

interface FeatureFlag {
  name: string;
  enabled: boolean;
  context: Record<string, any>;
  description?: string;
  updated_at: number;
  created_at?: number;
}

interface FlagStats {
  total_flags: number;
  enabled_flags: number;
  disabled_flags: number;
}

function FeatureFlagsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagDescription, setNewFlagDescription] = useState("");
  const [newFlagEnabled, setNewFlagEnabled] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch feature flags
  const { data: flags = [], isLoading, refetch } = useQuery<FeatureFlag[]>({
    queryKey: ["feature-flags", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/feature-flags/flags`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch feature flags");
      return response.json();
    },
  });

  // Calculate statistics
  const stats: FlagStats = {
    total_flags: flags.length,
    enabled_flags: flags.filter(f => f.enabled).length,
    disabled_flags: flags.filter(f => !f.enabled).length,
  };

  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      !searchQuery ||
      flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (flag.description && flag.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && flag.enabled) ||
      (statusFilter === "disabled" && !flag.enabled);

    return matchesSearch && matchesStatus;
  });

  // Create flag mutation
  const createFlagMutation = useMutation({
    mutationFn: async (data: { name: string; enabled: boolean; description?: string }) => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/feature-flags/flags/${data.name}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            enabled: data.enabled,
            description: data.description,
            context: {},
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create flag");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Feature flag created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      setIsCreateDialogOpen(false);
      setNewFlagName("");
      setNewFlagDescription("");
      setNewFlagEnabled(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async (data: { name: string; enabled: boolean; description?: string }) => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/feature-flags/flags/${data.name}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            enabled: data.enabled,
            description: data.description,
            context: {},
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to toggle flag");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({
        title: "Success",
        description: "Feature flag updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete flag mutation
  const deleteFlagMutation = useMutation({
    mutationFn: async (flagName: string) => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/feature-flags/flags/${flagName}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to delete flag");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Feature flag deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleFlag = (flag: FeatureFlag) => {
    toggleFlagMutation.mutate({
      name: flag.name,
      enabled: !flag.enabled,
      ...(flag.description && { description: flag.description }),
    });
  };

  const handleDeleteFlag = async (flagName: string) => {
    const confirmed = await confirmDialog({
      title: "Delete feature flag",
      description: `Are you sure you want to delete the feature flag "${flagName}"?`,
      confirmText: "Delete flag",
      variant: "destructive",
    });
    if (confirmed) {
      deleteFlagMutation.mutate(flagName);
    }
  };

  const handleCreateFlag = () => {
    if (!newFlagName.trim()) {
      toast({
        title: "Error",
        description: "Flag name is required",
        variant: "destructive",
      });
      return;
    }

    createFlagMutation.mutate({
      name: newFlagName.trim(),
      enabled: newFlagEnabled,
      ...(newFlagDescription.trim() && { description: newFlagDescription.trim() }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-sm text-muted-foreground">
            Manage feature flags for controlled feature rollouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Flag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Feature Flag</DialogTitle>
                <DialogDescription>
                  Add a new feature flag to control feature rollouts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-name">Flag Name</Label>
                  <Input
                    id="flag-name"
                    placeholder="e.g., new-dashboard-ui"
                    value={newFlagName}
                    onChange={(e) => setNewFlagName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use alphanumeric characters, hyphens, and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-description">Description (Optional)</Label>
                  <Textarea
                    id="flag-description"
                    placeholder="Describe what this flag controls..."
                    value={newFlagDescription}
                    onChange={(e) => setNewFlagDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="flag-enabled"
                    checked={newFlagEnabled}
                    onCheckedChange={setNewFlagEnabled}
                  />
                  <Label htmlFor="flag-enabled">Enabled by default</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFlag}
                  disabled={createFlagMutation.isPending}
                >
                  {createFlagMutation.isPending ? "Creating..." : "Create Flag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_flags}</div>
            <p className="text-xs text-muted-foreground">All feature flags</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabled_flags}</div>
            <p className="text-xs text-muted-foreground">Active flags</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disabled_flags}</div>
            <p className="text-xs text-muted-foreground">Inactive flags</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search flags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Flags List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading feature flags...
            </CardContent>
          </Card>
        ) : filteredFlags.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No flags match your search" : "No feature flags found"}
            </CardContent>
          </Card>
        ) : (
          filteredFlags.map((flag) => (
            <Card key={flag.name} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">
                        <Link
                          href={`/dashboard/feature-flags/${encodeURIComponent(flag.name)}`}
                          className="hover:underline"
                        >
                          {flag.name}
                        </Link>
                      </CardTitle>
                      <Badge variant={flag.enabled ? "default" : "outline"}>
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {flag.description && (
                      <CardDescription>{flag.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleToggleFlag(flag)}
                      disabled={toggleFlagMutation.isPending}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Updated {formatDistanceToNow(new Date(flag.updated_at * 1000), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/feature-flags/${encodeURIComponent(flag.name)}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteFlag(flag.name)}
                      disabled={deleteFlagMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {Object.keys(flag.context).length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Context Rules</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(flag.context).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {JSON.stringify(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function FeatureFlagsPage() {
  return (
    <RouteGuard permission="admin">
      <FeatureFlagsPageContent />
    </RouteGuard>
  );
}
