"use client";

/**
 * Template Management List Page
 *
 * View and manage all communication templates.
 */

import { useState } from "react";
import Link from "next/link";
import { useTemplates, useDeleteTemplate } from "@/hooks/useCommunications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  FileText,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Mail,
  MessageSquare,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { CommunicationChannel, type ListTemplatesParams, getTimeAgo } from "@/types/communications";

export default function TemplatesPage() {
  const { toast } = useToast();
  const deleteTemplate = useDeleteTemplate();
  const confirmDialog = useConfirmDialog();

  const [filters, setFilters] = useState<ListTemplatesParams>({
    page: 1,
    page_size: 20,
  });

  const { data, isLoading, error } = useTemplates(filters);

  const handleFilterChange = (key: keyof ListTemplatesParams, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: "Delete template",
      description: `Are you sure you want to delete template "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    deleteTemplate.mutate(id, {
      onSuccess: () => {
        toast({
          title: "Template Deleted",
          description: `Template "${name}" has been deleted`,
        });
      },
      onError: (error: any) => {
        toast({
          title: "Delete Failed",
          description: error.response?.data?.detail || "Failed to delete template",
          variant: "destructive",
        });
      },
    });
  };

  const getChannelIcon = (channel: CommunicationChannel) => {
    switch (channel) {
      case CommunicationChannel.EMAIL:
        return <Mail className="h-4 w-4" />;
      case CommunicationChannel.SMS:
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load templates</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable communication templates
          </p>
        </div>
        <Link href="/dashboard/communications/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={filters.search || ""}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Channel Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <Select
                value={filters.channel || "all"}
                onValueChange={(value) =>
                  handleFilterChange("channel", value === "all" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value={CommunicationChannel.EMAIL}>Email</SelectItem>
                  <SelectItem value={CommunicationChannel.SMS}>SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={
                  filters.is_active === undefined
                    ? "all"
                    : filters.is_active
                      ? "active"
                      : "inactive"
                }
                onValueChange={(value) =>
                  handleFilterChange("is_active", value === "all" ? undefined : value === "active")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data && data.templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getChannelIcon(template.channel)}
                      <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                    </div>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Subject Preview */}
                {template.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Subject</p>
                    <p className="text-sm font-medium line-clamp-1">{template.subject}</p>
                  </div>
                )}

                {/* Variables */}
                {template.variables && template.variables.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 5).map((variable) => (
                        <Badge key={variable.name} variant="outline" className="text-xs">
                          {variable.name}
                        </Badge>
                      ))}
                      {template.variables.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Used {template.usage_count} times</span>
                  {template.last_used_at && <span>{getTimeAgo(template.last_used_at)}</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/dashboard/communications/templates/${template.id}`}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/dashboard/communications/templates/${template.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id, template.name)}
                    disabled={deleteTemplate.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4 text-center">
              {filters.search || filters.channel || filters.is_active !== undefined
                ? "Try adjusting your filters"
                : "Create your first template to get started"}
            </p>
            <Link href="/dashboard/communications/templates/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(data.page - 1) * data.page_size + 1} to{" "}
            {Math.min(data.page * data.page_size, data.total)} of {data.total} templates
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page === 1}
              onClick={() => handleFilterChange("page", data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page * data.page_size >= data.total}
              onClick={() => handleFilterChange("page", data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
