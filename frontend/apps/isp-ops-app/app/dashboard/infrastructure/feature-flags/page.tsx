"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";

interface FeatureFlag {
  id: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  type: string;
  environment: string;
  targeting: string;
  segment?: string;
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
  tags: string[];
}
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ToggleLeft,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  Users,
  Percent,
  AlertCircle,
  CheckCircle2,
  Code,
  Globe,
  Loader2,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/error-handler";

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const {
    flags: backendFlags,
    toggleFlag,
    deleteFlag: deleteBackendFlag,
    refreshFlags,
  } = useFeatureFlags();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEnvironment, setFilterEnvironment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map backend flags to display format
  const flags: FeatureFlag[] = backendFlags.map((flag) => ({
    id: flag.name,
    name: flag.name,
    displayName: flag.name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description: flag.description || "No description provided",
    enabled: flag.enabled,
    type: "boolean",
    environment: "production",
    targeting: "all",
    rolloutPercentage: flag.enabled ? 100 : 0,
    createdAt: flag["created_at"]
      ? new Date(flag.created_at * 1000).toISOString()
      : new Date().toISOString(),
    updatedAt: new Date(flag.updated_at * 1000).toISOString(),
    lastModifiedBy: "system",
    tags: Object.keys(flag.context || {}),
  }));

  // New flag form state
  const [newFlag, setNewFlag] = useState({
    name: "",
    displayName: "",
    description: "",
    type: "boolean",
    enabled: false,
    environment: "staging",
    targeting: "all",
    rolloutPercentage: 100,
    tags: "",
  });

  // Filter flags
  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEnvironment =
      filterEnvironment === "all" || flag.environment === filterEnvironment;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "enabled" && flag.enabled) ||
      (filterStatus === "disabled" && !flag.enabled);
    return matchesSearch && matchesEnvironment && matchesStatus;
  });

  const handleToggleFlag = async (flagId: string) => {
    const flag = flags.find((f) => f.id === flagId);
    if (!flag) return;

    try {
      await toggleFlag(flagId, !flag.enabled);
      logger.info("Feature flag toggled", { flagId, enabled: !flag.enabled });
      toast({
        title: "Success",
        description: `Feature flag "${flag.displayName}" ${flag.enabled ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      logger.error("Failed to toggle feature flag", error, { flagId });
      handleApiError(error, {
        userMessage: "Failed to toggle feature flag. Please try again.",
      });
    }
  };

  const handleCreateFlag = async () => {
    if (!newFlag.name || !newFlag.displayName) {
      toast({
        title: "Validation Error",
        description: "Flag name and display name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/feature-flags", {
        name: newFlag.name,
        display_name: newFlag.displayName,
        description: newFlag.description,
        enabled: newFlag.enabled,
        type: newFlag.type,
        environment: newFlag.environment,
        targeting: newFlag.targeting,
        rollout_percentage: newFlag.rolloutPercentage,
        tags: newFlag.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });

      logger.info("Feature flag created", { flagName: newFlag.name });
      await refreshFlags();
      setIsCreateOpen(false);
      setNewFlag({
        name: "",
        displayName: "",
        description: "",
        type: "boolean",
        enabled: false,
        environment: "staging",
        targeting: "all",
        rolloutPercentage: 100,
        tags: "",
      });
      toast({
        title: "Success",
        description: "Feature flag created successfully",
      });
    } catch (error) {
      logger.error("Failed to create feature flag", error);
      handleApiError(error, {
        userMessage: "Failed to create feature flag. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFlag = async () => {
    if (!selectedFlag) return;

    setIsSubmitting(true);
    try {
      await deleteBackendFlag(selectedFlag.id);
      logger.info("Feature flag deleted", { flagId: selectedFlag.id });
      setIsDeleteOpen(false);
      setSelectedFlag(null);
      toast({
        title: "Success",
        description: "Feature flag deleted successfully",
      });
    } catch (error) {
      logger.error("Failed to delete feature flag", error, { flagId: selectedFlag.id });
      handleApiError(error, {
        userMessage: "Failed to delete feature flag. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateFlag = async (flag: FeatureFlag) => {
    try {
      await apiClient.post("/feature-flags", {
        name: `${flag.name}-copy`,
        display_name: `${flag.displayName} (Copy)`,
        description: flag.description,
        enabled: false,
        type: flag.type,
        environment: flag.environment,
        targeting: flag.targeting,
        rollout_percentage: flag.rolloutPercentage,
        tags: flag.tags || [],
      });

      logger.info("Feature flag duplicated", { originalFlagId: flag.id });
      await refreshFlags();
      toast({
        title: "Success",
        description: "Feature flag duplicated successfully",
      });
    } catch (error) {
      logger.error("Failed to duplicate feature flag", error, { flagId: flag.id });
      handleApiError(error, {
        userMessage: "Failed to duplicate feature flag. Please try again.",
      });
    }
  };

  const getEnvironmentBadge = (env: string) => {
    switch (env) {
      case "production":
        return <Badge variant="destructive">{env}</Badge>;
      case "staging":
        return <Badge variant="secondary">{env}</Badge>;
      case "development":
        return <Badge variant="outline">{env}</Badge>;
      default:
        return <Badge variant="outline">{env}</Badge>;
    }
  };

  const getTargetingIcon = (targeting: string) => {
    switch (targeting) {
      case "all":
        return <Globe className="h-4 w-4" />;
      case "segment":
        return <Users className="h-4 w-4" />;
      case "percentage":
        return <Percent className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground mt-2">Manage feature toggles and rollouts</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Flag
        </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Feature Flag</DialogTitle>
              <DialogDescription>
                Define a new feature flag for controlled rollouts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-name">Flag Name</Label>
                  <Input
                    id="flag-name"
                    value={newFlag.name}
                    onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                    placeholder="e.g., new-feature"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-display-name">Display Name</Label>
                  <Input
                    id="flag-display-name"
                    value={newFlag.displayName}
                    onChange={(e) => setNewFlag({ ...newFlag, displayName: e.target.value })}
                    placeholder="e.g., New Feature"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flag-description">Description</Label>
                <Textarea
                  id="flag-description"
                  value={newFlag.description}
                  onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                  placeholder="Describe the purpose of this feature flag"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-type">Type</Label>
                  <select
                    id="flag-type"
                    value={newFlag.type}
                    onChange={(e) => setNewFlag({ ...newFlag, type: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="boolean">Boolean</option>
                    <option value="number">Number</option>
                    <option value="string">String</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-environment">Environment</Label>
                  <select
                    id="flag-environment"
                    value={newFlag.environment}
                    onChange={(e) => setNewFlag({ ...newFlag, environment: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-targeting">Targeting</Label>
                  <select
                    id="flag-targeting"
                    value={newFlag.targeting}
                    onChange={(e) => setNewFlag({ ...newFlag, targeting: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All Users</option>
                    <option value="segment">User Segment</option>
                    <option value="percentage">Percentage Rollout</option>
                  </select>
                </div>
                {newFlag.targeting === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="flag-percentage">Rollout Percentage</Label>
                    <Input
                      id="flag-percentage"
                      type="number"
                      min="0"
                      max="100"
                      value={newFlag.rolloutPercentage}
                      onChange={(e) =>
                        setNewFlag({
                          ...newFlag,
                          rolloutPercentage: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="flag-tags">Tags (comma-separated)</Label>
                <Input
                  id="flag-tags"
                  value={newFlag.tags}
                  onChange={(e) => setNewFlag({ ...newFlag, tags: e.target.value })}
                  placeholder="e.g., frontend, experimental"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="flag-enabled"
                  checked={newFlag.enabled}
                  onCheckedChange={(checked) => setNewFlag({ ...newFlag, enabled: checked })}
                />
                <Label htmlFor="flag-enabled">Enable immediately</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFlag}
                disabled={!newFlag.name || !newFlag.displayName || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Flag"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.length}</div>
            <p className="text-xs text-muted-foreground">Across all environments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.filter((f) => f.enabled).length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Production</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flags.filter((f) => f.environment === "production").length}
            </div>
            <p className="text-xs text-muted-foreground">Live in production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rollouts</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                flags.filter((f) => f.targeting === "percentage" && f.rolloutPercentage < 100)
                  .length
              }
            </div>
            <p className="text-xs text-muted-foreground">Gradual deployments</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="history">Audit History</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
        </TabsList>

        {/* Flags Tab */}
        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>All Flags</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search flags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <select
                    value={filterEnvironment}
                    onChange={(e) => setFilterEnvironment(e.target.value)}
                    className="h-10 w-[150px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  >
                    <option value="all">All Environments</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-10 w-[120px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  >
                    <option value="all">All Status</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flag</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Targeting</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{flag.displayName}</div>
                          <div className="text-sm text-muted-foreground">{flag.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {flag.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getEnvironmentBadge(flag.environment)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTargetingIcon(flag.targeting)}
                          <span className="text-sm">
                            {flag.targeting === "all" && "All Users"}
                            {flag.targeting === "segment" && flag.segment}
                            {flag.targeting === "percentage" && `${flag.rolloutPercentage}%`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {flag.tags?.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(flag.updatedAt).toLocaleDateString()}
                          <div className="text-xs text-muted-foreground">{flag.lastModifiedBy}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => handleToggleFlag(flag.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label={`Open actions for ${flag["name"] ?? "feature flag"}`}
                              title={`Open actions for ${flag["name"] ?? "feature flag"}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleDuplicateFlag(flag)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedFlag(flag);
                                setIsDeleteOpen(true);
                              }}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>Recent changes to feature flags</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Flag audit logs will appear here once the observability service publishes change
                events. Enable audit streaming on the backend to populate this view.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Examples Tab */}
        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Examples</CardTitle>
              <CardDescription>How to use feature flags in your code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  JavaScript/TypeScript
                </h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                  {`import { getFeatureFlag } from '@dotmac/feature-flags';

// Check if a feature is enabled
if (await getFeatureFlag('new-dashboard-ui')) {
  // Show new UI
  renderNewDashboard();
} else {
  // Show old UI
  renderLegacyDashboard();
}

// Get flag with default value
const rateLimit = await getFeatureFlag('api-rate-limit', 1000);
telemetry.track('api_rate_limit', rateLimit);`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Python
                </h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                  {`from dotmac.feature_flags import get_flag

# Check boolean flag
if get_flag('new-dashboard-ui'):
    return render_new_dashboard()
else:
    return render_legacy_dashboard()

# Get numeric flag with default
rate_limit = get_flag('api-rate-limit', default=1000)
print(f"Rate limit: {rate_limit}")`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  React Hook
                </h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                  {`import { useFeatureFlag } from '@dotmac/react-feature-flags';

function MyComponent() {
  const { isEnabled, loading } = useFeatureFlag('new-dashboard-ui');

  if (loading) return <Spinner />;

  return isEnabled ? <NewDashboard /> : <LegacyDashboard />;
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature Flag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feature flag? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedFlag && (
            <div className="py-4">
              <div className="bg-red-100 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      <strong>{selectedFlag.displayName}</strong> will be permanently deleted.
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      Flag name: {selectedFlag.name}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFlag}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Flag"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
