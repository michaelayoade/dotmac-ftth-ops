"use client";

/**
 * Email Composer Page
 *
 * Form to compose and send emails with template support.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useSendEmail,
  useQueueEmail,
  useTemplates,
  useTemplate,
  useRenderTemplate,
} from "@/hooks/useCommunications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { ArrowLeft, Send, Loader2, Eye } from "lucide-react";
import { useToast } from "@dotmac/ui";
import {
  parseEmails,
  isValidEmail,
  extractTemplateVariables,
  type SendEmailRequest,
  type QueueEmailRequest,
  CommunicationChannel,
} from "@/types/communications";
import { logger } from "@/lib/logger";
import { sanitizeRichHtml } from "@dotmac/primitives";

interface EmailForm {
  to: string; // comma-separated
  cc: string;
  bcc: string;
  subject: string;
  body_html: string;
  body_text: string;
  reply_to: string;
  template_id: string;
  variables?: Record<string, string>;
  scheduled_at: string;
  priority: number;
}

type EmailFormErrorKey = keyof EmailForm | "variables";
type EmailFormErrors = Partial<Record<EmailFormErrorKey, string>>;

export default function SendEmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const sendEmail = useSendEmail();
  const queueEmail = useQueueEmail();
  const { data: templatesData } = useTemplates({
    channel: CommunicationChannel.EMAIL,
    is_active: true,
  });
  const renderTemplate = useRenderTemplate();

  const [formData, setFormData] = useState<EmailForm>({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body_text: "",
    body_html: "",
    reply_to: "",
    template_id: "",
    priority: 5,
    scheduled_at: "",
  });
  const [errors, setErrors] = useState<EmailFormErrors>({});
  const [sendMode, setSendMode] = useState<"immediate" | "queue">("immediate");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [enableTemplate, setEnableTemplate] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const selectedTemplate = useTemplate(formData["template_id"] || null);
  const sanitizedPreviewHtml = useMemo(() => sanitizeRichHtml(previewHtml), [previewHtml]);
  const selectedTemplateData = selectedTemplate.data;
  const bodyText = formData["body_text"] || "";
  const bodyHtml = formData.body_html || "";

  // Extract variables when template or manual content changes
  useEffect(() => {
    if (enableTemplate && selectedTemplateData) {
      const htmlVars = extractTemplateVariables(selectedTemplateData.body_html || "");
      const textVars = extractTemplateVariables(selectedTemplateData.body_text || "");
      const subjectVars = extractTemplateVariables(selectedTemplateData.subject || "");
      const allVars = [...new Set([...htmlVars, ...textVars, ...subjectVars])];
      setTemplateVariables(allVars);

      // Initialize variables object
      const vars: Record<string, string> = {};
      allVars.forEach((v) => (vars[v] = ""));
      setFormData((prev) => ({ ...prev, variables: vars }));
    } else if (!enableTemplate) {
      const textVars = extractTemplateVariables(bodyText);
      const htmlVars = extractTemplateVariables(bodyHtml);
      const allVars = [...new Set([...textVars, ...htmlVars])];
      setTemplateVariables(allVars);
    }
  }, [enableTemplate, selectedTemplateData, bodyText, bodyHtml]);

  const validate = (): boolean => {
    const newErrors: EmailFormErrors = {};

    // Validate recipients
    const toEmails = parseEmails(formData["to"]);
    if (toEmails.length === 0) {
      newErrors.to = "At least one valid recipient email is required";
    }

    if (formData["cc"]) {
      const ccEmails = parseEmails(formData["cc"]);
      if (formData["cc"].trim() && ccEmails.length === 0) {
        newErrors.cc = "Invalid CC email addresses";
      }
    }

    if (formData["bcc"]) {
      const bccEmails = parseEmails(formData["bcc"]);
      if (formData["bcc"].trim() && bccEmails.length === 0) {
        newErrors.bcc = "Invalid BCC email addresses";
      }
    }

    if (formData["reply_to"] && !isValidEmail(formData["reply_to"])) {
      newErrors.reply_to = "Invalid reply-to email address";
    }

    // Validate subject
    if (!formData["subject"] || formData["subject"].trim().length === 0) {
      newErrors.subject = "Subject is required";
    }

    // Validate body
    if (enableTemplate && !formData["template_id"]) {
      newErrors.template_id = "Please select a template";
    } else if (!enableTemplate && !formData["body_text"] && !formData.body_html) {
      newErrors.body_text = "Email body is required";
    }

    // Validate template variables
    if (enableTemplate && templateVariables.length > 0) {
      const missingVars = templateVariables.filter(
        (v) => !formData["variables"]?.[v] || formData["variables"][v].trim() === "",
      );
      if (missingVars.length > 0) {
        newErrors.variables = `Missing required variables: ${missingVars.join(", ")}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePreview = async () => {
    if (!validate()) return;

    if (enableTemplate && formData["template_id"] && formData["variables"]) {
      try {
        const result = await renderTemplate.mutateAsync({
          id: formData["template_id"],
          variables: formData["variables"],
        });
        logger.info("Template preview rendered", { templateId: formData["template_id"] });
        setPreviewHtml(result.rendered_body_html || result.rendered_body_text || "");
        setShowPreview(true);
      } catch (error: any) {
        logger.error("Failed to render template preview", error, {
          templateId: formData["template_id"],
        });
        toast({
          title: "Preview Failed",
          description: error.response?.data?.detail || "Failed to render template",
          variant: "destructive",
        });
      }
    } else {
      setPreviewHtml(formData.body_html || formData["body_text"] || "");
      setShowPreview(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    const toRecipients = parseEmails(formData["to"]);
    const ccRecipients = formData["cc"] ? parseEmails(formData["cc"]) : undefined;
    const bccRecipients = formData["bcc"] ? parseEmails(formData["bcc"]) : undefined;

    const emailData: SendEmailRequest = {
      to: toRecipients,
      subject: formData["subject"].trim(),
    };

    if (ccRecipients?.length) {
      emailData.cc = ccRecipients;
    }
    if (bccRecipients?.length) {
      emailData.bcc = bccRecipients;
    }
    if (formData["reply_to"]?.trim()) {
      emailData.reply_to = formData["reply_to"].trim();
    }

    if (enableTemplate && formData["template_id"]) {
      emailData.template_id = formData["template_id"];
      if (formData["variables"]) {
        emailData.variables = formData["variables"];
      }
    } else {
      if (formData["body_text"]) {
        emailData.body_text = formData["body_text"];
      }
      if (formData.body_html) {
        emailData.body_html = formData.body_html;
      }
    }

    if (sendMode === "immediate") {
      sendEmail.mutate(emailData, {
        onSuccess: (data) => {
          logger.info("Email sent successfully", {
            recipientCount: data.accepted.length,
            subject: formData["subject"],
          });
          toast({
            title: "Email Sent",
            description: `Successfully sent to ${data.accepted.length} recipient(s)`,
          });
          router.push("/dashboard/communications");
        },
        onError: (error: any) => {
          logger.error("Failed to send email", error, {
            subject: formData["subject"],
            recipientCount: toRecipients.length,
          });
          toast({
            title: "Send Failed",
            description: error.response?.data?.detail || "Failed to send email",
            variant: "destructive",
          });
        },
      });
    } else {
      const queueData: QueueEmailRequest = {
        ...emailData,
        ...(typeof formData.priority === "number" && { priority: formData.priority }),
        ...(formData.scheduled_at && { scheduled_at: formData.scheduled_at }),
      };

      queueEmail.mutate(queueData, {
        onSuccess: (data) => {
          logger.info("Email queued successfully", {
            taskId: data.task_id,
            subject: formData["subject"],
            priority: formData.priority,
            scheduledAt: formData.scheduled_at,
          });
          toast({
            title: "Email Queued",
            description: `Email queued successfully. Task ID: ${data.task_id}`,
          });
          router.push("/dashboard/communications");
        },
        onError: (error: any) => {
          logger.error("Failed to queue email", error, {
            subject: formData["subject"],
            priority: formData.priority,
          });
          toast({
            title: "Queue Failed",
            description: error.response?.data?.detail || "Failed to queue email",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleChange = (field: keyof EmailForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleVariableChange = (varName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      variables: { ...prev.variables, [varName]: value },
    }));
  };

  const isPending = sendEmail.isPending || queueEmail.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/communications">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Communications
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Send Email</h1>
          <p className="text-muted-foreground mt-1">
            Compose and send email to one or multiple recipients
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Composer</CardTitle>
                    <CardDescription>Fill in the email details</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                      disabled={isPending || renderTemplate.isPending}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Template Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="use_template"
                    checked={enableTemplate}
                    onChange={(e) => setEnableTemplate(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="use_template" className="font-normal cursor-pointer">
                    Use email template
                  </Label>
                </div>

                {/* Template Selection */}
                {enableTemplate && (
                  <div className="space-y-2">
                    <Label htmlFor="template_id">
                      Template <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData["template_id"]}
                      onValueChange={(value) => handleChange("template_id", value)}
                    >
                      <SelectTrigger id="template_id">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesData?.templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.template_id && (
                      <p className="text-sm text-red-500">{errors.template_id}</p>
                    )}
                    {selectedTemplate.data && (
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.data.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Recipients */}
                <div className="space-y-2">
                  <Label htmlFor="to">
                    To <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="to"
                    value={formData["to"]}
                    onChange={(e) => handleChange("to", e.target.value)}
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="text-sm text-muted-foreground">Comma-separated email addresses</p>
                  {errors.to && <p className="text-sm text-red-500">{errors.to}</p>}
                </div>

                {/* CC/BCC */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cc">CC</Label>
                    <Input
                      id="cc"
                      value={formData["cc"]}
                      onChange={(e) => handleChange("cc", e.target.value)}
                      placeholder="cc@example.com"
                    />
                    {errors.cc && <p className="text-sm text-red-500">{errors.cc}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bcc">BCC</Label>
                    <Input
                      id="bcc"
                      value={formData["bcc"]}
                      onChange={(e) => handleChange("bcc", e.target.value)}
                      placeholder="bcc@example.com"
                    />
                    {errors.bcc && <p className="text-sm text-red-500">{errors.bcc}</p>}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">
                    Subject <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="subject"
                    value={formData["subject"]}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    placeholder="Email subject"
                  />
                  {errors.subject && <p className="text-sm text-red-500">{errors.subject}</p>}
                </div>

                {/* Template Variables */}
                {enableTemplate && templateVariables.length > 0 && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <Label>Template Variables</Label>
                    {templateVariables.map((varName) => (
                      <div key={varName} className="space-y-2">
                        <Label htmlFor={`var_${varName}`} className="text-sm">
                          {varName}
                        </Label>
                        <Input
                          id={`var_${varName}`}
                          value={formData["variables"]?.[varName] || ""}
                          onChange={(e) => handleVariableChange(varName, e.target.value)}
                          placeholder={`Enter ${varName}`}
                        />
                      </div>
                    ))}
                    {errors.variables && <p className="text-sm text-red-500">{errors.variables}</p>}
                  </div>
                )}

                {/* Manual Body */}
                {!enableTemplate && (
                  <Tabs defaultValue="text">
                    <TabsList>
                      <TabsTrigger value="text">Plain Text</TabsTrigger>
                      <TabsTrigger value="html">HTML</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="space-y-2">
                      <Label htmlFor="body_text">
                        Email Body <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="body_text"
                        value={formData["body_text"]}
                        onChange={(e) => handleChange("body_text", e.target.value)}
                        placeholder="Email body text..."
                        rows={12}
                      />
                      {errors.body_text && (
                        <p className="text-sm text-red-500">{errors.body_text}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="html" className="space-y-2">
                      <Label htmlFor="body_html">HTML Body</Label>
                      <Textarea
                        id="body_html"
                        value={formData.body_html}
                        onChange={(e) => handleChange("body_html", e.target.value)}
                        placeholder="<html>...</html>"
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </TabsContent>
                  </Tabs>
                )}

                {/* Reply To */}
                <div className="space-y-2">
                  <Label htmlFor="reply_to">Reply To (optional)</Label>
                  <Input
                    id="reply_to"
                    value={formData["reply_to"]}
                    onChange={(e) => handleChange("reply_to", e.target.value)}
                    placeholder="reply@example.com"
                  />
                  {errors.reply_to && <p className="text-sm text-red-500">{errors.reply_to}</p>}
                </div>

                {/* Send Mode */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <Label>Send Mode</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="immediate"
                        checked={sendMode === "immediate"}
                        onChange={() => setSendMode("immediate")}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Send Immediately</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="queue"
                        checked={sendMode === "queue"}
                        onChange={() => setSendMode("queue")}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Queue for Later</span>
                    </label>
                  </div>

                  {sendMode === "queue" && (
                    <div className="space-y-3 mt-3">
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority (1-10)</Label>
                        <Input
                          id="priority"
                          type="number"
                          min={1}
                          max={10}
                          value={formData.priority}
                          onChange={(e) => handleChange("priority", parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="scheduled_at">Schedule for (optional)</Label>
                        <Input
                          id="scheduled_at"
                          type="datetime-local"
                          value={formData.scheduled_at || ""}
                          onChange={(e) => handleChange("scheduled_at", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {sendMode === "immediate" ? "Sending..." : "Queueing..."}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {sendMode === "immediate" ? "Send Now" : "Queue Email"}
                      </>
                    )}
                  </Button>
                  <Link href="/dashboard/communications">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {previewHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }} />
                  ) : (
                    <p className="text-muted-foreground">No preview available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Use templates for consistent branding</p>
              <p>• Test with your own email first</p>
              <p>• Variables: Use {`{{ variable_name }}`} syntax</p>
              <p>• Queue for bulk sending (better performance)</p>
              <p>• Check preview before sending</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
