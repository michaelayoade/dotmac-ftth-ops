"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { platformConfig } from "@/lib/config";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Edit,
  FileCode,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Package,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface JobTemplate {
  id: number;
  name: string;
  description: string | null;
  job_type: string | null;
  inventory: number | null;
  project: number | null;
  playbook: string | null;
}

interface Job {
  id: number;
  name: string;
  status: string;
  created: string;
  started: string | null;
  finished: string | null;
  elapsed: number | null;
}

function PlaybookDetailsPageContent() {
  const params = useParams();
  const router = useRouter();
  const templateId = params?.["id"] as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: template, isLoading } = useQuery<JobTemplate>({
    queryKey: ["ansible", "job-template", templateId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/ansible/job-templates/${templateId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Playbook template not found");
        }
        throw new Error("Failed to fetch playbook template");
      }
      return response.json();
    },
    enabled: !!templateId,
  });

  const { data: recentJobs = [] } = useQuery<Job[]>({
    queryKey: ["ansible", "jobs", "template", templateId],
    queryFn: async () => {
      // Fetch jobs filtered by this template
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/ansible/jobs?template_id=${templateId}&limit=10`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch recent jobs");
      }
      return response.json();
    },
    enabled: !!templateId,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ansible", "job-template", templateId] });
    queryClient.invalidateQueries({ queryKey: ["ansible", "jobs", "template", templateId] });
    toast({
      title: "Refreshed",
      description: "Playbook data has been refreshed",
    });
  };

  const getStatusBadge = (status: string) => {
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Playbook Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The playbook template you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/automation/playbooks">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Playbooks
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
            <Link href="/dashboard/automation/playbooks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">Playbook template configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowEditDialog(true)} variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button asChild>
            <Link href={`/dashboard/automation/playbooks/${templateId}/run`}>
              <Play className="h-4 w-4 mr-2" />
              Launch Playbook
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Name</p>
                  </div>
                  <p className="font-medium">{template.name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Job Type</p>
                  </div>
                  <p className="font-medium capitalize">{template.job_type || "-"}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Description</p>
                </div>
                <p className="text-sm">
                  {template.description || (
                    <span className="text-muted-foreground">No description provided</span>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Playbook Path</p>
                </div>
                <p className="text-sm font-mono bg-accent p-2 rounded">
                  {template.playbook || "-"}
                </p>
              </div>

              <div className="pt-4 border-t grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Inventory ID</p>
                  </div>
                  <p className="font-mono text-sm">{template.inventory || "-"}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Project ID</p>
                  </div>
                  <p className="font-mono text-sm">{template.project || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>Last 10 job executions for this playbook</CardDescription>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No executions found for this playbook</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">{job.id}</TableCell>
                        <TableCell>{job.name}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          {job.started ? (
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(job.started), {
                                addSuffix: true,
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(job.elapsed)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/automation/jobs/${job.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coming Soon</DialogTitle>
            <DialogDescription>
              Playbook editing through the UI is coming soon. For now, please edit playbooks
              directly via the AWX interface.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowEditDialog(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlaybookDetailsPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <PlaybookDetailsPageContent />
    </RouteGuard>
  );
}
