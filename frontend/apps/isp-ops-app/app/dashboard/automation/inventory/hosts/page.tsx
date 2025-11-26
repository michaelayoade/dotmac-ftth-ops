"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import {
  ArrowLeft,
  Server,
  AlertCircle,
  ExternalLink,
  Database,
  Layers,
  Settings,
} from "lucide-react";
import Link from "next/link";

function InventoryHostsPageContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/automation/inventory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Host Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory hosts and their configurations
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <CardTitle className="text-blue-900">Hosts Managed via AWX</CardTitle>
              <CardDescription className="text-blue-700">
                Host management is handled through the AWX/Ansible Tower interface
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-blue-800">
              Individual hosts and their configurations are managed through AWX. This provides
              powerful features like dynamic inventory, host variables, and integration with cloud
              providers.
            </p>
          </div>

          <div className="pt-4 border-t border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">
              How to manage hosts in AWX:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>Log in to your AWX interface</li>
              <li>Navigate to Resources → Inventories</li>
              <li>Select an inventory to view/edit hosts</li>
              <li>Use the Hosts tab to add, edit, or remove hosts</li>
              <li>Configure host variables as needed</li>
              <li>Assign hosts to groups for better organization</li>
            </ol>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button asChild>
              <a
                href="https://docs.ansible.com/ansible-tower/latest/html/userguide/inventories.html#add-hosts"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View AWX Host Documentation
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/automation/inventory">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Host Management Features */}
      <Card>
        <CardHeader>
          <CardTitle>Host Management Features in AWX</CardTitle>
          <CardDescription>What you can do with hosts in AWX</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Server className="h-8 w-8 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Individual Hosts</h3>
                <p className="text-sm text-muted-foreground">
                  Add and manage individual servers, routers, switches, and other network devices
                  with unique connection parameters and variables.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Layers className="h-8 w-8 text-green-600 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Group Assignment</h3>
                <p className="text-sm text-muted-foreground">
                  Organize hosts into logical groups based on function, location, or any other
                  criteria. Groups can inherit variables and be nested.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Settings className="h-8 w-8 text-purple-600 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Host Variables</h3>
                <p className="text-sm text-muted-foreground">
                  Define host-specific variables like IP addresses, credentials, configuration
                  parameters, and custom metadata.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Database className="h-8 w-8 text-orange-600 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Dynamic Inventory</h3>
                <p className="text-sm text-muted-foreground">
                  Sync hosts automatically from cloud providers (AWS, Azure, GCP), virtualization
                  platforms, or custom inventory scripts.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example Host Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Example Host Configuration</CardTitle>
          <CardDescription>Common patterns for configuring hosts in AWX</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Network Device Host</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-accent rounded">
                <span className="text-muted-foreground">Hostname:</span>
                <span className="font-mono">router-core-01.example.com</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-accent rounded">
                <span className="text-muted-foreground">Groups:</span>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-xs">
                    routers
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    core-network
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    production
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Example Host Variables</h3>
            <pre className="p-3 bg-accent rounded-lg text-sm font-mono overflow-x-auto">
              {`ansible_host: 10.0.1.100
ansible_connection: network_cli
ansible_network_os: ios
ansible_user: admin
device_type: router
location: datacenter-1
vlan_range: 100-200`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>Tips for organizing your inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Use Meaningful Names</p>
                <p className="text-sm text-muted-foreground">
                  Name hosts with descriptive patterns like device-type-location-number (e.g.,
                  router-dc1-core-01)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Group Strategically</p>
                <p className="text-sm text-muted-foreground">
                  Create groups by function, location, environment, or device type for easier
                  playbook targeting
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Use Group Variables</p>
                <p className="text-sm text-muted-foreground">
                  Define common variables at the group level to avoid repetition and ensure
                  consistency
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm mt-0.5">
                4
              </div>
              <div>
                <p className="font-medium">Document Variables</p>
                <p className="text-sm text-muted-foreground">
                  Add comments to complex variables and maintain documentation for custom variables
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Future Enhancement */}
      <Card>
        <CardHeader>
          <CardTitle>Future Enhancement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            In future releases, this page will provide a read-only view of your hosts, including:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
            <li>Searchable host list with filtering by group and status</li>
            <li>Host details including variables and group memberships</li>
            <li>Quick links to launch playbooks targeting specific hosts</li>
            <li>Host status and last playbook execution results</li>
          </ul>
          <div className="flex items-center gap-2 pt-3">
            <Badge variant="outline">Coming Soon</Badge>
            <span className="text-xs text-muted-foreground">Read-only host viewer with search</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventoryHostsPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <InventoryHostsPageContent />
    </RouteGuard>
  );
}
