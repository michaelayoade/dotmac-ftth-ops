"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Users,
  MoreHorizontal,
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Key,
  Lock,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  useRBAC,
  PermissionCategory,
  PermissionAction,
  type Role,
  type Permission,
} from "@/contexts/RBACContext";
import { LoadingState, LoadingTable, LoadingSpinner } from "@/components/ui/loading-states";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api/client";

// Group permissions by category for display
function groupPermissionsByCategory(permissions: Permission[]): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};

  permissions.forEach((permission) => {
    const categoryName = getCategoryDisplayName(permission.category);
    if (!grouped[categoryName]) {
      grouped[categoryName] = [];
    }
    grouped[categoryName].push(permission);
  });

  return grouped;
}

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

interface DirectoryUser {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  is_active?: boolean;
}

interface RoleAssignmentUser extends DirectoryUser {
  granted_at?: string;
  granted_by?: string;
}

export default function RolesPage() {
  const { toast } = useToast();
  const {
    roles,
    loading,
    error,
    createRole,
    updateRole,
    deleteRole,
    getAllPermissions,
    canAccess,
  } = useRBAC();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<DirectoryUser[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<RoleAssignmentUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // New role form state
  const [newRole, setNewRole] = useState({
    name: "",
    display_name: "",
    description: "",
    permissions: new Set<string>(),
  });

  // Check if user can manage roles
  const canManageRoles = canAccess(PermissionCategory.SYSTEM, PermissionAction.MANAGE);

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

    if (canManageRoles) {
      loadPermissions();
    }
  }, [getAllPermissions, canManageRoles, toast]);

  const loadRoleAssignments = useCallback(async () => {
    if (!selectedRole) return;
    setAssignLoading(true);
    try {
      const [usersResponse, assignmentsResponse] = await Promise.all([
        apiClient.get("/users"),
        apiClient.get(`/auth/rbac/roles/${selectedRole.name}/users`),
      ]);
      setAvailableUsers((usersResponse.data as DirectoryUser[]) ?? []);
      setAssignedUsers((assignmentsResponse.data as RoleAssignmentUser[]) ?? []);
    } catch (error) {
      logger.error("Failed to load role assignments", error);
      toast({
        title: "Error loading users",
        description: "We could not load the users for this role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssignLoading(false);
    }
  }, [selectedRole, toast]);

  useEffect(() => {
    if (isAssignOpen && selectedRole) {
      loadRoleAssignments();
    } else if (!isAssignOpen) {
      setAssignSearch("");
      setSelectedUserIds(new Set());
    }
  }, [isAssignOpen, selectedRole, loadRoleAssignments]);

  const filteredAvailableUsers = useMemo(() => {
    const assignedIds = new Set(assignedUsers.map((user) => user.id));
    const query = assignSearch.trim().toLowerCase();

    return availableUsers
      .filter((user) => user.is_active !== false && !assignedIds.has(user.id))
      .filter((user) => {
        if (!query) return true;
        return (
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.full_name && user.full_name.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        const aLabel = a.full_name || a.username || a.email;
        const bLabel = b.full_name || b.username || b.email;
        return aLabel.localeCompare(bLabel);
      });
  }, [availableUsers, assignedUsers, assignSearch]);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(userId)) {
        updated.delete(userId);
      } else {
        updated.add(userId);
      }
      return updated;
    });
  }, []);

  const handleAssignSelectedUsers = useCallback(async () => {
    if (!selectedRole) {
      toast({
        title: "Select a role",
        description: "Please select a role before assigning users.",
        variant: "destructive",
      });
      return;
    }

    if (selectedUserIds.size === 0) {
      toast({
        title: "No users selected",
        description: "Select at least one user to assign.",
        variant: "destructive",
      });
      return;
    }

    setAssignSaving(true);
    try {
      await Promise.all(
        Array.from(selectedUserIds).map((userId) =>
          apiClient.post("/auth/rbac/users/assign-role", {
            user_id: userId,
            role_name: selectedRole.name,
          }),
        ),
      );

      toast({
        title: "Role assigned",
        description: `Assigned "${selectedRole.display_name}" to ${selectedUserIds.size} user(s).`,
      });

      setSelectedUserIds(new Set());
      await loadRoleAssignments();
    } catch (error) {
      logger.error("Failed to assign role", error);
      toast({
        title: "Assignment failed",
        description: "We couldn't assign the role to the selected user(s). Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssignSaving(false);
    }
  }, [selectedRole, selectedUserIds, toast, loadRoleAssignments]);

  const handleRevokeUser = useCallback(
    async (userId: string) => {
      if (!selectedRole) return;
      if (
        !confirm(
          "Are you sure you want to remove this role from the user? The user will immediately lose associated permissions.",
        )
      ) {
        return;
      }

      setAssignSaving(true);
      try {
        await apiClient.post("/auth/rbac/users/revoke-role", {
          user_id: userId,
          role_name: selectedRole.name,
        });
        toast({
          title: "Role revoked",
          description: "The role was removed from the user.",
        });
        await loadRoleAssignments();
      } catch (error) {
        logger.error("Failed to revoke role", error);
        toast({
          title: "Removal failed",
          description: "We couldn't remove the role. Please try again.",
          variant: "destructive",
        });
      } finally {
        setAssignSaving(false);
      }
    },
    [selectedRole, toast, loadRoleAssignments],
  );

  // Filter roles
  const filteredRoles = roles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType =
      filterType === "all" ||
      (filterType === "system" && role.is_system) ||
      (filterType === "custom" && !role.is_system);
    return matchesSearch && matchesType;
  });

  // Group permissions for display
  const groupedPermissions = groupPermissionsByCategory(allPermissions);

  const handleCreateRole = async () => {
    if (!canManageRoles) {
      toast({
        title: "Error",
        description: "You do not have permission to create roles",
        variant: "destructive",
      });
      return;
    }

    if (!newRole.name || !newRole.display_name) {
      toast({
        title: "Error",
        description: "Role name and display name are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading(true);
      await createRole({
        name: newRole.name,
        display_name: newRole.display_name,
        description: newRole.description,
        permissions: Array.from(newRole.permissions),
      });

      setIsCreateOpen(false);
      setNewRole({
        name: "",
        display_name: "",
        description: "",
        permissions: new Set(),
      });
    } catch (error) {
      logger.error("Failed to create role", error);
      // Error is handled by the RBAC context
    } finally {
      setOperationLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole || !canManageRoles) {
      toast({
        title: "Error",
        description: "You do not have permission to update roles",
        variant: "destructive",
      });
      return;
    }

    if (selectedRole.is_system) {
      toast({
        title: "Error",
        description: "System roles cannot be modified",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading(true);
      await updateRole(selectedRole.name, {
        display_name: selectedRole.display_name,
        description: selectedRole.description,
        permissions: Array.from(selectedPermissions),
      });

      setIsEditOpen(false);
    } catch (error) {
      logger.error("Failed to update role", error);
      // Error is handled by the RBAC context
    } finally {
      setOperationLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || !canManageRoles) {
      toast({
        title: "Error",
        description: "You do not have permission to delete roles",
        variant: "destructive",
      });
      return;
    }

    if (selectedRole.is_system) {
      toast({
        title: "Error",
        description: "System roles cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading(true);
      await deleteRole(selectedRole.name);

      setIsDeleteOpen(false);
      setSelectedRole(null);
    } catch (error) {
      logger.error("Failed to delete role", error);
      // Error is handled by the RBAC context
    } finally {
      setOperationLoading(false);
    }
  };

  const handleDuplicateRole = async (role: Role) => {
    if (!canManageRoles) {
      toast({
        title: "Error",
        description: "You do not have permission to create roles",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading(true);
      await createRole({
        name: `${role.name}_copy`,
        display_name: `${role.display_name} (Copy)`,
        description: role.description,
        permissions: role.permissions.map((p) => p.name),
      });
    } catch (error) {
      logger.error("Failed to duplicate role", error);
      // Error is handled by the RBAC context
    } finally {
      setOperationLoading(false);
    }
  };

  const togglePermission = (permissionName: string, isNewRole: boolean = false) => {
    if (isNewRole) {
      const updated = new Set(newRole.permissions);
      if (updated.has(permissionName)) {
        updated.delete(permissionName);
      } else {
        updated.add(permissionName);
      }
      setNewRole({ ...newRole, permissions: updated });
    } else {
      const updated = new Set(selectedPermissions);
      if (updated.has(permissionName)) {
        updated.delete(permissionName);
      } else {
        updated.add(permissionName);
      }
      setSelectedPermissions(updated);
    }
  };

  // Show access denied if user doesn't have permission
  if (!canManageRoles) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Roles & Permissions</h1>
            <p className="text-muted-foreground mt-2">Access denied - insufficient permissions</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mb-4" />
              <p className="text-muted-foreground mb-2">Access Denied</p>
              <p className="text-foreground text-sm">
                You do not have permission to manage roles and permissions.
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
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-2">Manage user roles and their permissions</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Define a new role with specific permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name (Technical)</Label>
              <Input
                id="role-name"
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({
                    ...newRole,
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  })
                }
                placeholder="e.g., content_manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-display-name">Display Name</Label>
              <Input
                id="role-display-name"
                value={newRole.display_name}
                onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                placeholder="e.g., Content Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Describe the role's purpose and responsibilities"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <LoadingState
                loading={permissionsLoading}
                loadingComponent={<LoadingSpinner className="mx-auto my-4" />}
              >
                <ScrollArea className="h-[300px] border rounded-md p-4">
                  {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <div key={category} className="mb-6">
                      <h4 className="font-semibold mb-3">{category}</h4>
                      <div className="space-y-2">
                        {permissions.map((permission) => (
                          <div key={permission.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-${permission.name}`}
                              checked={newRole.permissions.has(permission.name)}
                              onChange={() => togglePermission(permission.name, true)}
                            />
                            <Label
                              htmlFor={`new-${permission.name}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {permission.display_name}
                              {permission.description && (
                                <span className="text-xs text-muted-foreground block">
                                  {permission.description}
                                </span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </LoadingState>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={operationLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={!newRole.name || !newRole.display_name || operationLoading}
            >
              {operationLoading && <LoadingSpinner size="sm" className="mr-2" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">
              {roles.filter((r) => !r.is_system).length} custom roles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">Active roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.filter((r) => r.is_system).length}</div>
            <p className="text-xs text-muted-foreground">Built-in roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.filter((r) => !r.is_system).length}</div>
            <p className="text-xs text-muted-foreground">Organization-specific</p>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Roles</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
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
            loading={loading}
            error={error}
            empty={filteredRoles.length === 0}
            loadingComponent={<LoadingTable rows={5} columns={6} />}
            emptyMessage="No roles found"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.name}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{role.display_name}</div>
                        <div className="text-sm text-muted-foreground">{role.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_system ? "secondary" : "outline"}>
                        {role.is_system ? "system" : "custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {role.permissions.slice(0, 2).map((perm, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {perm.display_name}
                          </Badge>
                        ))}
                        {role.permissions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(role.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? "default" : "secondary"}>
                        {role.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent"
                          disabled={operationLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="absolute right-0">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!role.is_system && !operationLoading) {
                                setSelectedRole(role);
                                setSelectedPermissions(
                                  new Set(role.permissions.map((p) => p.name)),
                                );
                                setIsEditOpen(true);
                              }
                            }}
                            className={
                              role.is_system || operationLoading
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!operationLoading) {
                                handleDuplicateRole(role);
                              }
                            }}
                            className={operationLoading ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!operationLoading) {
                                setSelectedRole(role);
                                setIsAssignOpen(true);
                              }
                            }}
                            className={operationLoading ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Assign Users
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!role.is_system && !operationLoading) {
                                setSelectedRole(role);
                                setIsDeleteOpen(true);
                              }
                            }}
                            className={`text-red-600 dark:text-red-400 ${role.is_system || operationLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </LoadingState>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Modify role permissions and settings</DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role-name">Role Name (Technical)</Label>
                <Input
                  id="edit-role-name"
                  value={selectedRole.name}
                  disabled={true}
                  placeholder="Role name (cannot be changed)"
                  className="opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-display-name">Display Name</Label>
                <Input
                  id="edit-role-display-name"
                  value={selectedRole.display_name}
                  onChange={(e) =>
                    setSelectedRole({
                      ...selectedRole,
                      display_name: e.target.value,
                    })
                  }
                  placeholder="Display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-description">Description</Label>
                <Textarea
                  id="edit-role-description"
                  value={selectedRole.description}
                  onChange={(e) =>
                    setSelectedRole({
                      ...selectedRole,
                      description: e.target.value,
                    })
                  }
                  placeholder="Role description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <LoadingState
                  loading={permissionsLoading}
                  loadingComponent={<LoadingSpinner className="mx-auto my-4" />}
                >
                  <ScrollArea className="h-[300px] border rounded-md p-4">
                    {Object.entries(groupedPermissions).map(([category, permissions]) => (
                      <div key={category} className="mb-6">
                        <h4 className="font-semibold mb-3">{category}</h4>
                        <div className="space-y-2">
                          {permissions.map((permission) => (
                            <div key={permission.name} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-${permission.name}`}
                                checked={selectedPermissions.has(permission.name)}
                                onChange={() => togglePermission(permission.name)}
                              />
                              <Label
                                htmlFor={`edit-${permission.name}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {permission.display_name}
                                {permission.description && (
                                  <span className="text-xs text-muted-foreground block">
                                    {permission.description}
                                  </span>
                                )}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </LoadingState>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={operationLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={operationLoading}>
              {operationLoading && <LoadingSpinner size="sm" className="mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <div className="py-4">
              <div className="bg-red-100 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      <strong>{selectedRole.display_name}</strong> will be permanently deleted.
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={operationLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={operationLoading}>
              {operationLoading && <LoadingSpinner size="sm" className="mr-2" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="assign-role-dialog">
          <DialogHeader>
            <DialogTitle>Assign Users to Role</DialogTitle>
            <DialogDescription>
              Add or remove users from {selectedRole?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {selectedRole ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="w-full md:max-w-sm space-y-2">
                    <Label htmlFor="user-search">Search Users</Label>
                    <Input
                      id="user-search"
                      placeholder="Search by name or email..."
                      value={assignSearch}
                      onChange={(event) => setAssignSearch(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadRoleAssignments}
                    disabled={assignLoading}
                    className="self-start md:self-auto"
                    data-testid="assign-refresh"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${assignLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="border rounded-md" data-testid="assigned-users-list">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <h3 className="text-sm font-semibold text-foreground">
                        Assigned Users ({assignedUsers.length})
                      </h3>
                    </div>
                    <ScrollArea className="h-64">
                      {assignLoading ? (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          <LoadingSpinner className="mr-2 h-4 w-4" />
                          Loading assignments...
                        </div>
                      ) : assignedUsers.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          No users currently have this role.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {assignedUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between px-4 py-3"
                              data-testid="assigned-user-row"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground" data-testid="user-label">
                                  {user.full_name || user.username || user.email}
                                </p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                {user.granted_at && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Assigned on {new Date(user.granted_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeUser(user.id)}
                                disabled={assignSaving}
                                className="text-destructive hover:text-destructive"
                                data-testid="revoke-role"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="border rounded-md" data-testid="available-users-list">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <h3 className="text-sm font-semibold text-foreground">
                        Available Users ({filteredAvailableUsers.length})
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        Selected {selectedUserIds.size}
                      </span>
                    </div>
                    <ScrollArea className="h-64">
                      {assignLoading ? (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          <LoadingSpinner className="mr-2 h-4 w-4" />
                          Loading users...
                        </div>
                      ) : filteredAvailableUsers.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {assignSearch
                            ? "No users match your search."
                            : "All active users already have this role."}
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredAvailableUsers.map((user) => {
                            const selected = selectedUserIds.has(user.id);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => toggleUserSelection(user.id)}
                                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                                  selected ? "bg-primary/10" : "hover:bg-muted"
                                }`}
                                data-testid="available-user-row"
                              >
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={() => toggleUserSelection(user.id)}
                                  aria-label={`Select ${user.full_name || user.username || user.email}`}
                                />
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {user.full_name || user.username || user.email}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 border rounded-md bg-muted text-sm text-muted-foreground">
                Select a role to manage user assignments.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignOpen(false)}
              disabled={operationLoading || assignSaving}
              data-testid="assign-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignSelectedUsers}
              disabled={assignSaving || assignLoading || selectedUserIds.size === 0}
              data-testid="assign-selected"
            >
              {(assignSaving || assignLoading) && <LoadingSpinner size="sm" className="mr-2" />}
              Assign Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
