"use client";

/**
 * Create Template Page
 *
 * Form to create a new communication template.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateTemplate } from "@/hooks/useCommunications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { ArrowLeft, Save, Loader2, Plus, X, Eye } from "lucide-react";
import { useToast } from "@dotmac/ui";
import {
  CommunicationChannel,
  TemplateVariableType,
  extractTemplateVariables,
  type CreateTemplateRequest,
  type TemplateVariable,
} from "@/types/communications";

export default function CreateTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const createTemplate = useCreateTemplate();

  const [formData, setFormData] = useState<CreateTemplateRequest>({
    name: "",
    channel: CommunicationChannel.EMAIL,
    is_active: true,
  });

  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData["name"] || formData["name"].trim().length === 0) {
      newErrors["name"] = "Template name is required";
    }

    if (formData["channel"] === CommunicationChannel.EMAIL) {
      if (!formData["subject"] || formData["subject"].trim().length === 0) {
        newErrors["subject"] = "Subject is required for email templates";
      }
    }

    if (!formData["body_text"] && !formData["body_html"]) {
      newErrors["body_text"] = "Template body is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const detectVariables = () => {
    const textVars = extractTemplateVariables(formData["body_text"] || "");
    const htmlVars = extractTemplateVariables(formData["body_html"] || "");
    const subjectVars = extractTemplateVariables(formData["subject"] || "");
    const allVars = [...new Set([...textVars, ...htmlVars, ...subjectVars])];
    setDetectedVars(allVars);

    // Auto-add detected variables
    allVars.forEach((varName) => {
      if (!variables.find((v) => v.name === varName)) {
        addVariable(varName);
      }
    });
  };

  const addVariable = (name?: string) => {
    const newVar: TemplateVariable = {
      name: name || "",
      type: TemplateVariableType.STRING,
      required: false,
    };
    setVariables((prev) => [...prev, newVar]);
  };

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof TemplateVariable, value: any) => {
    setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
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

    const data: CreateTemplateRequest = {
      ...formData,
      variables: variables.filter((v) => v.name.trim().length > 0),
    };

    createTemplate.mutate(data, {
      onSuccess: (template) => {
        toast({
          title: "Template Created",
          description: `Template "${template["name"]}" has been created successfully`,
        });
        router.push(`/dashboard/communications/templates/${template["id"]}`);
      },
      onError: (error: any) => {
        toast({
          title: "Creation Failed",
          description: error["response"]?.["data"]?.detail || "Failed to create template",
          variant: "destructive",
        });
      },
    });
  };

  const handleChange = (field: keyof CreateTemplateRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/communications/templates">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Create Template</h1>
          <p className="text-muted-foreground mt-1">Create a reusable communication template</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>Basic template details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Template Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData["name"]}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Welcome Email"
                  />
                  {errors["name"] && <p className="text-sm text-red-500">{errors["name"]}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData["description"] || ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="What is this template for?"
                    rows={2}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="channel">Channel</Label>
                    <Select
                      value={formData["channel"]}
                      onValueChange={(value) =>
                        handleChange("channel", value as CommunicationChannel)
                      }
                    >
                      <SelectTrigger id="channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CommunicationChannel.EMAIL}>Email</SelectItem>
                        <SelectItem value={CommunicationChannel.SMS}>SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="is_active">Status</Label>
                    <Select
                      value={formData["is_active"] ? "active" : "inactive"}
                      onValueChange={(value) => handleChange("is_active", value === "active")}
                    >
                      <SelectTrigger id="is_active">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content */}
            <Card>
              <CardHeader>
                <CardTitle>Template Content</CardTitle>
                <CardDescription>Use {`{{ variable_name }}`} for dynamic content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData["channel"] === CommunicationChannel.EMAIL && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="subject"
                      value={formData["subject"] || ""}
                      onChange={(e) => handleChange("subject", e.target.value)}
                      placeholder="Email subject with {{ variables }}"
                    />
                    {errors["subject"] && (
                      <p className="text-sm text-red-500">{errors["subject"]}</p>
                    )}
                  </div>
                )}

                <Tabs defaultValue="text">
                  <TabsList>
                    <TabsTrigger value="text">Plain Text</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="space-y-2">
                    <Label htmlFor="body_text">
                      Text Body <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="body_text"
                      value={formData["body_text"] || ""}
                      onChange={(e) => handleChange("body_text", e.target.value)}
                      placeholder="Hello {{ name }}, welcome to our service!"
                      rows={12}
                    />
                    {errors["body_text"] && (
                      <p className="text-sm text-red-500">{errors["body_text"]}</p>
                    )}
                  </TabsContent>
                  <TabsContent value="html" className="space-y-2">
                    <Label htmlFor="body_html">HTML Body</Label>
                    <Textarea
                      id="body_html"
                      value={formData["body_html"] || ""}
                      onChange={(e) => handleChange("body_html", e.target.value)}
                      placeholder="<html><body>Hello {{ name }}</body></html>"
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </TabsContent>
                </Tabs>

                <Button type="button" variant="outline" size="sm" onClick={detectVariables}>
                  Detect Variables
                </Button>
                {detectedVars.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detectedVars.map((v) => (
                      <Badge key={v} variant="secondary">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Variables */}
            <Card>
              <CardHeader>
                <CardTitle>Template Variables</CardTitle>
                <CardDescription>Define variables that can be used in the template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {variables.map((variable, index) => (
                  <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 md:grid-cols-3">
                      <Input
                        placeholder="Variable name"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, "name", e.target.value)}
                      />
                      <Select
                        value={variable.type}
                        onValueChange={(value) => updateVariable(index, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TemplateVariableType.STRING}>String</SelectItem>
                          <SelectItem value={TemplateVariableType.NUMBER}>Number</SelectItem>
                          <SelectItem value={TemplateVariableType.DATE}>Date</SelectItem>
                          <SelectItem value={TemplateVariableType.EMAIL}>Email</SelectItem>
                          <SelectItem value={TemplateVariableType.URL}>URL</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={variable.required || false}
                          onChange={(e) => updateVariable(index, "required", e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm">Required</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addVariable()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Template
                  </>
                )}
              </Button>
              <Link href="/dashboard/communications/templates">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Variable Syntax</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Use Jinja2 template syntax:</p>
                <code className="block bg-muted p-2 rounded text-xs">{`{{ variable_name }}`}</code>
                <p className="pt-2">Examples:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• {`{{ name }}`} - User name</li>
                  <li>• {`{{ email }}`} - Email address</li>
                  <li>• {`{{ company }}`} - Company name</li>
                  <li>• {`{{ url }}`} - Custom URL</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Use clear, descriptive variable names</p>
                <p>• Test templates before activating</p>
                <p>• Keep subject lines concise</p>
                <p>• Provide both text and HTML versions</p>
                <p>• Mark required variables</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
