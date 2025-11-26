"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { platformConfig } from "@/lib/config";
import {
  RefreshCw,
  Plus,
  Play,
  FileCode,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface JobTemplate {
  id: number;
  name: string;
  description: string | null;
  job_type: string | null;
  inventory: number | null;
  project: number | null;
  playbook: string | null;
  last_job_run?: string | null;
  last_job_status?: string | null;
}

interface JobStats {
  total_templates: number;
  recent_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
}

function PlaybooksPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showComingSoon, setShowComingSoon] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<JobTemplate[]>({
    queryKey: ["ansible", "job-templates"],
    queryFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/job-templates`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch job templates");
      }
      return response.json();
    },
  });

  const { data: stats } = useQuery<JobStats>({
    queryKey: ["ansible", "stats"],
    queryFn: async () => {
      // Note: This endpoint may not exist yet, returning mock data if it fails
      try {
        const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/stats`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Stats not available");
        }
        return response.json();
      } catch (error) {
        // Return calculated stats from templates
        return {
          total_templates: templates.length,
          recent_jobs: 0,
          successful_jobs: 0,
          failed_jobs: 0,
        };
      }
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ansible"] });
    toast({
      title: "Refreshed",
      description: "Playbook data has been refreshed",
    });
  };

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(search) ||
      ((template["description"] ?? "").toLowerCase().includes(search) ?? false) ||
      ((template.playbook ?? "").toLowerCase().includes(search) ?? false)
    );
  });

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;

    const statusConfig = {
      successful: { variant: "outline" as const, color: "text-green-600", icon: CheckCircle },
      failed: { variant: "destructive" as const, color: "text-red-600", icon: XCircle },
      running: { variant: "default" as const, color: "text-blue-600", icon: Activity },
      pending: { variant: "secondary" as const, color: "text-yellow-600", icon: Clock },
      canceled: { variant: "secondary" as const, color: "text-gray-600", icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playbooks</h1>
          <p className="text-muted-foreground">Manage and execute Ansible playbooks via AWX</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={templatesLoading}>
            <RefreshCw className={`h-4 w-4 ${templatesLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowComingSoon(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Playbook
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Playbooks</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_templates ?? templates.length}</div>
            <p className="text-xs text-muted-foreground">Available templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recent_jobs ?? 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Jobs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successful_jobs ?? 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed_jobs ?? 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search playbooks by name, description, or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Playbooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Playbooks</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No playbooks match your search" : "No playbooks found"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Playbook Path</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-xs truncate">
                        {template.description || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{template.playbook || "-"}</div>
                    </TableCell>
                    <TableCell>
                      {template.last_job_run ? (
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(template.last_job_run), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(template.last_job_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/automation/playbooks/${template.id}`}>View</Link>
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/dashboard/automation/playbooks/${template.id}/run`}>
                            <Play className="h-3 w-3 mr-1" />
                            Launch
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Coming Soon Dialog */}
      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coming Soon</DialogTitle>
            <DialogDescription>
              Playbook creation through the UI is coming soon. For now, please manage playbooks
              directly via the AWX interface.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowComingSoon(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlaybooksPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <PlaybooksPageContent />
    </RouteGuard>
  );
}
