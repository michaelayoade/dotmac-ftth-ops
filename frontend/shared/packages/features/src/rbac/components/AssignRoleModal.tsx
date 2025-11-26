"use client";

import { X, UserPlus, Search, Users, Calendar, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  priority: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
}

export interface UserRoleAssignment {
  user_id: string;
  role_name: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface RbacApiClient {
  get: <T = any>(url: string) => Promise<{ status: number; data: T }>;
  post: <T = any>(url: string, data?: any) => Promise<{ status: number; data: T }>;
}

export interface Toast {
  success: (message: string) => void;
  error: (message: string) => void;
}

export interface Logger {
  error: (message: string, error: Error) => void;
}

export interface RbacConfirmDialogFn {
  (options: {
    title: string;
    description: string;
    confirmText: string;
    variant: "destructive" | "default";
  }): Promise<boolean>;
}

export interface AssignRoleModalProps {
  role: Role;
  onClose: () => void;
  onAssign: () => void;
  apiClient: RbacApiClient;
  toast: Toast;
  logger: Logger;
  useConfirmDialog: () => RbacConfirmDialogFn;
}

// ============================================================================
// Component
// ============================================================================

export default function AssignRoleModal({
  role,
  onClose,
  onAssign,
  apiClient,
  toast,
  logger,
  useConfirmDialog,
}: AssignRoleModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<(User & UserRoleAssignment)[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get("/users");
      if (response.data) {
        setUsers(response.data as User[]);
      }
    } catch (error) {
      logger.error(
        "Error fetching users",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast.error("Failed to load users");
    }
  }, [apiClient, logger, toast]);

  const fetchRoleAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/auth/rbac/roles/${role.name}/users`);
      if (response.data) {
        setAssignedUsers(response.data as (User & UserRoleAssignment)[]);
      }
    } catch (error) {
      logger.error(
        "Error fetching role assignments",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setLoading(false);
    }
  }, [role.name, apiClient, logger]);

  useEffect(() => {
    fetchUsers();
    fetchRoleAssignments();
  }, [fetchUsers, fetchRoleAssignments]);

  const handleAssignRole = useCallback(async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setAssigning(true);
    try {
      const assignments = Array.from(selectedUsers).map(async (userId) => {
        const assignData = {
          user_id: userId,
          role_name: role.name,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        };

        return apiClient.post("/auth/rbac/users/assign-role", assignData);
      });

      const results = await Promise.all(assignments);
      const failed = results.filter((r) => r.status < 200 || r.status >= 300);

      if (failed.length === 0) {
        toast.success(`Role assigned to ${selectedUsers.size} user(s)`);
        setSelectedUsers(new Set());
        setExpiresAt("");
        fetchRoleAssignments();
        onAssign();
      } else {
        toast.error(`Failed to assign role to ${failed.length} user(s)`);
      }
    } catch (error) {
      logger.error(
        "Error assigning role",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast.error("Failed to assign role");
    } finally {
      setAssigning(false);
    }
  }, [
    selectedUsers,
    role.name,
    expiresAt,
    onAssign,
    fetchRoleAssignments,
    apiClient,
    toast,
    logger,
  ]);

  const confirmDialog = useConfirmDialog();

  const handleRevokeRole = useCallback(
    async (userId: string) => {
      const confirmed = await confirmDialog({
        title: "Revoke role assignment",
        description: "Are you sure you want to revoke this role assignment?",
        confirmText: "Revoke",
        variant: "destructive",
      });
      if (!confirmed) {
        return;
      }

      try {
        const response = await apiClient.post("/auth/rbac/users/revoke-role", {
          user_id: userId,
          role_name: role.name,
        });

        if (response.status >= 200 && response.status < 300) {
          toast.success("Role revoked successfully");
          fetchRoleAssignments();
          onAssign();
        } else {
          toast.error("Failed to revoke role");
        }
      } catch (error) {
        logger.error(
          "Error revoking role",
          error instanceof Error ? error : new Error(String(error)),
        );
        toast.error("Failed to revoke role");
      }
    },
    [role.name, onAssign, fetchRoleAssignments, confirmDialog, apiClient, toast, logger],
  );

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Filter users that don't already have this role and match search
  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));
  const availableUsers = users.filter(
    (user) =>
      !assignedUserIds.has(user.id) &&
      user.is_active &&
      (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-sky-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">Assign Role</h2>
              <p className="text-sm text-slate-400">
                Assign &quot;{role.display_name}&quot; role to users
              </p>
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
          {/* Currently Assigned Users */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Currently Assigned ({assignedUsers.length})
            </h3>
            {loading ? (
              <div className="text-slate-400">Loading assignments...</div>
            ) : assignedUsers.length === 0 ? (
              <div className="text-slate-400 text-center py-4">
                No users currently have this role
              </div>
            ) : (
              <div className="space-y-2">
                {assignedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {(user.full_name || user.username)?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.full_name || user.username}</p>
                        <p className="text-slate-400 text-sm">{user.email}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                          <span>Assigned: {new Date(user.granted_at).toLocaleDateString()}</span>
                          {user.expires_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires: {new Date(user.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeRole(user.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      title="Revoke role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign New Users */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Assign to New Users</h3>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Expiration Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Available Users */}
            <div className="space-y-2">
              {availableUsers.length === 0 ? (
                <div className="text-slate-400 text-center py-4">
                  {searchQuery
                    ? "No users match your search"
                    : "All active users already have this role"}
                </div>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUsers.has(user.id)
                        ? "bg-sky-500/20 border border-sky-500/50"
                        : "bg-slate-700/50 hover:bg-slate-700"
                    }`}
                    onClick={() => toggleUserSelection(user.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {(user.full_name || user.username)?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{user.full_name || user.username}</p>
                      <p className="text-slate-400 text-sm">{user.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="text-sm text-slate-400">{selectedUsers.size} user(s) selected</div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignRole}
              disabled={assigning || selectedUsers.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {assigning
                ? "Assigning..."
                : `Assign Role ${selectedUsers.size > 0 ? `(${selectedUsers.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
