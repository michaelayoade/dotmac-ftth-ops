"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Edit,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface User {
  user_id: string;
  username: string;
  email: string;
  full_name?: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    roles: ["user"] as string[],
  });
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({
    show: false,
    message: "",
    type: "success",
  });
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/users`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data);
      } else if (response.status === 401) {
        window.location.href = "/login";
      } else {
        console.error("Failed to fetch users:", response.status);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((t) => ({ ...t, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast.show]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (roles: string[]) => {
    if (roles.includes("admin"))
      return "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400";
    if (roles.includes("moderator"))
      return "bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400";
    if (roles.includes("user"))
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400";
    return "bg-muted text-muted-foreground";
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? "bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400"
      : "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400";
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: newUserData.username,
          email: newUserData.email,
          full_name: newUserData.full_name,
          password: newUserData.password,
          roles: newUserData.roles,
        }),
      });

      if (response.ok) {
        showToast("User created successfully!", "success");
        setShowCreateModal(false);
        setNewUserData({
          username: "",
          email: "",
          full_name: "",
          password: "",
          roles: ["user"],
        });
        await fetchUsers();
      } else if (response.status === 401) {
        window.location.href = "/login";
      } else {
        const error = await response.json();
        showToast(error.detail || "Failed to create user", "error");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      showToast("Error creating user", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts, roles, and permissions</p>
        </div>
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Administrators</p>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.roles.includes("admin")).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Recent Logins</p>
              <p className="text-2xl font-bold text-foreground">
                {
                  users.filter((u) => {
                    if (!u.last_login) return false;
                    const lastLogin = new Date(u.last_login);
                    const now = new Date();
                    const daysDiff = (now.getTime() - lastLogin.getTime()) / (1000 * 3600 * 24);
                    return daysDiff <= 7;
                  }).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg shadow">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 w-full border border-border rounded-md bg-background text-foreground focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-blue-500 focus:border-blue-500"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="moderator">Moderators</option>
              <option value="user">Users</option>
              <option value="guest">Guests</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-accent">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr key={user.user_id} className="hover:bg-accent">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/20 flex items-center justify-center">
                          <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          {user.email}
                        </div>
                        {user.full_name && (
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.is_active)}`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor([role])}`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {user.last_login ? (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {new Date(user.last_login).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No users found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by adding your first user"}
              </p>
              {!searchQuery && roleFilter === "all" && (
                <div className="mt-6">
                  <button
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600/50 dark:bg-black/50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-border w-full max-w-md shadow-lg rounded-md bg-card">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-foreground">Create New User</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUserData({
                      username: "",
                      email: "",
                      full_name: "",
                      password: "",
                      roles: ["user"],
                    });
                  }}
                  className="text-muted-foreground hover:text-muted-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="johndoe"
                    value={newUserData.username}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        username: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="john.doe@example.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newUserData.full_name}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newUserData.password}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        password: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Roles</label>
                  <div className="space-y-2">
                    {["user", "moderator", "admin"].map((role) => (
                      <label key={role} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newUserData.roles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserData({
                                ...newUserData,
                                roles: [...newUserData.roles, role],
                              });
                            } else {
                              setNewUserData({
                                ...newUserData,
                                roles: newUserData.roles.filter((r) => r !== role),
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 border-border rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-foreground capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUserData({
                      username: "",
                      email: "",
                      full_name: "",
                      password: "",
                      roles: ["user"],
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={
                    !newUserData.username ||
                    !newUserData.email ||
                    !newUserData.password ||
                    newUserData.roles.length === 0
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`flex items-center p-4 rounded-md shadow-lg ${
              toast.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            } border`}
          >
            <div
              className={`flex-shrink-0 ${
                toast.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {toast.type === "success" ? (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p
                className={`text-sm font-medium ${
                  toast.type === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <RouteGuard permission="users.read">
      <UsersPageContent />
    </RouteGuard>
  );
}
