"use client";

import { useEffect, useState } from "react";
import { Edit, Filter, Plus, Search, Shield, Trash2, Users } from "lucide-react";
import { toast, useConfirmDialog } from "@dotmac/ui";

import AssignRoleModal from "@/components/admin/AssignRoleModal";
import CreateRoleModal from "@/components/admin/CreateRoleModal";
import RoleDetailsModal from "@/components/admin/RoleDetailsModal";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { PermissionCategory, useRBAC } from "@/contexts/RBACContext";
import type { Permission as BasePermission, Role as BaseRole } from "@/contexts/RBACContext";
import { apiClient } from "@/lib/api/client";

type AdminPermission = BasePermission & {
  id?: string;
};

type AdminRole = Omit<BaseRole, "permissions"> & {
  permissions: AdminPermission[];
  id?: string;
  priority?: number;
  is_default?: boolean;
  user_count?: number;
  parent_id?: string;
};

export default function RolesManagementPage() {
  const { hasPermission } = useRBAC();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const confirmDialog = useConfirmDialog();

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<AdminRole[]>("/auth/rbac/roles");
      if (response.data) {
        const normalized: AdminRole[] = response.data.map((role) => {
          const parentId = role.parent_id ?? role.parent_role;
          return {
            ...role,
            permissions: (role.permissions ?? []) as AdminPermission[],
            created_at: role.created_at ?? "",
            updated_at: role.updated_at ?? "",
            id: role.id ?? role.name,
            priority: role.priority ?? 0,
            is_default: role.is_default ?? false,
            user_count: role.user_count ?? 0,
            ...(parentId ? { parent_id: parentId } : {}),
          };
        });
        setRoles(normalized);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await apiClient.get<AdminPermission[]>("/auth/rbac/permissions");
      if (response.data) {
        const normalized: AdminPermission[] = response.data.map((permission) => ({
          ...permission,
          description: permission.description ?? "",
          category: permission.category ?? PermissionCategory.SYSTEM,
          is_system: permission.is_system ?? false,
          id: permission.id ?? permission.name,
        }));
        setPermissions(normalized);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const handleDeleteRole = async (role: AdminRole) => {
    if (role.is_system) {
      toast.error("System roles cannot be deleted");
      return;
    }

    const confirmed = await confirmDialog({
      title: "Delete role",
      description: `Are you sure you want to delete the role "${role.display_name}"?`,
      confirmText: "Delete role",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`/auth/rbac/roles/${role.name}`);
      toast.success("Role deleted successfully");
      fetchRoles();
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error("Failed to delete role");
    }
  };

  const handleEditRole = (role: AdminRole) => {
    setSelectedRole(role);
    setShowDetailsModal(true);
  };

  const handleAssignRole = (role: AdminRole) => {
    setSelectedRole(role);
    setShowAssignModal(true);
  };

  const filteredRoles = roles.filter((role) => {
    const matchesSearch =
      role.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role["description"]?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterCategory === "all") return matchesSearch;
    if (filterCategory === "system") return matchesSearch && role.is_system;
    if (filterCategory === "custom") return matchesSearch && !role.is_system;
    if (filterCategory === "default") return matchesSearch && (role.is_default ?? false);

    return matchesSearch;
  });

  const getRoleBadgeColor = (role: AdminRole) => {
    if (role.is_system) return "bg-red-100 text-red-800";
    if (role.is_default ?? false) return "bg-blue-100 text-blue-800";
    return "bg-green-100 text-green-800";
  };

  const getRoleBadgeText = (role: AdminRole) => {
    if (role.is_system) return "System";
    if (role.is_default ?? false) return "Default";
    return "Custom";
  };

  return (
    <RouteGuard permission="system.manage">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Role Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage roles and permissions for your organization
              </p>
            </div>
            {hasPermission("system.manage") && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Role
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4 mt-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-accent border border-border rounded-lg text-white placeholder-muted-foreground focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 bg-accent border border-border rounded-lg text-white focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Roles</option>
                <option value="system">System Roles</option>
                <option value="custom">Custom Roles</option>
                <option value="default">Default Roles</option>
              </select>
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading roles...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map((role) => (
              <div
                key={role.id ?? role.name}
                className="bg-accent border border-border rounded-lg p-4 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-sky-400" />
                    <h3 className="text-lg font-semibold text-white">{role.display_name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(role)}`}>
                    {getRoleBadgeText(role)}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {role.description || "No description available"}
                </p>

                <div className="flex items-center justify-between text-xs text-foreground0 mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role.user_count ?? 0} users
                  </span>
                  <span>Priority: {role.priority ?? 0}</span>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-foreground0 mb-1">Permissions</div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 3).map((perm) => (
                      <span
                        key={perm.id ?? perm.name}
                        className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded"
                      >
                        {perm.name}
                      </span>
                    ))}
                    {role.permissions.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                        +{role.permissions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-muted text-white rounded hover:bg-accent transition-colors"
                  >
                    <Edit className="h-3 w-3" />
                    View/Edit
                  </button>
                  <button
                    onClick={() => handleAssignRole(role)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-sky-500/20 text-sky-400 rounded hover:bg-sky-500/30 transition-colors"
                  >
                    <Users className="h-3 w-3" />
                    Assign
                  </button>
                  {!role.is_system && hasPermission("system.manage") && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredRoles.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Shield className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No roles found</p>
            <p className="text-sm mt-2">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "Create your first role to get started"}
            </p>
          </div>
        )}

        {/* Modals */}
        {showDetailsModal && selectedRole && (
          <RoleDetailsModal
            role={selectedRole}
            permissions={permissions}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedRole(null);
            }}
            onUpdate={() => {
              fetchRoles();
              setShowDetailsModal(false);
              setSelectedRole(null);
            }}
          />
        )}

        {showCreateModal && (
          <CreateRoleModal
            permissions={permissions}
            roles={roles}
            onClose={() => setShowCreateModal(false)}
            onCreate={() => {
              fetchRoles();
              setShowCreateModal(false);
            }}
          />
        )}

        {showAssignModal && selectedRole && (
          <AssignRoleModal
            role={selectedRole}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedRole(null);
            }}
            onAssign={() => {
              fetchRoles();
              setShowAssignModal(false);
              setSelectedRole(null);
            }}
          />
        )}
      </div>
    </RouteGuard>
  );
}
