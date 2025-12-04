"use client";

import { X, Shield, Check, Save, AlertTriangle } from "lucide-react";
import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

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
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
  permissions: Permission[];
  user_count: number | undefined;
  parent_id: string | undefined;
}

export interface RbacApiClient {
  patch: <T = any>(url: string, data?: any) => Promise<{ status: number; data: T }>;
}

export interface Toast {
  success: (message: string) => void;
  error: (message: string) => void;
}

export interface RoleDetailsModalProps {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onUpdate: () => void;
  apiClient: RbacApiClient;
  toast: Toast;
}

// ============================================================================
// Component
// ============================================================================

export default function RoleDetailsModal({
  role,
  permissions,
  onClose,
  onUpdate,
  apiClient,
  toast,
}: RoleDetailsModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    display_name: role.display_name,
    description: role.description || "",
    priority: role.priority,
    is_active: role.is_active,
    is_default: role.is_default,
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(role.permissions.map((p) => p.name)),
  );
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!editMode) return;

    setSaving(true);
    try {
      const updateData = {
        ...formData,
        permissions: Array.from(selectedPermissions),
      };

      const response = await apiClient.patch(`/auth/rbac/roles/${role.name}`, updateData);

      if (response.status >= 200 && response.status < 300) {
        toast.success("Role updated successfully");
        onUpdate();
      } else {
        toast.error("Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setSaving(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-sky-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editMode ? "Edit Role" : "Role Details"}
              </h2>
              <p className="text-sm text-slate-400">{role.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role.is_system && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                System Role
              </span>
            )}
            {!role.is_system && (
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
              >
                {editMode ? "Cancel" : "Edit"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Role Information */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-4">Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Display Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                  />
                ) : (
                  <p className="text-white">{role.display_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                {editMode ? (
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                  />
                ) : (
                  <p className="text-white">{role.priority}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                {editMode ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
                  />
                ) : (
                  <p className="text-white">{role.description || "No description"}</p>
                )}
              </div>

              {editMode && (
                <div className="md:col-span-2 flex gap-4">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_default: e.target.checked,
                        })
                      }
                      className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    Default Role
                  </label>
                </div>
              )}
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

            {role.is_system && !editMode ? (
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    System roles cannot be modified. Their permissions are managed by the system.
                  </span>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => {
                const status = getCategoryStatus(categoryPermissions);

                return (
                  <div key={category} className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {editMode && !role.is_system && (
                          <input
                            type="checkbox"
                            checked={status === "all"}
                            ref={(el) => {
                              if (el) el.indeterminate = status === "partial";
                            }}
                            onChange={() => handleCategoryToggle(categoryPermissions)}
                            className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                          />
                        )}
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
                          {editMode && !role.is_system ? (
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(permission.name)}
                              onChange={() => handlePermissionToggle(permission.name)}
                              className="mt-0.5 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                            />
                          ) : (
                            <div className="mt-0.5">
                              {selectedPermissions.has(permission.name) ? (
                                <Check className="h-4 w-4 text-green-400" />
                              ) : (
                                <div className="h-4 w-4" />
                              )}
                            </div>
                          )}
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
        {editMode && !role.is_system && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
