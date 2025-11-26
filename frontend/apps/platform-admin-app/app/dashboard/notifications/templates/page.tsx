/**
 * Notification Templates Management Page
 *
 * Admin page for creating, editing, and managing communication templates
 * for email, SMS, and other notification channels.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Copy, Edit, Eye, Plus, Trash2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotificationTemplates } from "@/hooks/useNotifications";
import type { CommunicationTemplate, TemplateCreateRequest } from "@/hooks/useNotifications";
import { EnhancedDataTable, type ColumnDef, type BulkAction, type QuickFilter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { formatDistanceToNow } from "date-fns";
import { CreateTemplateModal } from "@/components/notifications/CreateTemplateModal";
import { EditTemplateModal } from "@/components/notifications/EditTemplateModal";
import { PreviewTemplateModal } from "@/components/notifications/PreviewTemplateModal";
import { useConfirmDialog } from "@dotmac/ui";

const createBulkIcon = (Icon: LucideIcon) => {
  const Wrapped = ({ className }: { className?: string }) => <Icon className={className} />;
  Wrapped.displayName = `BulkIcon(${Icon.displayName ?? Icon.name ?? "Icon"})`;
  return Wrapped;
};

const ActivateIcon = createBulkIcon(CheckCircle2);
const DeactivateIcon = createBulkIcon(XCircle);
const DeleteIcon = createBulkIcon(Trash2);

export default function NotificationTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const confirmDialog = useConfirmDialog();

  const { hasPermission } = useRBAC();
  const canWrite = hasPermission("notifications.write") || hasPermission("admin");

  const { templates, isLoading, error, refetch, createTemplate, updateTemplate, deleteTemplate } =
    useNotificationTemplates();

  // Statistics
  const stats = useMemo(() => {
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter((t) => t.is_active).length;
    const emailTemplates = templates.filter((t) => t.type === "email").length;
    const smsTemplates = templates.filter((t) => t.type === "sms").length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usage_count, 0);

    return {
      totalTemplates,
      activeTemplates,
      emailTemplates,
      smsTemplates,
      totalUsage,
    };
  }, [templates]);

  const handleEdit = useCallback(
    (template: CommunicationTemplate) => {
      setSelectedTemplate(template);
      setIsEditModalOpen(true);
    },
    [setIsEditModalOpen, setSelectedTemplate],
  );

  const handlePreview = useCallback(
    (template: CommunicationTemplate) => {
      setSelectedTemplate(template);
      setIsPreviewModalOpen(true);
    },
    [setIsPreviewModalOpen, setSelectedTemplate],
  );

  const handleDuplicate = useCallback(
    async (template: CommunicationTemplate) => {
      try {
        await createTemplate({
          name: `${template.name} (Copy)`,
          ...(template.description && { description: template.description }),
          type: template.type,
          ...(template.subject_template && { subject_template: template.subject_template }),
          ...(template.text_template && { text_template: template.text_template }),
          ...(template.html_template && { html_template: template.html_template }),
          ...(template.required_variables && { required_variables: template.required_variables }),
        });
        refetch();
      } catch (err) {
        console.error("Failed to duplicate template:", err);
        // eslint-disable-next-line no-alert
        alert("Failed to duplicate template. Please try again.");
      }
    },
    [createTemplate, refetch],
  );

  const handleDelete = useCallback(
    async (template: CommunicationTemplate) => {
      const confirmed = await confirmDialog({
        title: "Delete template",
        description: `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
        confirmText: "Delete",
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await deleteTemplate(template.id);
        refetch();
      } catch (err) {
        console.error("Failed to delete template:", err);
        // eslint-disable-next-line no-alert
        alert("Failed to delete template. Please try again.");
      }
    },
    [deleteTemplate, refetch, confirmDialog],
  );

  // Columns definition
  const columns: ColumnDef<CommunicationTemplate>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Template Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => {
          const typeColors = {
            email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            sms: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            webhook: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
            push: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
          };

          return (
            <Badge className={typeColors[row.original.type]}>
              {row.original.type.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        id: "variables",
        header: "Variables",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.variables.slice(0, 3).map((variable) => (
              <Badge key={variable} variant="outline" className="text-xs">
                {`{{${variable}}}`}
              </Badge>
            ))}
            {row.original.variables.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{row.original.variables.length - 3}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "usage",
        header: "Usage",
        accessorKey: "usage_count",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.usage_count.toLocaleString()}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "is_active",
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <XCircle className="mr-1 h-3 w-3" />
              Inactive
            </Badge>
          ),
      },
      {
        id: "updated",
        header: "Last Updated",
        accessorKey: "updated_at",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.updated_at), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreview(row.original)}
              title="Preview template"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canWrite && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(row.original)}
                  title="Edit template"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicate(row.original)}
                  title="Duplicate template"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [canWrite, handleDuplicate, handleEdit, handlePreview],
  );

  // Bulk actions
  const bulkActions: BulkAction<CommunicationTemplate>[] = useMemo(
    () => [
      {
        label: "Activate Templates",
        icon: ActivateIcon,
        action: async (selected) => {
          for (const template of selected) {
            if (!template.is_active) {
              await updateTemplate(template.id, { is_active: true });
            }
          }
          refetch();
        },
        variant: "default",
      },
      {
        label: "Deactivate Templates",
        icon: DeactivateIcon,
        action: async (selected) => {
          for (const template of selected) {
            if (template.is_active) {
              await updateTemplate(template.id, { is_active: false });
            }
          }
          refetch();
        },
        variant: "outline",
      },
      {
        label: "Delete Templates",
        icon: DeleteIcon,
        action: async (selected) => {
          const confirmed = await confirmDialog({
            title: "Delete templates",
            description: `Are you sure you want to delete ${selected.length} template(s)? This action cannot be undone.`,
            confirmText: "Delete templates",
            variant: "destructive",
          });
          if (!confirmed) {
            return;
          }
          for (const template of selected) {
            await deleteTemplate(template.id);
          }
          refetch();
        },
        variant: "destructive",
      },
    ],
    [updateTemplate, deleteTemplate, refetch, confirmDialog],
  );

  // Quick filters
  const quickFilters: QuickFilter<CommunicationTemplate>[] = useMemo(
    () => [
      {
        label: "Active",
        filter: (template: CommunicationTemplate) => template.is_active,
      },
      {
        label: "Inactive",
        filter: (template: CommunicationTemplate) => !template.is_active,
      },
      {
        label: "Email",
        filter: (template: CommunicationTemplate) => template.type === "email",
      },
      {
        label: "SMS",
        filter: (template: CommunicationTemplate) => template.type === "sms",
      },
      {
        label: "High Usage",
        filter: (template: CommunicationTemplate) => template.usage_count > 100,
      },
    ],
    [],
  );

  // Handlers
  const handleCreate = async (data: TemplateCreateRequest) => {
    try {
      await createTemplate(data);
      setIsCreateModalOpen(false);
      refetch();
    } catch (err) {
      console.error("Failed to create template:", err);
      // eslint-disable-next-line no-alert
      alert("Failed to create template. Please try again.");
    }
  };

  // Permission check
  if (!hasPermission("notifications.read") && !hasPermission("admin")) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don&apos;t have permission to view notification templates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Templates</h1>
          <p className="text-muted-foreground">
            Create and manage templates for email, SMS, and other communication channels
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalTemplates}
            </div>
            <p className="text-xs text-muted-foreground">All communication templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.activeTemplates}
            </div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.emailTemplates}
            </div>
            <p className="text-xs text-muted-foreground">Email communication</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.smsTemplates}
            </div>
            <p className="text-xs text-muted-foreground">SMS communication</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalUsage.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Times sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Manage your notification templates</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                Failed to load templates. Please try again.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  refetch().catch(() => {});
                }}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {!error && (
            <EnhancedDataTable
              data={templates}
              columns={columns}
              searchKey="name"
              searchPlaceholder="Search templates..."
              bulkActions={canWrite ? bulkActions : []}
              quickFilters={quickFilters}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTemplateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {isEditModalOpen && selectedTemplate && (
        <EditTemplateModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          onSave={async (data) => {
            await updateTemplate(selectedTemplate.id, data);
            setIsEditModalOpen(false);
            setSelectedTemplate(null);
            refetch();
          }}
          onDelete={() => {
            handleDelete(selectedTemplate);
            setIsEditModalOpen(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {isPreviewModalOpen && selectedTemplate && (
        <PreviewTemplateModal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
        />
      )}
    </div>
  );
}
