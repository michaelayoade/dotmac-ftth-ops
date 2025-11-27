"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { ArrowLeft, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

function CreatePlaybookPageContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/automation/playbooks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Playbook Template</h1>
          <p className="text-sm text-muted-foreground">Add a new Ansible playbook template</p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-1" />
            <div>
              <CardTitle className="text-yellow-900">Coming Soon</CardTitle>
              <CardDescription className="text-yellow-700">
                Playbook template creation through the UI is currently in development
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-yellow-800">
              For now, please create and manage playbook templates directly via the AWX/Ansible
              Tower interface.
            </p>
            <p className="text-sm text-yellow-800">
              Once you&apos;ve created a template in AWX, it will automatically appear in this
              dashboard and you&apos;ll be able to launch it from here.
            </p>
          </div>

          <div className="pt-4 border-t border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">
              How to create templates in AWX:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
              <li>Log in to your AWX interface</li>
              <li>Navigate to Resources → Templates</li>
              <li>Click the &quot;Add&quot; button and select &quot;Job Template&quot;</li>
              <li>Fill in the template details (name, inventory, project, playbook)</li>
              <li>Save the template</li>
              <li>Return to this dashboard to see your new template</li>
            </ol>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button asChild>
              <Link href="/dashboard/automation/playbooks">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Playbooks
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://docs.ansible.com/ansible-tower/latest/html/userguide/job_templates.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                AWX Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Future Features Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Future Features</CardTitle>
          <CardDescription>
            What you&apos;ll be able to do when this feature is complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Create templates directly in the UI</p>
                <p className="text-sm text-muted-foreground">
                  Configure name, description, inventory, project, and playbook path
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Set default extra variables</p>
                <p className="text-sm text-muted-foreground">
                  Define default variables that can be overridden at launch time
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Configure job settings</p>
                <p className="text-sm text-muted-foreground">
                  Set timeouts, verbosity, and other execution parameters
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm mt-0.5">
                4
              </div>
              <div>
                <p className="font-medium">Template validation</p>
                <p className="text-sm text-muted-foreground">
                  Validate playbook syntax and required variables before saving
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreatePlaybookPage() {
  return (
    <RouteGuard permission="isp.automation.execute">
      <CreatePlaybookPageContent />
    </RouteGuard>
  );
}
