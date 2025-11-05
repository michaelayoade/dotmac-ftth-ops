"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ToggleLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Edit,
  Save,
  TestTube,
  Info,
  Activity,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@/components/ui/use-toast";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";

interface FeatureFlag {
  name: string;
  enabled: boolean;
  context: Record<string, any>;
  description?: string;
  updated_at: number;
  created_at?: number;
}

function FeatureFlagDetailsPageContent() {
  const params = useParams();
  const router = useRouter();
  const flagName = decodeURIComponent(params?.flagName as string);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const confirmDialog = useConfirmDialog();

  // Fetch flag details
  const { data: flag, isLoading, refetch } = useQuery<FeatureFlag>({
    queryKey: ["feature-flag", flagName],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/feature-flags/flags/${encodeURIComponent(flagName)}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Feature flag not found");
        }
        throw new Error("Failed to fetch feature flag");
      }
      const data = await response.json();
      setEditedDescription(data.description || "");
      return data;
    },
    enabled: !!flagName,
  });

  // Toggle flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/feature-flags/flags/${encodeURIComponent(flagName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            enabled,
            description: flag?.description,
            context: flag?.context || {},
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to toggle flag");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Feature flag updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["feature-flag", flagName] });
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

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/feature-flags/flags/${encodeURIComponent(flagName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            enabled: flag?.enabled || false,
            description,
            context: flag?.context || {},
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to update description");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Description updated successfully",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["feature-flag", flagName] });
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

  // Delete flag mutation
  const deleteFlagMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/feature-flags/flags/${encodeURIComponent(flagName)}`,
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
      router.push("/dashboard/feature-flags");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveDescription = () => {
    updateDescriptionMutation.mutate(editedDescription);
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: "Delete feature flag",
      description: `Are you sure you want to delete the feature flag "${flagName}"?`,
      confirmText: "Delete flag",
      variant: "destructive",
    });
    if (confirmed) {
      deleteFlagMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flag) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Feature Flag Not Found</h2>
        <p className="text-muted-foreground mb-4">The feature flag you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link href="/dashboard/feature-flags">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feature Flags
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/feature-flags">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{flag.name}</h1>
            <p className="text-sm text-muted-foreground">Feature flag configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={flag.enabled ? "default" : "outline"}>
            {flag.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="flag-enabled"
              checked={flag.enabled}
              onCheckedChange={(checked) => toggleFlagMutation.mutate(checked)}
              disabled={toggleFlagMutation.isPending}
            />
            <Label htmlFor="flag-enabled">
              {flag.enabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteFlagMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {deleteFlagMutation.isPending ? "Deleting..." : "Delete Flag"}
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="context">Context Rules</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flag Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Name</p>
                  </div>
                  <p className="font-medium font-mono">{flag.name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Status</p>
                  </div>
                  <p className="font-medium capitalize">
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Description</p>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe what this flag controls..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveDescription}
                        disabled={updateDescriptionMutation.isPending}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {updateDescriptionMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedDescription(flag.description || "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">
                    {flag.description || <span className="text-muted-foreground">No description provided</span>}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Timestamps</p>
                </div>
                <div className="space-y-2">
                  {flag.created_at && (
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm">Created At</span>
                      <span className="font-mono text-xs">
                        {format(new Date(flag.created_at * 1000), "PPpp")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Last Updated</span>
                    <span className="font-mono text-xs">
                      {format(new Date(flag.updated_at * 1000), "PPpp")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Context Tab */}
        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Context Rules</CardTitle>
              <CardDescription>Conditional rules for when this flag should be enabled</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(flag.context).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No context rules configured. This flag applies to all contexts.
                </p>
              ) : (
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(flag.context, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FeatureFlagDetailsPage() {
  return (
    <RouteGuard permission="admin">
      <FeatureFlagDetailsPageContent />
    </RouteGuard>
  );
}
