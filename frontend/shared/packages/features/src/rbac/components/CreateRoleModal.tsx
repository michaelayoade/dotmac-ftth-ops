/**
 * Create Role Modal Component
 *
 * Modal for creating RBAC roles with permissions.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { X, Shield, Plus } from "lucide-react";
import { useState } from "react";

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  priority: number;
  is_system: boolean;
}

interface ApiClient {
  post: (url: string, data: any) => Promise<{ status: number; data?: any }>;
}

interface Toast {
  error: (message: string) => void;
  success: (message: string) => void;
}

interface Logger {
  error: (message: string, error: Error) => void;
}

export interface CreateRoleModalProps {
  permissions: Permission[];
  roles: Role[];
  onClose: () => void;
  onCreate: () => void;
  apiClient: ApiClient;
  toast: Toast;
  logger: Logger;
}

export default function CreateRoleModal({
  permissions,
  roles,
  onClose,
  onCreate,
  apiClient,
  toast,
  logger,
}: CreateRoleModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    priority: 10,
    is_active: true,
    is_default: false,
    parent_role: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Group permissions by category
  const permissionsByCategory = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      const category = acc[permission.category];
      if (category) {
        category.push(permission);
      }
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  // Get non-system roles for parent selection
  const availableParentRoles = roles.filter((role) => !role.is_system);

  const handlePermissionToggle = (permissionName: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionName)) {
      newSelected.delete(permissionName);
    } else {
      newSelected.add(permissionName);
    }
    setSelectedPermissions(newSelected);
  };

  const handleCategoryToggle = (categoryPermissions: Permission[]) => {
    const categoryPermissionNames = categoryPermissions.map((p) => p.name);
    const allSelected = categoryPermissionNames.every((name) => selectedPermissions.has(name));

    const newSelected = new Set(selectedPermissions);
    if (allSelected) {
      // Unselect all in category
      categoryPermissionNames.forEach((name) => newSelected.delete(name));
    } else {
      // Select all in category
      categoryPermissionNames.forEach((name) => newSelected.add(name));
    }
    setSelectedPermissions(newSelected);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      toast.error("Name and display name are required");
      return;
    }

    // Validate name format (lowercase with underscores/dots)
    const namePattern = /^[a-z][a-z0-9_]*$/;
    if (!namePattern.test(formData.name)) {
      toast.error("Role name must be lowercase letters, numbers, and underscores only");
      return;
    }

    // Check if name already exists
    if (roles.some((role) => role.name === formData.name)) {
      toast.error("A role with this name already exists");
      return;
    }

    setCreating(true);
    try {
      const createData = {
        ...formData,
        permissions: Array.from(selectedPermissions),
        parent_role: formData.parent_role || undefined,
      };

      const response = await apiClient.post("/auth/rbac/roles", createData);

      if (response.status >= 200 && response.status < 300) {
        toast.success("Role created successfully");
        onCreate();
      } else {
        toast.error("Failed to create role");
      }
    } catch (error) {
      logger.error(
        "Error creating role",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast.error("Failed to create role");
    } finally {
      setCreating(false);
    }
  };

  const getCategoryStatus = (categoryPermissions: Permission[]) => {
    const categoryPermissionNames = categoryPermissions.map((p) => p.name);
    const selectedCount = categoryPermissionNames.filter((name) =>
      selectedPermissions.has(name),
    ).length;

    if (selectedCount === 0) return "none";
    if (selectedCount === categoryPermissionNames.length) return "all";
    return "partial";
  };

  const loadRoleTemplate = (templateRole: Role) => {
    const role = roles.find((r) => r.name === templateRole.name);
    if (role) {
      // You'd need to fetch the role's permissions from the API
      // For now, just set basic info
      setFormData({
        ...formData,
        display_name: `${role.display_name} (Copy)`,
        description: role.description,
        priority: role.priority,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-sky-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">Create New Role</h2>
              <p className="text-sm text-slate-400">Define a new role with specific permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Role Information */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-4">Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    })
                  }
                  placeholder="e.g., content_manager"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Content Manager"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                />
                <p className="text-xs text-slate-400 mt-1">Higher numbers = higher priority</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Parent Role (Optional)
                </label>
                <select
                  value={formData.parent_role}
                  onChange={(e) => setFormData({ ...formData, parent_role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">No parent role</option>
                  {availableParentRoles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what this role is for..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  Default Role (auto-assigned to new users)
                </label>
              </div>
            </div>
          </div>

          {/* Role Templates */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-4">Quick Start Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {availableParentRoles.slice(0, 3).map((role) => (
                <button
                  key={role.id}
                  onClick={() => loadRoleTemplate(role)}
                  className="p-3 bg-slate-700 border border-slate-600 rounded text-left hover:border-sky-500 transition-colors"
                >
                  <div className="text-white font-medium">{role.display_name}</div>
                  <div className="text-xs text-slate-400 mt-1">{role.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Permissions</h3>
              <span className="text-sm text-slate-400">
                {selectedPermissions.size} of {permissions.length} permissions selected
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => {
                const status = getCategoryStatus(categoryPermissions);

                return (
                  <div key={category} className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={status === "all"}
                          ref={(el) => {
                            if (el) el.indeterminate = status === "partial";
                          }}
                          onChange={() => handleCategoryToggle(categoryPermissions)}
                          className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                        />
                        <h4 className="font-medium text-white capitalize">
                          {category.replace("_", " ")}
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400">
                        {categoryPermissions.filter((p) => selectedPermissions.has(p.name)).length}{" "}
                        / {categoryPermissions.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {categoryPermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-start gap-2 p-2 rounded border border-slate-600/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(permission.name)}
                            onChange={() => handlePermissionToggle(permission.name)}
                            className="mt-0.5 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">
                              {permission.display_name}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{permission.description}</p>
                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              {permission.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !formData.name.trim() || !formData.display_name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating..." : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
