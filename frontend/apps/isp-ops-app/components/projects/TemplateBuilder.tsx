"use client";

/**
 * Template Builder Component
 * Visual template designer for creating project templates with strict TypeScript
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Plus, Trash2, Save, Eye, Copy, Settings, GripVertical } from "lucide-react";
import type {
  ProjectTemplate,
  TaskTemplate,
  KanbanColumn,
  CreateTemplateData,
} from "@/types/project-management";
import {
  TaskType,
  TaskPriority,
  TaskStatus,
  TeamRole,
  TemplateCategory,
} from "@/types/project-management";
import { useCreateTemplate } from "@/hooks/useProjects";

// ============================================================================
// Types
// ============================================================================

interface TemplateBuilderProps {
  initialTemplate?: Partial<ProjectTemplate>;
  onSave?: (template: ProjectTemplate) => void;
  onCancel?: () => void;
}

interface TaskTemplateFormProps {
  task: TaskTemplate;
  columns: KanbanColumn[];
  onUpdate: (task: TaskTemplate) => void;
  onDelete: () => void;
}

interface ColumnFormProps {
  column: KanbanColumn;
  onUpdate: (column: KanbanColumn) => void;
  onDelete: () => void;
}

// ============================================================================
// Task Template Form Component
// ============================================================================

function TaskTemplateForm({ task, columns, onUpdate, onDelete }: TaskTemplateFormProps) {
  const taskTypes: TaskType[] = [
    TaskType.TASK,
    TaskType.BUG,
    TaskType.FEATURE,
    TaskType.IMPROVEMENT,
    TaskType.RESEARCH,
    TaskType.DOCUMENTATION,
  ];
  const priorities: TaskPriority[] = [
    TaskPriority.LOW,
    TaskPriority.MEDIUM,
    TaskPriority.HIGH,
    TaskPriority.CRITICAL,
  ];
  const roles: TeamRole[] = [
    TeamRole.OWNER,
    TeamRole.ADMIN,
    TeamRole.MANAGER,
    TeamRole.MEMBER,
    TeamRole.VIEWER,
  ];

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="cursor-move mt-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`task-title-${task.id}`}>Task Title</Label>
                <Input
                  id={`task-title-${task.id}`}
                  value={task.title}
                  onChange={(e) => onUpdate({ ...task, title: e.target.value })}
                  placeholder="Enter task title..."
                />
              </div>

              <div>
                <Label htmlFor={`task-type-${task.id}`}>Type</Label>
                <Select
                  value={task.type}
                  onValueChange={(value) => onUpdate({ ...task, type: value as TaskType })}
                >
                  <SelectTrigger id={`task-type-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor={`task-desc-${task.id}`}>Description</Label>
              <Textarea
                id={`task-desc-${task.id}`}
                value={task.description}
                onChange={(e) => onUpdate({ ...task, description: e.target.value })}
                placeholder="Task description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor={`task-priority-${task.id}`}>Priority</Label>
                <Select
                  value={task.priority}
                  onValueChange={(value) => onUpdate({ ...task, priority: value as TaskPriority })}
                >
                  <SelectTrigger id={`task-priority-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={`task-column-${task.id}`}>Column</Label>
                <Select
                  value={task.columnId}
                  onValueChange={(value) => onUpdate({ ...task, columnId: value })}
                >
                  <SelectTrigger id={`task-column-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={`task-hours-${task.id}`}>Est. Hours</Label>
                <Input
                  id={`task-hours-${task.id}`}
                  type="number"
                  value={task.estimatedHours || ""}
                  onChange={(e) =>
                    onUpdate({ ...task, estimatedHours: parseInt(e.target.value) || undefined })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor={`task-days-${task.id}`}>Days from Start</Label>
                <Input
                  id={`task-days-${task.id}`}
                  type="number"
                  value={task.daysFromStart || ""}
                  onChange={(e) =>
                    onUpdate({ ...task, daysFromStart: parseInt(e.target.value) || undefined })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`task-role-${task.id}`}>Assign to Role</Label>
              <Select
                value={task.assignToRole || ""}
                onValueChange={(value) =>
                  onUpdate({ ...task, assignToRole: (value as TeamRole) || undefined })
                }
              >
                <SelectTrigger id={`task-role-${task.id}`}>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Column Form Component
// ============================================================================

function ColumnForm({ column, onUpdate, onDelete }: ColumnFormProps) {
  const statuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
    TaskStatus.BLOCKED,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ];

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="cursor-move mt-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor={`col-name-${column.id}`}>Column Name</Label>
              <Input
                id={`col-name-${column.id}`}
                value={column.name}
                onChange={(e) => onUpdate({ ...column, name: e.target.value })}
                placeholder="Column name..."
              />
            </div>

            <div>
              <Label htmlFor={`col-status-${column.id}`}>Status</Label>
              <Select
                value={column.status}
                onValueChange={(value) => onUpdate({ ...column, status: value as TaskStatus })}
              >
                <SelectTrigger id={`col-status-${column.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor={`col-wip-${column.id}`}>WIP Limit</Label>
              <Input
                id={`col-wip-${column.id}`}
                type="number"
                value={column.wipLimit || ""}
                onChange={(e) =>
                  onUpdate({ ...column, wipLimit: parseInt(e.target.value) || undefined })
                }
                placeholder="No limit"
              />
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Template Builder Component
// ============================================================================

export function TemplateBuilder({ initialTemplate, onSave, onCancel }: TemplateBuilderProps) {
  const [template, setTemplate] = useState<Partial<ProjectTemplate>>({
    name: initialTemplate?.name || "",
    description: initialTemplate?.description || "",
    category: initialTemplate?.category || TemplateCategory.CUSTOM,
    taskTemplates: initialTemplate?.taskTemplates || [],
    columns: initialTemplate?.columns || [
      { id: "col-1", name: "To Do", status: TaskStatus.TODO, position: 0, tasks: [] },
      { id: "col-2", name: "In Progress", status: TaskStatus.IN_PROGRESS, position: 1, tasks: [] },
      { id: "col-3", name: "Done", status: TaskStatus.DONE, position: 2, tasks: [] },
    ],
    isPublic: initialTemplate?.isPublic || false,
    tags: initialTemplate?.tags || [],
    defaultDuration: initialTemplate?.defaultDuration,
    estimatedHours: initialTemplate?.estimatedHours,
  });

  const [showPreview, setShowPreview] = useState(false);
  const { mutate: createTemplate, isPending } = useCreateTemplate();

  const categories: TemplateCategory[] = [
    TemplateCategory.SOFTWARE_DEVELOPMENT,
    TemplateCategory.MARKETING,
    TemplateCategory.SALES,
    TemplateCategory.OPERATIONS,
    TemplateCategory.HR,
    TemplateCategory.CUSTOM,
  ];

  const handleAddTask = () => {
    const newTask: TaskTemplate = {
      id: `task-${Date.now()}`,
      title: "New Task",
      description: "",
      type: TaskType.TASK,
      priority: TaskPriority.MEDIUM,
      position: template.taskTemplates?.length || 0,
      columnId: template.columns?.[0]?.id || "col-1",
      dependencies: [],
    };

    setTemplate({
      ...template,
      taskTemplates: [...(template.taskTemplates || []), newTask],
    });
  };

  const handleUpdateTask = (taskId: string, updatedTask: TaskTemplate) => {
    setTemplate({
      ...template,
      taskTemplates: (template.taskTemplates ?? []).map((t) => (t.id === taskId ? updatedTask : t)),
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTemplate({
      ...template,
      taskTemplates: (template.taskTemplates ?? []).filter((t) => t.id !== taskId),
    });
  };

  const handleAddColumn = () => {
    const newColumn: KanbanColumn = {
      id: `col-${Date.now()}`,
      name: "New Column",
      status: TaskStatus.TODO,
      position: template.columns?.length || 0,
      tasks: [],
    };

    setTemplate({
      ...template,
      columns: [...(template.columns || []), newColumn],
    });
  };

  const handleUpdateColumn = (columnId: string, updatedColumn: KanbanColumn) => {
    setTemplate({
      ...template,
      columns: (template.columns ?? []).map((c) => (c.id === columnId ? updatedColumn : c)),
    });
  };

  const handleDeleteColumn = (columnId: string) => {
    setTemplate({
      ...template,
      columns: (template.columns ?? []).filter((c) => c.id !== columnId),
    });
  };

  const handleSave = () => {
    if (!template.name || !template.category) {
      alert("Please fill in all required fields");
      return;
    }

    const templateData: CreateTemplateData = {
      name: template.name,
      description: template.description || "",
      category: template.category,
      taskTemplates: template.taskTemplates || [],
      columns: template.columns || [],
      isPublic: template.isPublic || false,
      tags: template.tags || [],
    };

    if (template.defaultDuration !== undefined) {
      templateData.defaultDuration = template.defaultDuration;
    }
    if (template.estimatedHours !== undefined) {
      templateData.estimatedHours = template.estimatedHours;
    }

    createTemplate(templateData, {
      onSuccess: (data) => {
        if (onSave) onSave(data);
      },
    });
  };

  const totalEstimatedHours =
    template.taskTemplates?.reduce((sum, task) => sum + (task.estimatedHours || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create reusable project templates with pre-configured tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Edit" : "Preview"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Template Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder="e.g., Website Redesign, Product Launch..."
              />
            </div>

            <div>
              <Label htmlFor="template-category">Category *</Label>
              <Select
                value={template.category || ""}
                onValueChange={(value) =>
                  setTemplate({ ...template, category: value as TemplateCategory })
                }
              >
                <SelectTrigger id="template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={template.description}
              onChange={(e) => setTemplate({ ...template, description: e.target.value })}
              placeholder="Describe what this template is for..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="template-duration">Default Duration (days)</Label>
              <Input
                id="template-duration"
                type="number"
                value={template.defaultDuration || ""}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    defaultDuration: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder="30"
              />
            </div>

            <div>
              <Label htmlFor="template-hours">Estimated Hours</Label>
              <Input
                id="template-hours"
                type="number"
                value={template.estimatedHours || totalEstimatedHours}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    estimatedHours: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder={totalEstimatedHours.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-calculated: {totalEstimatedHours}h
              </p>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.isPublic}
                  onChange={(e) => setTemplate({ ...template, isPublic: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Make template public</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Columns Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Kanban Columns</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {template.columns && template.columns.length > 0 ? (
            template.columns.map((column) => (
              <ColumnForm
                key={column.id}
                column={column}
                onUpdate={(updated) => handleUpdateColumn(column.id, updated)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No columns defined. Add columns to organize your tasks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Task Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Templates</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {template.taskTemplates?.length || 0} tasks · {totalEstimatedHours}h estimated
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddTask}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {template.taskTemplates && template.taskTemplates.length > 0 ? (
            template.taskTemplates.map((task) => (
              <TaskTemplateForm
                key={task.id}
                task={task}
                columns={template.columns || []}
                onUpdate={(updated) => handleUpdateTask(task.id, updated)}
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No tasks defined yet.</p>
              <Button onClick={handleAddTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Task
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Mode */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{template.name || "Untitled Template"}</h3>
                <p className="text-muted-foreground">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <Badge>{template.category?.replace("_", " ")}</Badge>
                  {template.isPublic && <Badge variant="outline">Public</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold">{template.defaultDuration || "N/A"} days</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks</p>
                  <p className="font-semibold">{template.taskTemplates?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Hours</p>
                  <p className="font-semibold">{totalEstimatedHours}h</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Columns</h4>
                <div className="flex gap-2 flex-wrap">
                  {template.columns?.map((col) => (
                    <Badge key={col.id} variant="outline">
                      {col.name}
                      {col.wipLimit && ` (WIP: ${col.wipLimit})`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Tasks Breakdown</h4>
                <div className="space-y-2">
                  {template.taskTemplates?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{task.type}</Badge>
                        <Badge variant="outline">{task.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
