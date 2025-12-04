/**
 * Edit Template Modal
 *
 * Modal for editing existing notification templates.
 */

"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import type { CommunicationTemplate, TemplateUpdateRequest } from "@/hooks/useNotifications";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CommunicationTemplate;
  onSave: (data: TemplateUpdateRequest) => Promise<void>;
  onDelete: () => void;
}

export function EditTemplateModal({
  isOpen,
  onClose,
  template,
  onSave,
  onDelete,
}: EditTemplateModalProps) {
  const [formData, setFormData] = useState<TemplateUpdateRequest>({
    name: template.name,
    description: template.description,
    subject_template: template.subject_template,
    text_template: template.text_template,
    html_template: template.html_template,
    required_variables: template.required_variables,
    is_active: template.is_active,
  } as TemplateUpdateRequest);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newVariable, setNewVariable] = useState("");

  // Update form data when template changes
  useEffect(() => {
    setFormData({
      name: template.name,
      description: template.description,
      subject_template: template.subject_template,
      text_template: template.text_template,
      html_template: template.html_template,
      required_variables: template.required_variables,
      is_active: template.is_active,
    } as TemplateUpdateRequest);
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSave(formData);
    } catch (err) {
      console.error("Failed to update template:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVariable = () => {
    if (newVariable && !formData.required_variables?.includes(newVariable)) {
      setFormData({
        ...formData,
        required_variables: [...(formData.required_variables || []), newVariable],
      });
      setNewVariable("");
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setFormData({
      ...formData,
      required_variables: formData.required_variables?.filter((v) => v !== variable) || [],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template: {template.name}</DialogTitle>
          <DialogDescription>Update template content and settings</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., invoice_overdue_reminder"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Reminder sent when invoice is overdue"
            />
          </div>

          {/* Type (read-only) */}
          <div className="space-y-2">
            <Label>Communication Type</Label>
            <div className="rounded-md border border-input bg-muted px-3 py-2">
              <Badge>{template.type.toUpperCase()}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Template type cannot be changed after creation
            </p>
          </div>

          {/* Subject (Email only) */}
          {template.type === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject_template || ""}
                onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                placeholder="e.g., Invoice {{invoice_number}} is Overdue"
              />
              <p className="text-xs text-muted-foreground">
                Use {`{{variable_name}}`} for dynamic content
              </p>
            </div>
          )}

          {/* Text Body */}
          <div className="space-y-2">
            <Label htmlFor="text_template">
              {template.type === "sms" ? "SMS Message" : "Plain Text Body"}
            </Label>
            <Textarea
              id="text_template"
              value={formData.text_template || ""}
              onChange={(e) => setFormData({ ...formData, text_template: e.target.value })}
              placeholder="Plain text version of your message..."
              rows={6}
            />
            {template.type === "sms" && (
              <p className="text-xs text-muted-foreground">
                Current length: {(formData.text_template || "").length} characters
              </p>
            )}
          </div>

          {/* HTML Body (Email only) */}
          {template.type === "email" && (
            <div className="space-y-2">
              <Label htmlFor="html_template">HTML Body</Label>
              <Textarea
                id="html_template"
                value={formData.html_template || ""}
                onChange={(e) => setFormData({ ...formData, html_template: e.target.value })}
                placeholder="<h1>Hello {{customer_name}}</h1><p>Your invoice...</p>"
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Required Variables */}
          <div className="space-y-2">
            <Label>Required Variables</Label>
            <div className="flex gap-2">
              <Input
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                placeholder="e.g., customer_name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddVariable();
                  }
                }}
              />
              <Button type="button" onClick={handleAddVariable} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.required_variables?.map((variable) => (
                <Badge key={variable} variant="secondary">
                  {`{{${variable}}}`}
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(variable)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active
                  ? "Template is active and can be used"
                  : "Template is inactive and cannot be used"}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          {/* Usage Stats */}
          <div className="rounded-lg border bg-muted p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Usage Count</p>
                <p className="text-2xl font-bold">{template.usage_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Variables Detected</p>
                <p className="text-2xl font-bold">{template.variables.length}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="destructive" onClick={onDelete} disabled={isSubmitting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Template
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
