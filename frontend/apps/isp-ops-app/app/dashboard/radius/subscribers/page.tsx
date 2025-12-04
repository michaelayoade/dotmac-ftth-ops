"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Check,
  X,
  Edit,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { formatDistanceToNow } from "date-fns";

interface RADIUSSubscriber {
  id: number;
  tenant_id: string;
  subscriber_id: string;
  username: string;
  enabled: boolean;
  bandwidth_profile_id?: string | null;
  framed_ipv4_address?: string | null;
  framed_ipv6_address?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
  created_at: string;
  updated_at: string;
}

export default function RADIUSSubscribersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();

  // Fetch subscribers
  const { data: subscribers, isLoading } = useQuery<RADIUSSubscriber[]>({
    queryKey: ["radius-subscribers"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/subscribers", {
          params: { skip: 0, limit: 1000 },
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch RADIUS subscribers", { error });
        throw error;
      }
    },
  });

  // Enable subscriber mutation
  const enableMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiClient.post(`/radius/subscribers/${username}/enable`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-subscribers"] });
      toast({
        title: "Subscriber enabled",
        description: "The subscriber has been enabled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to enable subscriber",
        variant: "destructive",
      });
    },
  });

  // Disable subscriber mutation
  const disableMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiClient.post(`/radius/subscribers/${username}/disable`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-subscribers"] });
      toast({
        title: "Subscriber disabled",
        description: "The subscriber has been disabled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to disable subscriber",
        variant: "destructive",
      });
    },
  });

  // Delete subscriber mutation
  const deleteMutation = useMutation({
    mutationFn: async (username: string) => {
      await apiClient.delete(`/radius/subscribers/${username}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-subscribers"] });
      toast({
        title: "Subscriber deleted",
        description: "The subscriber has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete subscriber",
        variant: "destructive",
      });
    },
  });

  // Filter subscribers by search query
  const filteredSubscribers = subscribers?.filter(
    (sub) =>
      sub.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.subscriber_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.framed_ipv4_address?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleToggleStatus = (subscriber: RADIUSSubscriber) => {
    if (subscriber.enabled) {
      disableMutation.mutate(subscriber.username);
    } else {
      enableMutation.mutate(subscriber.username);
    }
  };

  const handleDelete = async (subscriber: RADIUSSubscriber) => {
    const confirmed = await confirmDialog({
      title: "Delete subscriber",
      description: `Are you sure you want to delete subscriber "${subscriber.username}"? This action cannot be undone.`,
      confirmText: "Delete subscriber",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(subscriber.username);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Subscribers</h1>
          <p className="text-muted-foreground">Manage RADIUS authentication credentials</p>
        </div>
        <Link href="/dashboard/radius/subscribers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Subscriber
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, subscriber ID, or IP address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading subscribers...</div>
          ) : filteredSubscribers && filteredSubscribers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Subscriber ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IPv4 Address</TableHead>
                  <TableHead>Bandwidth Profile</TableHead>
                  <TableHead>Session Timeout</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell className="font-medium">{subscriber.username}</TableCell>
                    <TableCell>{subscriber.subscriber_id}</TableCell>
                    <TableCell>
                      {subscriber.enabled ? (
                        <Badge variant="default" className="bg-green-500">
                          <Check className="mr-1 h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <X className="mr-1 h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {subscriber.framed_ipv4_address || (
                        <span className="text-muted-foreground">Dynamic</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {subscriber.bandwidth_profile_id || (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {subscriber.session_timeout ? (
                        `${Math.floor(subscriber.session_timeout / 60)}m`
                      ) : (
                        <span className="text-muted-foreground">Unlimited</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(subscriber.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Open actions menu">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link
                            href={`/dashboard/radius/subscribers/${encodeURIComponent(
                              subscriber.username,
                            )}/edit`}
                          >
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => handleToggleStatus(subscriber)}>
                            {subscriber.enabled ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              void handleDelete(subscriber);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No subscribers found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No subscribers match your search criteria."
                  : "Get started by adding your first RADIUS subscriber."}
              </p>
              <Link href="/dashboard/radius/subscribers/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subscriber
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
