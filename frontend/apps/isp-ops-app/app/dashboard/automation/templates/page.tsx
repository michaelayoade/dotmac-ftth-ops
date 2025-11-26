"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  FileCode,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Play,
  TrendingUp,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useConfirmDialog } from "@dotmac/ui";

interface DeploymentTemplate {
  id: number;
  name: string;
  description: string;
  backend: string;
  deployment_type: string;
  version: string;
  is_active: boolean;
  configuration: Record<string, any>;
  created_at: string;
  updated_at: string;
}

function TemplatesPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [backendFilter, setBackendFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch templates
  const {
    data: templates = [],
    isLoading,
    refetch,
  } = useQuery<DeploymentTemplate[]>({
    queryKey: ["deployment-templates"],
    queryFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/templates`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/deployment/templates/${templateId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBackend = backendFilter === "all" || template.backend === backendFilter;

    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && template.is_active) ||
      (activeFilter === "inactive" && !template.is_active);

    return matchesSearch && matchesBackend && matchesActive;
  });

  const stats = {
    total: templates.length,
    active: templates.filter((t) => t.is_active).length,
    byBackend: templates.reduce(
      (acc, t) => {
        acc[t.backend] = (acc[t.backend] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  const getBackendBadge = (backend: string) => {
    const badges = {
      AWX_ANSIBLE: { label: "Ansible", color: "bg-red-100 text-red-800" },
      KUBERNETES: { label: "Kubernetes", color: "bg-blue-100 text-blue-800" },
      DOCKER_COMPOSE: { label: "Docker", color: "bg-cyan-100 text-cyan-800" },
    };
    const config = badges[backend as keyof typeof badges] || {
      label: backend,
      color: "bg-gray-100 text-gray-800",
    };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployment Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage automation templates for infrastructure deployment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/automation/templates/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Ready to deploy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ansible Templates</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byBackend["AWX_ANSIBLE"] || 0}</div>
            <p className="text-xs text-muted-foreground">AWX/Ansible Tower</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Kubernetes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byBackend["KUBERNETES"] || 0}</div>
            <p className="text-xs text-muted-foreground">K8s templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={backendFilter} onValueChange={setBackendFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Backends" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backends</SelectItem>
                <SelectItem value="AWX_ANSIBLE">Ansible/AWX</SelectItem>
                <SelectItem value="KUBERNETES">Kubernetes</SelectItem>
                <SelectItem value="DOCKER_COMPOSE">Docker Compose</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading templates...
            </CardContent>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No templates match your search" : "No templates found"}
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileCode className="h-8 w-8 text-primary" />
                  <div className="flex flex-col gap-1 items-end">
                    {getBackendBadge(template.backend)}
                    <Badge
                      className={
                        template.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {template.is_active ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="mt-2">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {template.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{template.deployment_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">{template.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="text-xs">
                      {new Date(template.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/automation/templates/${template.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!template.is_active}
                    asChild={template.is_active}
                  >
                    <Link href={`/dashboard/automation/deploy?template=${template.id}`}>
                      <Play className="h-3 w-3 mr-1" />
                      Deploy
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      (async () => {
                        const confirmed = await confirmDialog({
                          title: "Delete template",
                          description: `Delete template "${template.name}"?`,
                          confirmText: "Delete template",
                          variant: "destructive",
                        });
                        if (!confirmed) {
                          return;
                        }
                        deleteMutation.mutate(template.id);
                      })();
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <RouteGuard permission="deployment.template.read">
      <TemplatesPageContent />
    </RouteGuard>
  );
}
