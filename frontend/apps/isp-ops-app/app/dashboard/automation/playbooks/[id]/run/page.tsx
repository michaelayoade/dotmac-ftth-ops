"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { platformConfig } from "@/lib/config";
import { ArrowLeft, Play, Activity, XCircle, AlertCircle, Info } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface JobTemplate {
  id: number;
  name: string;
  description: string | null;
  job_type: string | null;
  playbook: string | null;
}

function PlaybookRunPageContent() {
  const params = useParams();
  const router = useRouter();
  const templateId = params?.["id"] as string;
  const { toast } = useToast();
  const [extraVars, setExtraVars] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const { data: template, isLoading } = useQuery<JobTemplate>({
    queryKey: ["ansible", "job-template", templateId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/ansible/job-templates/${templateId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Playbook template not found");
        }
        throw new Error("Failed to fetch playbook template");
      }
      return response.json();
    },
    enabled: !!templateId,
  });

  const launchJobMutation = useMutation({
    mutationFn: async (data: { template_id: number; extra_vars?: object }) => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/jobs/launch`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Failed to launch job" }));
        throw new Error(error.detail || "Failed to launch job");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Job launched successfully",
      });
      // Redirect to job details page
      router.push(`/dashboard/automation/jobs/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExtraVarsChange = (value: string) => {
    setExtraVars(value);

    // Validate JSON
    if (value.trim() === "") {
      setJsonError(null);
      return;
    }

    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  const handleLaunch = () => {
    // Validate JSON before launching
    let parsedExtraVars: Record<string, unknown> = {};

    if (extraVars.trim()) {
      try {
        parsedExtraVars = JSON.parse(extraVars) as Record<string, unknown>;
      } catch (e) {
        toast({
          title: "Error",
          description: "Invalid JSON in extra variables",
          variant: "destructive",
        });
        return;
      }
    }

    const payload: { template_id: number; extra_vars?: Record<string, unknown> } = {
      template_id: Number.parseInt(templateId, 10),
    };

    if (Object.keys(parsedExtraVars).length > 0) {
      payload.extra_vars = parsedExtraVars;
    }

    launchJobMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Playbook Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The playbook template you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/automation/playbooks">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Playbooks
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/automation/playbooks/${templateId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Launch Playbook</h1>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
        </div>
      </div>

      {/* Playbook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Playbook Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
            <span className="text-sm font-medium">Name</span>
            <span className="text-sm">{template.name}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
            <span className="text-sm font-medium">Playbook Path</span>
            <span className="text-sm font-mono">{template.playbook || "-"}</span>
          </div>
          {template.description && (
            <div className="p-3 bg-accent rounded-lg">
              <span className="text-sm font-medium">Description</span>
              <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Launch Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Launch Configuration</CardTitle>
          <CardDescription>
            Configure extra variables for this playbook execution (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="extra-vars">Extra Variables (JSON)</Label>
              {jsonError && (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {jsonError}
                </span>
              )}
            </div>
            <Textarea
              id="extra-vars"
              value={extraVars}
              onChange={(e) => handleExtraVarsChange(e.target.value)}
              placeholder='{\n  "variable_name": "value",\n  "another_var": "value"\n}'
              className="font-mono text-sm min-h-[200px]"
            />
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Extra Variables Format</p>
                <p>
                  Extra variables must be valid JSON. These variables will be passed to the Ansible
                  playbook during execution. Leave empty if no extra variables are needed.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleLaunch}
                disabled={launchJobMutation.isPending || !!jsonError}
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                {launchJobMutation.isPending ? "Launching..." : "Launch Playbook"}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/automation/playbooks/${templateId}`}>Cancel</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example Extra Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Example Extra Variables</CardTitle>
          <CardDescription>Common patterns for extra variables</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">Basic Variables</p>
            <pre className="p-3 bg-accent rounded-lg text-sm font-mono overflow-x-auto">
              {`{
  "environment": "production",
  "debug_mode": false,
  "max_retries": 3
}`}
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Network Configuration</p>
            <pre className="p-3 bg-accent rounded-lg text-sm font-mono overflow-x-auto">
              {`{
  "target_hosts": ["router1", "router2"],
  "vlan_id": 100,
  "interface": "eth0"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlaybookRunPage() {
  return (
    <RouteGuard permission="isp.automation.execute">
      <PlaybookRunPageContent />
    </RouteGuard>
  );
}
