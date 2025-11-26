/**
 * Preview Template Modal
 *
 * Modal for previewing notification templates with sample data.
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Eye, Code, Copy, Check } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";

import { sanitizeRichHtml } from "../../utils/sanitize";

export interface RenderedTemplateContent {
  subject?: string;
  text?: string;
  html?: string;
}

export interface PreviewTemplateModalProps<TTemplate = any> {
  isOpen: boolean;
  onClose: () => void;
  template: TTemplate;
  renderTemplatePreview: (
    templateId: string,
    data: Record<string, string>,
  ) => Promise<RenderedTemplateContent>;
}

export function PreviewTemplateModal<TTemplate = any>({
  isOpen,
  onClose,
  template,
  renderTemplatePreview,
}: PreviewTemplateModalProps<TTemplate>) {
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [renderedContent, setRenderedContent] = useState<RenderedTemplateContent | null>(null);
  const sanitizedHtml = useMemo(
    () => sanitizeRichHtml(renderedContent?.html ?? ""),
    [renderedContent?.html],
  );
  const [isRendering, setIsRendering] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Cast template to access properties
  const templateData = template as any;

  // Initialize sample data with template variables
  useEffect(() => {
    const initialData: Record<string, string> = {};
    const variables = templateData.variables as string[];
    variables.forEach((variable: string) => {
      // Provide some default sample data
      switch (variable) {
        case "customer_name":
          initialData[variable] = "John Doe";
          break;
        case "invoice_number":
          initialData[variable] = "INV-12345";
          break;
        case "amount":
          initialData[variable] = "$150.00";
          break;
        case "due_date":
          initialData[variable] = "January 20, 2025";
          break;
        case "subscriber_username":
          initialData[variable] = "john.doe@example.com";
          break;
        default:
          initialData[variable] = `[${variable}]`;
      }
    });
    setSampleData(initialData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRender = useCallback(
    async (data: Record<string, string> = sampleData) => {
      setIsRendering(true);
      try {
        const result = await renderTemplatePreview(templateData.id, data);
        if (result) {
          setRenderedContent(result);
        }
      } catch (err) {
        console.error("Failed to render template:", err);
      } finally {
        setIsRendering(false);
      }
    },
    [renderTemplatePreview, sampleData, templateData.id],
  );

  // Render template when sample data changes
  useEffect(() => {
    if (Object.keys(sampleData).length > 0) {
      handleRender(sampleData);
    }
  }, [handleRender, sampleData]);

  const handleCopy = (field: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Template: {templateData.name}</DialogTitle>
          <DialogDescription>
            Test your template with sample data to see how it will look
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Info */}
          <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted p-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge className="mt-1">{templateData.type.toUpperCase()}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Variables</p>
              <p className="mt-1 text-lg font-semibold">{templateData.variables.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usage Count</p>
              <p className="mt-1 text-lg font-semibold">
                {templateData.usage_count.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Sample Data Editor */}
          <div className="space-y-3">
            <Label>Sample Data for Variables</Label>
            <div className="grid gap-3">
              {templateData.variables.map((variable: string) => (
                <div key={variable} className="flex items-center gap-2">
                  <Label htmlFor={variable} className="w-40 text-sm">
                    {`{{${variable}}}`}
                  </Label>
                  <Input
                    id={variable}
                    value={sampleData[variable] || ""}
                    onChange={(e) =>
                      setSampleData({
                        ...sampleData,
                        [variable]: e.target.value,
                      })
                    }
                    placeholder={`Enter ${variable}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            {templateData.variables.length === 0 && (
              <p className="text-sm text-muted-foreground">This template has no variables</p>
            )}
          </div>

          {/* Preview Tabs */}
          <Tabs defaultValue="rendered" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rendered">
                <Eye className="mr-2 h-4 w-4" />
                Rendered Preview
              </TabsTrigger>
              <TabsTrigger value="raw">
                <Code className="mr-2 h-4 w-4" />
                Raw Template
              </TabsTrigger>
            </TabsList>

            {/* Rendered Preview */}
            <TabsContent value="rendered" className="space-y-4">
              {isRendering && (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}

              {!isRendering && renderedContent && (
                <>
                  {/* Subject (Email only) */}
                  {templateData.type === "email" && renderedContent.subject && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Subject Line</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy("subject", renderedContent.subject || "")}
                        >
                          {copiedField === "subject" ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <p className="font-semibold">{renderedContent.subject}</p>
                      </div>
                    </div>
                  )}

                  {/* Text Body */}
                  {renderedContent.text && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Text Body</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy("text", renderedContent.text || "")}
                        >
                          {copiedField === "text" ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <p className="whitespace-pre-wrap text-sm">{renderedContent.text}</p>
                      </div>
                      {templateData.type === "sms" && (
                        <p className="text-xs text-muted-foreground">
                          Length: {renderedContent.text.length} characters
                          {renderedContent.text.length > 160 &&
                            ` (${Math.ceil(renderedContent.text.length / 160)} SMS segments)`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* HTML Body (Email only) */}
                  {templateData.type === "email" && renderedContent.html && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>HTML Body</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy("html", renderedContent.html || "")}
                        >
                          {copiedField === "html" ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{
                            __html: sanitizedHtml,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Raw Template */}
            <TabsContent value="raw" className="space-y-4">
              {/* Subject Template (Email only) */}
              {templateData.type === "email" && templateData.subject_template && (
                <div className="space-y-2">
                  <Label>Subject Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{templateData.subject_template}</pre>
                  </div>
                </div>
              )}

              {/* Text Template */}
              {templateData.text_template && (
                <div className="space-y-2">
                  <Label>Text Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{templateData.text_template}</pre>
                  </div>
                </div>
              )}

              {/* HTML Template (Email only) */}
              {templateData.type === "email" && templateData.html_template && (
                <div className="space-y-2">
                  <Label>HTML Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{templateData.html_template}</pre>
                  </div>
                </div>
              )}

              {/* Variables */}
              <div className="space-y-2">
                <Label>Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {templateData.variables.map((variable: string) => (
                    <Badge key={variable} variant="secondary">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Required Variables */}
              {templateData.required_variables.length > 0 && (
                <div className="space-y-2">
                  <Label>Required Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {templateData.required_variables.map((variable: string) => (
                      <Badge key={variable} variant="destructive">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => handleRender()} disabled={isRendering}>
              {isRendering ? "Rendering..." : "Refresh Preview"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
