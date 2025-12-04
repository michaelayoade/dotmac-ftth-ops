"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Bell, AlertCircle, TestTube, Edit, Trash2 } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { CreateAlertChannelModal } from "@/components/alerts/CreateAlertChannelModal";
import { EditAlertChannelModal } from "@/components/alerts/EditAlertChannelModal";
import { TestAlertModal } from "@/components/alerts/TestAlertModal";
import { apiClient } from "@/lib/api/client";

interface AlertChannel {
  id: string;
  name: string;
  channel_type: "slack" | "email" | "webhook" | "pagerduty" | "msteams";
  enabled: boolean;
  tenant_id: string | null;
  severities: string[] | null;
  alert_names: string[] | null;
  alert_categories: string[] | null;
}

export default function AlertChannelsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<AlertChannel | null>(null);
  const [testChannel, setTestChannel] = useState<AlertChannel | null>(null);

  // Fetch alert channels
  const {
    data: channels,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["alert-channels"],
    queryFn: async () => {
      const response = await apiClient.get("/alerts/channels");
      return response.data as AlertChannel[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Delete channel mutation
  const deleteMutation = useMutation({
    mutationFn: async (channelId: string) => {
      await apiClient.delete(`/alerts/channels/${channelId}`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setSelectedChannel(null);
    refetch();
  };

  const handleTestSuccess = () => {
    setTestChannel(null);
  };

  const handleDelete = async (channel: AlertChannel) => {
    if (confirm(`Are you sure you want to delete channel "${channel.name}"?`)) {
      deleteMutation.mutate(channel.id);
    }
  };

  const getChannelTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      slack: "💬",
      email: "📧",
      webhook: "🔗",
      pagerduty: "🚨",
      msteams: "👥",
    };
    return icons[type] || "📢";
  };

  const getChannelTypeBadge = (type: string) => {
    const colors: Record<string, "default" | "secondary" | "outline"> = {
      slack: "default",
      email: "secondary",
      webhook: "outline",
      pagerduty: "destructive" as "default",
      msteams: "secondary",
    };

    return (
      <Badge variant={colors[type] || "outline"}>
        {getChannelTypeIcon(type)} {type.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alert Channels</h1>
          <p className="text-sm text-muted-foreground">
            Configure notification channels for Prometheus alerts and system notifications
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Channel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enabled Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {channels?.filter((c) => c.enabled).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disabled Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {channels?.filter((c) => !c.enabled).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Channel Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {channels ? new Set(channels.map((c) => c.channel_type)).size : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Alert Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load alert channels:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : channels && channels.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severities</TableHead>
                  <TableHead>Alert Names</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>{getChannelTypeBadge(channel.channel_type)}</TableCell>
                    <TableCell>
                      {channel.enabled ? (
                        <Badge variant="default">Enabled</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {channel.severities && channel.severities.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {channel.severities.map((severity) => (
                            <Badge key={severity} variant="secondary" className="text-xs">
                              {severity}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {channel.alert_names && channel.alert_names.length > 0 ? (
                        <div className="text-sm">{channel.alert_names.length} alerts</div>
                      ) : (
                        <span className="text-sm text-muted-foreground">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {channel.alert_categories && channel.alert_categories.length > 0 ? (
                        <div className="text-sm">{channel.alert_categories.length} categories</div>
                      ) : (
                        <span className="text-sm text-muted-foreground">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setTestChannel(channel)}>
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedChannel(channel)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(channel)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No alert channels configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first alert channel to receive notifications
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Channel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateAlertChannelModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {selectedChannel && (
        <EditAlertChannelModal
          isOpen={!!selectedChannel}
          channel={selectedChannel}
          onClose={() => setSelectedChannel(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {testChannel && (
        <TestAlertModal
          isOpen={!!testChannel}
          channel={testChannel}
          onClose={() => setTestChannel(null)}
          onSuccess={handleTestSuccess}
        />
      )}
    </div>
  );
}
