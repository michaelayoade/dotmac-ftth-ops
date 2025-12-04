/**
 * React Query hooks for user management
 *
 * Connects to backend user management API:
 * - GET /api/v1/users - List all users
 * - GET /api/v1/users/{id} - Get user details
 * - GET /api/v1/users/me - Current user
 * - PUT /api/v1/users/{id} - Update user
 * - DELETE /api/v1/users/{id} - Delete user
 * - POST /api/v1/users/{id}/disable - Disable user
 * - POST /api/v1/users/{id}/enable - Enable user
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

// ============================================
// Types matching backend user_management models
// ============================================

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  is_platform_admin: boolean;
  roles: string[];
  permissions: string[];
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  tenant_id: string;
  phone_number: string | null;
  avatar_url: string | null;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserUpdateRequest {
  full_name?: string;
  phone_number?: string;
  is_active?: boolean;
  is_verified?: boolean;
  is_superuser?: boolean;
  roles?: string[];
  permissions?: string[];
}

// ============================================
// Query Hooks
// ============================================

type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all users
 */
export function useUsers(options?: QueryOptions<User[], ["users"]>) {
  return useQuery<User[], Error, User[], ["users"]>({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await apiClient.get<UserListResponse>("/users");
      const payload = extractDataOrThrow(response, "Failed to load users");
      return payload.users;
    },
    ...options,
  });
}

/**
 * Fetch single user by ID
 */
export function useUser(userId: string, options?: QueryOptions<User, ["users", string]>) {
  return useQuery<User, Error, User, ["users", string]>({
    queryKey: ["users", userId],
    queryFn: async () => {
      const response = await apiClient.get<User>(`/users/${userId}`);
      return extractDataOrThrow(response, "Failed to load user");
    },
    enabled: !!userId,
    ...options,
  });
}

/**
 * Get current authenticated user
 */
export function useCurrentUser(options?: QueryOptions<User, ["users", "me"]>) {
  return useQuery<User, Error, User, ["users", "me"]>({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const response = await apiClient.get<User>("/users/me");
      return extractDataOrThrow(response, "Failed to load current user");
    },
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Update user details
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UserUpdateRequest }) => {
      const response = await apiClient.put<User>(`/users/${userId}`, data);
      return extractDataOrThrow(response, "Failed to update user");
    },
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", data.id] });

      toast({
        title: "User updated",
        description: `${data.full_name || data.username} was updated successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.response?.data?.detail || "Failed to update user",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.delete(`/users/${userId}`);
      // Check for successful status codes (2xx)
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to delete user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: "User deleted",
        description: "User was removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.response?.data?.detail || "Failed to delete user",
        variant: "destructive",
      });
    },
  });
}

/**
 * Disable user account
 */
export function useDisableUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post(`/users/${userId}/disable`);
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to disable user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: "User disabled",
        description: "User account has been disabled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disable failed",
        description: error.response?.data?.detail || "Failed to disable user",
        variant: "destructive",
      });
    },
  });
}

/**
 * Enable user account
 */
export function useEnableUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post(`/users/${userId}/enable`);
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to enable user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: "User enabled",
        description: "User account has been enabled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enable failed",
        description: error.response?.data?.detail || "Failed to enable user",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get user display name
 */
export function getUserDisplayName(user: User): string {
  return user.full_name || user.username || user.email;
}

/**
 * Get user status
 */
export function getUserStatus(user: User): "Active" | "Suspended" | "Invited" {
  if (!user.is_active) return "Suspended";
  if (!user.is_verified) return "Invited";
  return "Active";
}

/**
 * Get user primary role
 */
export function getUserPrimaryRole(user: User): string {
  if (user.is_platform_admin) return "Platform Admin";
  if (user.is_superuser) return "Superuser";
  if (user.roles && user.roles.length > 0) {
    // Capitalize first letter
    const primaryRole = user.roles[0];
    if (primaryRole) {
      return primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1);
    }
  }
  return "User";
}

/**
 * Format last seen timestamp
 */
export function formatLastSeen(lastLogin: string | null): string {
  if (!lastLogin) return "Never";

  const date = new Date(lastLogin);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}
