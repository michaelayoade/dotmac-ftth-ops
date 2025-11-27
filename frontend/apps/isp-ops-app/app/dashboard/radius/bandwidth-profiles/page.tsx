"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Gauge,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Upload,
  Zap,
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
import { BandwidthProfileDialog } from "@/components/radius/BandwidthProfileDialog";

interface BandwidthProfile {
  id: string;
  tenant_id: string;
  name: string;
  download_rate: number;
  upload_rate: number;
  download_burst?: number | null;
  upload_burst?: number | null;
  created_at?: string;
  updated_at?: string;
}

export default function BandwidthProfilesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<BandwidthProfile | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();

  // Fetch bandwidth profiles
  const { data: profiles, isLoading } = useQuery<BandwidthProfile[]>({
    queryKey: ["bandwidth-profiles"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/bandwidth-profiles", {
          params: { skip: 0, limit: 1000 },
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch bandwidth profiles", { error });
        throw error;
      }
    },
  });

  // Delete profile mutation
  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiClient.delete(`/radius/bandwidth-profiles/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bandwidth-profiles"] });
      toast({
        title: "Profile deleted",
        description: "The bandwidth profile has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete bandwidth profile",
        variant: "destructive",
      });
    },
  });

  // Filter profiles by search query
  const filteredProfiles = profiles?.filter((profile) =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDelete = async (profile: BandwidthProfile) => {
    const confirmed = await confirmDialog({
      title: "Delete bandwidth profile",
      description: `Are you sure you want to delete bandwidth profile "${profile.name}"? This may affect subscribers using this profile.`,
      confirmText: "Delete profile",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(profile.id);
  };

  const handleCreate = () => {
    setSelectedProfile(null);
    setDialogOpen(true);
  };

  const handleEdit = (profile: BandwidthProfile) => {
    setSelectedProfile(profile);
    setDialogOpen(true);
  };

  const formatRate = (kbps: number) => {
    if (kbps >= 1024 * 1024) {
      return `${(kbps / (1024 * 1024)).toFixed(2)} Gbps`;
    } else if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(2)} Mbps`;
    } else {
      return `${kbps} Kbps`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bandwidth Profiles</h1>
          <p className="text-muted-foreground">
            Manage bandwidth rate limits for RADIUS subscribers
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Available profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Download</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles && profiles.length > 0
                ? formatRate(Math.max(...profiles.map((p) => p.download_rate)))
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Maximum speed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Upload</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profiles && profiles.length > 0
                ? formatRate(Math.max(...profiles.map((p) => p.upload_rate)))
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Maximum speed</p>
          </CardContent>
        </Card>
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
                placeholder="Search by profile name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profiles Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading bandwidth profiles...
            </div>
          ) : filteredProfiles && filteredProfiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile Name</TableHead>
                  <TableHead>Download Rate</TableHead>
                  <TableHead>Upload Rate</TableHead>
                  <TableHead>Download Burst</TableHead>
                  <TableHead>Upload Burst</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        {profile.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{formatRate(profile.download_rate)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Upload className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{formatRate(profile.upload_rate)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile.download_burst ? (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="secondary">{formatRate(profile.download_burst)}</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.upload_burst ? (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="secondary">{formatRate(profile.upload_burst)}</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(profile)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              void handleDelete(profile);
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
              <Gauge className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bandwidth profiles found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No profiles match your search criteria."
                  : "Get started by creating your first bandwidth profile."}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bandwidth Profile Dialog */}
      <BandwidthProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={selectedProfile}
      />
    </div>
  );
}
