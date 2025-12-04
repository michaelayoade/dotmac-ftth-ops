/**
 * Create Template Modal
 *
 * Modal for creating new notification templates with form validation.
 */

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { TemplateCreateRequest, CommunicationType } from "@/hooks/useNotifications";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: TemplateCreateRequest) => Promise<void>;
}

export function CreateTemplateModal({ isOpen, onClose, onCreate }: CreateTemplateModalProps) {
  const [formData, setFormData] = useState<TemplateCreateRequest>({
    name: "",
    description: "",
    type: "email",
    subject_template: "",
    text_template: "",
    html_template: "",
    required_variables: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newVariable, setNewVariable] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onCreate(formData);
      // Reset form
      setFormData({
        name: "",
        description: "",
        type: "email",
        subject_template: "",
        text_template: "",
        html_template: "",
        required_variables: [],
      });
    } catch (err) {
      console.error("Failed to create template:", err);
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
          <DialogTitle>Create Notification Template</DialogTitle>
          <DialogDescription>
            Create a new template for email, SMS, or other communication channels
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., invoice_overdue_reminder"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use a unique, descriptive name (lowercase with underscores)
            </p>
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

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Communication Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: CommunicationType) =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject (Email only) */}
          {formData.type === "email" && (
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
              {formData.type === "sms" ? "SMS Message" : "Plain Text Body"}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="text_template"
              value={formData.text_template || ""}
              onChange={(e) => setFormData({ ...formData, text_template: e.target.value })}
              placeholder={
                formData.type === "sms"
                  ? "Hello {{customer_name}}, your invoice {{invoice_number}} is overdue. Please pay {{amount}} by {{due_date}}."
                  : "Plain text version of your message..."
              }
              rows={6}
              required
            />
            {formData.type === "sms" && (
              <p className="text-xs text-muted-foreground">
                SMS messages are limited to 160 characters (longer messages will be split)
              </p>
            )}
          </div>

          {/* HTML Body (Email only) */}
          {formData.type === "email" && (
            <div className="space-y-2">
              <Label htmlFor="html_template">HTML Body (Optional)</Label>
              <Textarea
                id="html_template"
                value={formData.html_template || ""}
                onChange={(e) => setFormData({ ...formData, html_template: e.target.value })}
                placeholder="<h1>Hello {{customer_name}}</h1><p>Your invoice...</p>"
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Rich HTML version for email clients that support it
              </p>
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
            <p className="text-xs text-muted-foreground">
              Variables that must be provided when sending this template
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
