"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/use-toast";
import { NASDeviceDialog } from "@/components/radius/NASDeviceDialog";

interface NASDevice {
  id: number;
  tenant_id: string;
  nasname: string;
  shortname: string;
  type: string;
  ports?: number | null;
  secret_configured: boolean;
  server?: string | null;
  community?: string | null;
  description?: string | null;
}

export default function RADIUSNASPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedNAS, setSelectedNAS] = useState<NASDevice | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch NAS devices
  const { data: nasDevices, isLoading } = useQuery<NASDevice[]>({
    queryKey: ["radius-nas"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/nas", {
          params: { skip: 0, limit: 1000 },
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch NAS devices", { error });
        throw error;
      }
    },
  });

  // Delete NAS mutation
  const deleteMutation = useMutation({
    mutationFn: async (nasId: number) => {
      await apiClient.delete(`/radius/nas/${nasId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-nas"] });
      toast({
        title: "NAS device deleted",
        description: "The NAS device has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete NAS device",
        variant: "destructive",
      });
    },
  });

  // Filter NAS devices by search query
  const filteredNAS = nasDevices?.filter(
    (nas) =>
      nas.nasname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nas.shortname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nas.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (nas.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setSelectedNAS(null);
    setDialogOpen(true);
  };

  const handleEdit = (nas: NASDevice) => {
    setSelectedNAS(nas);
    setDialogOpen(true);
  };

  const handleDelete = (nas: NASDevice) => {
    if (
      confirm(
        `Are you sure you want to delete NAS device "${nas.shortname}"? This action cannot be undone.`
      )
    ) {
      deleteMutation.mutate(nas.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NAS Devices</h1>
          <p className="text-muted-foreground">
            Manage Network Access Servers (routers, OLTs, APs)
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add NAS Device
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NAS Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nasDevices?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Registered devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Types</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set((nasDevices ?? []).map((n) => n.type)).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ports</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nasDevices?.reduce((sum, n) => sum + (n.ports ?? 0), 0) ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Available ports</p>
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
                placeholder="Search by name, type, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NAS Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading NAS devices...
            </div>
          ) : filteredNAS && filteredNAS.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short Name</TableHead>
                  <TableHead>NAS Name (IP)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNAS.map((nas) => (
                  <TableRow key={nas.id}>
                    <TableCell className="font-medium">{nas.shortname}</TableCell>
                    <TableCell>{nas.nasname}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{nas.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {nas.ports ?? (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {nas.server ?? (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {nas.description ?? (
                        <span className="text-muted-foreground">No description</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Open actions menu">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(nas)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(nas)}
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
              <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No NAS devices found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No NAS devices match your search criteria."
                  : "Get started by adding your first NAS device."}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add NAS Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <NASDeviceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nasDevice={selectedNAS}
      />
    </div>
  );
}
