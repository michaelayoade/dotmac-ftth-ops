"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  AlertCircle,
  BarChart3,
  Database,
  FileText,
  Filter,
  Key,
  Lock,
  Mail,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import {
  useRBAC,
  PermissionCategory,
  PermissionAction,
  type Permission,
} from "@/contexts/RBACContext";
import { LoadingState, LoadingTable } from "@dotmac/ui";
import { logger } from "@/lib/logger";

// Helper function to get category icon
function getCategoryIcon(category: PermissionCategory) {
  const icons = {
    [PermissionCategory.USERS]: Users,
    [PermissionCategory.BILLING]: FileText,
    [PermissionCategory.ANALYTICS]: BarChart3,
    [PermissionCategory.COMMUNICATIONS]: Mail,
    [PermissionCategory.INFRASTRUCTURE]: Database,
    [PermissionCategory.SECRETS]: Lock,
    [PermissionCategory.CUSTOMERS]: Users,
    [PermissionCategory.SETTINGS]: Settings,
    [PermissionCategory.SYSTEM]: Shield,
  };

  return icons[category] || Shield;
}

// Helper function to get category display name
function getCategoryDisplayName(category: PermissionCategory): string {
  const categoryNames = {
    [PermissionCategory.USERS]: "User Management",
    [PermissionCategory.BILLING]: "Billing",
    [PermissionCategory.ANALYTICS]: "Analytics",
    [PermissionCategory.COMMUNICATIONS]: "Communications",
    [PermissionCategory.INFRASTRUCTURE]: "Infrastructure",
    [PermissionCategory.SECRETS]: "Secrets",
    [PermissionCategory.CUSTOMERS]: "Customers",
    [PermissionCategory.SETTINGS]: "Settings",
    [PermissionCategory.SYSTEM]: "System Administration",
  };

  return categoryNames[category] || category;
}

// Helper function to get category color
function getCategoryColor(category: PermissionCategory): string {
  const colors = {
    [PermissionCategory.USERS]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    [PermissionCategory.BILLING]: "bg-green-500/10 text-green-400 border-green-500/20",
    [PermissionCategory.ANALYTICS]: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    [PermissionCategory.COMMUNICATIONS]: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    [PermissionCategory.INFRASTRUCTURE]: "bg-muted text-muted-foreground border-border",
    [PermissionCategory.SECRETS]: "bg-red-500/10 text-red-400 border-red-500/20",
    [PermissionCategory.CUSTOMERS]: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    [PermissionCategory.SETTINGS]: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    [PermissionCategory.SYSTEM]: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  return colors[category] || "bg-muted text-muted-foreground border-border";
}

export default function PermissionsPage() {
  const { toast } = useToast();
  const { error, getAllPermissions, canAccess, roles } = useRBAC();

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSystemPermissions, setFilterSystemPermissions] = useState<string>("all");
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Check if user can view permissions
  const canViewPermissions = canAccess(PermissionCategory.SYSTEM, PermissionAction.READ);

  // Load all permissions on mount
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        setPermissionsLoading(true);
        const permissions = await getAllPermissions();
        setAllPermissions(permissions);
      } catch (error) {
        logger.error("Failed to load permissions", error);
        toast({
          title: "Error",
          description: "Failed to load permissions",
          variant: "destructive",
        });
      } finally {
        setPermissionsLoading(false);
      }
    };

    if (canViewPermissions) {
      loadPermissions();
    }
  }, [getAllPermissions, canViewPermissions, toast]);

  // Filter permissions
  const filteredPermissions = allPermissions.filter((permission) => {
    const matchesSearch =
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (permission.description &&
        permission.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === "all" || permission.category === filterCategory;

    const matchesSystemFilter =
      filterSystemPermissions === "all" ||
      (filterSystemPermissions === "system" && permission.is_system) ||
      (filterSystemPermissions === "custom" && !permission.is_system);

    return matchesSearch && matchesCategory && matchesSystemFilter;
  });

  // Get category statistics
  const categoryStats = Object.values(PermissionCategory)
    .map((category) => {
      const categoryPermissions = allPermissions.filter((p) => p.category === category);
      const Icon = getCategoryIcon(category);

      return {
        category,
        name: getCategoryDisplayName(category),
        count: categoryPermissions.length,
        systemCount: categoryPermissions.filter((p) => p.is_system).length,
        customCount: categoryPermissions.filter((p) => !p.is_system).length,
        icon: Icon,
        color: getCategoryColor(category),
      };
    })
    .filter((stat) => stat.count > 0);

  // Get permission usage in roles
  const getPermissionUsage = (permissionName: string): number => {
    return roles.filter((role) => role.permissions.some((p) => p.name === permissionName)).length;
  };

  // Show access denied if user doesn&apos;t have permission
  if (!canViewPermissions) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Permissions</h1>
            <p className="text-muted-foreground mt-2">Access denied - insufficient permissions</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mb-4" />
              <p className="text-muted-foreground mb-2">Access Denied</p>
              <p className="text-foreground text-sm">
                You do not have permission to view system permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground mt-2">
            View and understand system permissions and their usage
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allPermissions.length}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryStats.length}</div>
            <p className="text-xs text-muted-foreground">Permission categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Permissions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allPermissions.filter((p) => p.is_system).length}
            </div>
            <p className="text-xs text-muted-foreground">Built-in permissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allPermissions.filter((p) => !p.is_system).length}
            </div>
            <p className="text-xs text-muted-foreground">Custom permissions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="permissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="permissions">All Permissions</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions">
          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Permissions</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search permissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="h-10 w-[180px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  >
                    <option value="all">All Categories</option>
                    {Object.values(PermissionCategory).map((category) => (
                      <option key={category} value={category}>
                        {getCategoryDisplayName(category)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterSystemPermissions}
                    onChange={(e) => setFilterSystemPermissions(e.target.value)}
                    className="h-10 w-[150px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  >
                    <option value="all">All Types</option>
                    <option value="system">System</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LoadingState
                loading={permissionsLoading}
                error={error}
                empty={filteredPermissions.length === 0}
                loadingComponent={<LoadingTable rows={10} columns={5} />}
                emptyMessage="No permissions found"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Used in Roles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPermissions.map((permission) => {
                      const usage = getPermissionUsage(permission.name);
                      const Icon = getCategoryIcon(permission.category);

                      return (
                        <TableRow key={permission.name}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{permission.display_name}</div>
                              <div className="text-sm text-muted-foreground">{permission.name}</div>
                              {permission.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {permission.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <Badge
                                variant="outline"
                                className={getCategoryColor(permission.category)}
                              >
                                {getCategoryDisplayName(permission.category)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {permission.resource || "N/A"}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={permission.is_system ? "secondary" : "outline"}>
                              {permission.is_system ? "System" : "Custom"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{usage}</span>
                              <span className="text-xs text-muted-foreground">
                                {usage === 1 ? "role" : "roles"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </LoadingState>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          {/* Category Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Card key={stat.category}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-2">{stat.count}</div>
                    <div className="flex gap-2 mb-4">
                      <Badge variant="secondary" className="text-xs">
                        {stat.systemCount} system
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {stat.customCount} custom
                      </Badge>
                    </div>

                    {/* List permissions in this category */}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {allPermissions
                        .filter((p) => p.category === stat.category)
                        .slice(0, 5)
                        .map((permission) => (
                          <div
                            key={permission.name}
                            className="text-xs text-muted-foreground truncate"
                          >
                            {permission.display_name}
                          </div>
                        ))}
                      {allPermissions.filter((p) => p.category === stat.category).length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          +{allPermissions.filter((p) => p.category === stat.category).length - 5}{" "}
                          more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
