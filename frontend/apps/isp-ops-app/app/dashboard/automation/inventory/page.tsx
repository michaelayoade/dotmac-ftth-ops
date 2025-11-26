"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { Server, Package, AlertCircle, ExternalLink, Users, Layers, Database } from "lucide-react";
import Link from "next/link";

function InventoryDashboardContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage Ansible inventory, hosts, and groups</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/automation/inventory/hosts">View Hosts</Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hosts</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Managed via AWX</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Groups</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Managed via AWX</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventories</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Managed via AWX</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variables</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Managed via AWX</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <CardTitle className="text-blue-900">Inventory Management</CardTitle>
              <CardDescription className="text-blue-700">
                Inventory is currently managed via AWX/Ansible Tower
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-blue-800">
              All inventory management, including hosts, groups, and variables, is handled through
              the AWX/Ansible Tower interface. This ensures consistency and leverages AWX&apos;s
              powerful inventory features like dynamic inventory sources.
            </p>
          </div>

          <div className="pt-4 border-t border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">
              What you can manage in AWX:
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Server className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Hosts</p>
                  <p className="text-xs text-blue-700">Individual servers and devices</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Groups</p>
                  <p className="text-xs text-blue-700">Organize hosts into logical groups</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Variables</p>
                  <p className="text-xs text-blue-700">Host and group-level variables</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Database className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Dynamic Sources</p>
                  <p className="text-xs text-blue-700">Cloud and API inventory sources</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button variant="default" asChild>
              <a
                href="https://docs.ansible.com/ansible-tower/latest/html/userguide/inventories.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                AWX Inventory Documentation
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/automation/playbooks">View Playbooks</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Using Inventory in Playbooks</CardTitle>
          <CardDescription>How inventory integrates with your automation workflows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Define Inventory in AWX</p>
                <p className="text-sm text-muted-foreground">
                  Create inventories with hosts and groups in AWX interface
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Link to Templates</p>
                <p className="text-sm text-muted-foreground">
                  Job templates reference specific inventories for playbook execution
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Execute Playbooks</p>
                <p className="text-sm text-muted-foreground">
                  Launch playbooks from this dashboard, which run against your defined inventory
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Templates Card */}
      <Card>
        <CardHeader>
          <CardTitle>Job Templates Using Inventory</CardTitle>
          <CardDescription>Playbooks that depend on inventory configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View job templates to see which playbooks use specific inventories. You can launch these
            playbooks from the Playbooks page.
          </p>
          <Button asChild>
            <Link href="/dashboard/automation/playbooks">View All Playbooks</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Future Enhancement Note */}
      <Card>
        <CardHeader>
          <CardTitle>Future Enhancement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            In future releases, this dashboard will provide read-only views of your AWX inventory,
            including host lists, group hierarchies, and variable visualization. This will make it
            easier to understand your infrastructure without leaving the platform dashboard.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline">Coming Soon</Badge>
            <span className="text-xs text-muted-foreground">Read-only inventory viewer</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventoryDashboardPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <InventoryDashboardContent />
    </RouteGuard>
  );
}
