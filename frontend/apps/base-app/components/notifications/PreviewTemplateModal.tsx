/**
 * Preview Template Modal
 *
 * Modal for previewing notification templates with sample data.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Code, Copy, Check } from 'lucide-react';
import type { CommunicationTemplate } from '@/hooks/useNotifications';
import { useNotificationTemplates } from '@/hooks/useNotifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface PreviewTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CommunicationTemplate;
}

export function PreviewTemplateModal({ isOpen, onClose, template }: PreviewTemplateModalProps) {
  const { renderTemplatePreview } = useNotificationTemplates();
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [renderedContent, setRenderedContent] = useState<{
    subject?: string;
    text?: string;
    html?: string;
  } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Initialize sample data with template variables
  useEffect(() => {
    const initialData: Record<string, string> = {};
    template.variables.forEach((variable) => {
      // Provide some default sample data
      switch (variable) {
        case 'customer_name':
          initialData[variable] = 'John Doe';
          break;
        case 'invoice_number':
          initialData[variable] = 'INV-12345';
          break;
        case 'amount':
          initialData[variable] = '$150.00';
          break;
        case 'due_date':
          initialData[variable] = 'January 20, 2025';
          break;
        case 'subscriber_username':
          initialData[variable] = 'john.doe@example.com';
          break;
        default:
          initialData[variable] = `[${variable}]`;
      }
    });
    setSampleData(initialData);
  }, [template]);

  const handleRender = useCallback(async (data: Record<string, string> = sampleData) => {
    setIsRendering(true);
    try {
      const result = await renderTemplatePreview(template.id, data);
      if (result) {
        setRenderedContent(result);
      }
    } catch (err) {
      console.error('Failed to render template:', err);
    } finally {
      setIsRendering(false);
    }
  }, [renderTemplatePreview, sampleData, template.id]);

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
          <DialogTitle>Preview Template: {template.name}</DialogTitle>
          <DialogDescription>
            Test your template with sample data to see how it will look
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Info */}
          <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted p-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge className="mt-1">{template.type.toUpperCase()}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Variables</p>
              <p className="mt-1 text-lg font-semibold">{template.variables.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usage Count</p>
              <p className="mt-1 text-lg font-semibold">{template.usage_count.toLocaleString()}</p>
            </div>
          </div>

          {/* Sample Data Editor */}
          <div className="space-y-3">
            <Label>Sample Data for Variables</Label>
            <div className="grid gap-3">
              {template.variables.map((variable) => (
                <div key={variable} className="flex items-center gap-2">
                  <Label htmlFor={variable} className="w-40 text-sm">
                    {`{{${variable}}}`}
                  </Label>
                  <Input
                    id={variable}
                    value={sampleData[variable] || ''}
                    onChange={(e) =>
                      setSampleData({ ...sampleData, [variable]: e.target.value })
                    }
                    placeholder={`Enter ${variable}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            {template.variables.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This template has no variables
              </p>
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
                  {template.type === 'email' && renderedContent.subject && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Subject Line</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy('subject', renderedContent.subject || '')}
                        >
                          {copiedField === 'subject' ? (
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
                          onClick={() => handleCopy('text', renderedContent.text || '')}
                        >
                          {copiedField === 'text' ? (
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
                      {template.type === 'sms' && (
                        <p className="text-xs text-muted-foreground">
                          Length: {renderedContent.text.length} characters
                          {renderedContent.text.length > 160 &&
                            ` (${Math.ceil(renderedContent.text.length / 160)} SMS segments)`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* HTML Body (Email only) */}
                  {template.type === 'email' && renderedContent.html && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>HTML Body</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy('html', renderedContent.html || '')}
                        >
                          {copiedField === 'html' ? (
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
                          dangerouslySetInnerHTML={{ __html: renderedContent.html }}
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
              {template.type === 'email' && template.subject_template && (
                <div className="space-y-2">
                  <Label>Subject Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{template.subject_template}</pre>
                  </div>
                </div>
              )}

              {/* Text Template */}
              {template.text_template && (
                <div className="space-y-2">
                  <Label>Text Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{template.text_template}</pre>
                  </div>
                </div>
              )}

              {/* HTML Template (Email only) */}
              {template.type === 'email' && template.html_template && (
                <div className="space-y-2">
                  <Label>HTML Template</Label>
                  <div className="rounded-lg border bg-muted p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap">{template.html_template}</pre>
                  </div>
                </div>
              )}

              {/* Variables */}
              <div className="space-y-2">
                <Label>Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="secondary">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Required Variables */}
              {template.required_variables.length > 0 && (
                <div className="space-y-2">
                  <Label>Required Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {template.required_variables.map((variable) => (
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
            <Button onClick={handleRender} disabled={isRendering}>
              {isRendering ? 'Rendering...' : 'Refresh Preview'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
