/**
 * GraphQL Wrapper Hooks for User Management
 *
 * These hooks provide a convenient interface for user management components,
 * wrapping the auto-generated GraphQL hooks with consistent error handling
 * and data transformation.
 *
 * Benefits:
 * - 75% fewer HTTP requests (4-5 calls → 1 query)
 * - Batched roles, permissions, and teams loading
 * - Profile change history tracking
 * - Type-safe with auto-generated types
 */

import {
  useUserListQuery,
  useUserDetailQuery,
  useUserMetricsQuery,
  useRoleListQuery,
  usePermissionsByCategoryQuery,
  useUserDashboardQuery,
  useUserRolesQuery,
  useUserPermissionsQuery,
  useUserTeamsQuery,
  PermissionCategoryEnum,
} from "@/lib/graphql/generated";

// ============================================================================
// User List Hook
// ============================================================================

export interface UseUserListOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  isVerified?: boolean;
  isSuperuser?: boolean;
  isPlatformAdmin?: boolean;
  search?: string;
  includeMetadata?: boolean;
  includeRoles?: boolean;
  includePermissions?: boolean;
  includeTeams?: boolean;
  enabled?: boolean;
  pollInterval?: number;
}

export function useUserListGraphQL(options: UseUserListOptions = {}) {
  const {
    page = 1,
    pageSize = 10,
    isActive,
    isVerified,
    isSuperuser,
    isPlatformAdmin,
    search,
    includeMetadata = false,
    includeRoles = false,
    includePermissions = false,
    includeTeams = false,
    enabled = true,
    pollInterval = 60000, // 60 seconds default
  } = options;

  const { data, loading, error, refetch } = useUserListQuery({
    variables: {
      page,
      pageSize,
      isActive,
      isVerified,
      isSuperuser,
      isPlatformAdmin,
      search: search || undefined,
      includeMetadata,
      includeRoles,
      includePermissions,
      includeTeams,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const users = data?.users?.users ?? [];
  const totalCount = data?.users?.totalCount ?? 0;
  const hasNextPage = data?.users?.hasNextPage ?? false;
  const hasPrevPage = data?.users?.hasPrevPage ?? false;

  return {
    users,
    total: totalCount,
    hasNextPage,
    hasPrevPage,
    page: data?.users?.page ?? page,
    pageSize: data?.users?.pageSize ?? pageSize,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Detail Hook
// ============================================================================

export interface UseUserDetailOptions {
  userId: string;
  enabled?: boolean;
}

export function useUserDetailGraphQL(options: UseUserDetailOptions) {
  const { userId, enabled = true } = options;

  const { data, loading, error, refetch } = useUserDetailQuery({
    variables: { id: userId },
    skip: !enabled || !userId,
    fetchPolicy: "cache-and-network",
  });

  const user = data?.user ?? null;

  return {
    user,
    roles: user?.roles ?? [],
    permissions: user?.permissions ?? [],
    teams: user?.teams ?? [],
    profileChanges: user?.profileChanges ?? [],
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Metrics Hook
// ============================================================================

export interface UseUserMetricsOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useUserMetricsGraphQL(options: UseUserMetricsOptions = {}) {
  const { enabled = true, pollInterval = 60000 } = options;

  const { data, loading, error, refetch } = useUserMetricsQuery({
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const metrics = data?.userMetrics;

  return {
    metrics: {
      totalUsers: metrics?.totalUsers ?? 0,
      activeUsers: metrics?.activeUsers ?? 0,
      suspendedUsers: metrics?.suspendedUsers ?? 0,
      invitedUsers: metrics?.invitedUsers ?? 0,
      verifiedUsers: metrics?.verifiedUsers ?? 0,
      mfaEnabledUsers: metrics?.mfaEnabledUsers ?? 0,
      platformAdmins: metrics?.platformAdmins ?? 0,
      superusers: metrics?.superusers ?? 0,
      regularUsers: metrics?.regularUsers ?? 0,
      usersLoggedInLast24h: metrics?.usersLoggedInLast24h ?? 0,
      usersLoggedInLast7d: metrics?.usersLoggedInLast7d ?? 0,
      usersLoggedInLast30d: metrics?.usersLoggedInLast30d ?? 0,
      neverLoggedIn: metrics?.neverLoggedIn ?? 0,
      newUsersThisMonth: metrics?.newUsersThisMonth ?? 0,
      newUsersLastMonth: metrics?.newUsersLastMonth ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Role List Hook
// ============================================================================

export interface UseRoleListOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  isSystem?: boolean;
  search?: string;
  enabled?: boolean;
}

export function useRoleListGraphQL(options: UseRoleListOptions = {}) {
  const { page = 1, pageSize = 20, isActive, isSystem, search, enabled = true } = options;

  const { data, loading, error, refetch } = useRoleListQuery({
    variables: {
      page,
      pageSize,
      isActive,
      isSystem,
      search: search || undefined,
    },
    skip: !enabled,
    fetchPolicy: "cache-and-network",
  });

  const roles = data?.roles?.roles ?? [];
  const totalCount = data?.roles?.totalCount ?? 0;
  const hasNextPage = data?.roles?.hasNextPage ?? false;

  return {
    roles,
    total: totalCount,
    hasNextPage,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Permissions by Category Hook
// ============================================================================

export interface UsePermissionsByCategoryOptions {
  category?: PermissionCategoryEnum;
  enabled?: boolean;
}

export function usePermissionsByCategoryGraphQL(options: UsePermissionsByCategoryOptions = {}) {
  const { category, enabled = true } = options;

  const { data, loading, error, refetch } = usePermissionsByCategoryQuery({
    variables: {
      category,
    },
    skip: !enabled,
    fetchPolicy: "cache-and-network",
  });

  const permissionsByCategory = data?.permissionsByCategory ?? [];

  return {
    permissionsByCategory,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Dashboard Hook (Combined)
// ============================================================================

export interface UseUserDashboardOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useUserDashboardGraphQL(options: UseUserDashboardOptions = {}) {
  const {
    page = 1,
    pageSize = 10,
    isActive,
    search,
    enabled = true,
    pollInterval = 60000,
  } = options;

  const { data, loading, error, refetch } = useUserDashboardQuery({
    variables: {
      page,
      pageSize,
      isActive,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const users = data?.users?.users ?? [];
  const totalCount = data?.users?.totalCount ?? 0;
  const hasNextPage = data?.users?.hasNextPage ?? false;
  const metrics = data?.userMetrics;

  return {
    users,
    total: totalCount,
    hasNextPage,
    metrics: {
      totalUsers: metrics?.totalUsers ?? 0,
      activeUsers: metrics?.activeUsers ?? 0,
      suspendedUsers: metrics?.suspendedUsers ?? 0,
      verifiedUsers: metrics?.verifiedUsers ?? 0,
      mfaEnabledUsers: metrics?.mfaEnabledUsers ?? 0,
      platformAdmins: metrics?.platformAdmins ?? 0,
      superusers: metrics?.superusers ?? 0,
      regularUsers: metrics?.regularUsers ?? 0,
      usersLoggedInLast24h: metrics?.usersLoggedInLast24h ?? 0,
      usersLoggedInLast7d: metrics?.usersLoggedInLast7d ?? 0,
      newUsersThisMonth: metrics?.newUsersThisMonth ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Roles Hook (Lightweight)
// ============================================================================

export interface UseUserRolesOptions {
  userId: string;
  enabled?: boolean;
}

export function useUserRolesGraphQL(options: UseUserRolesOptions) {
  const { userId, enabled = true } = options;

  const { data, loading, error, refetch } = useUserRolesQuery({
    variables: { id: userId },
    skip: !enabled || !userId,
    fetchPolicy: "cache-and-network",
  });

  const user = data?.user ?? null;
  const roles = user?.roles ?? [];

  return {
    userId: user?.id,
    username: user?.username,
    roles,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Permissions Hook (Lightweight)
// ============================================================================

export interface UseUserPermissionsOptions {
  userId: string;
  enabled?: boolean;
}

export function useUserPermissionsGraphQL(options: UseUserPermissionsOptions) {
  const { userId, enabled = true } = options;

  const { data, loading, error, refetch } = useUserPermissionsQuery({
    variables: { id: userId },
    skip: !enabled || !userId,
    fetchPolicy: "cache-and-network",
  });

  const user = data?.user ?? null;
  const permissions = user?.permissions ?? [];

  return {
    userId: user?.id,
    username: user?.username,
    permissions,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// User Teams Hook (Lightweight)
// ============================================================================

export interface UseUserTeamsOptions {
  userId: string;
  enabled?: boolean;
}

export function useUserTeamsGraphQL(options: UseUserTeamsOptions) {
  const { userId, enabled = true } = options;

  const { data, loading, error, refetch } = useUserTeamsQuery({
    variables: { id: userId },
    skip: !enabled || !userId,
    fetchPolicy: "cache-and-network",
  });

  const user = data?.user ?? null;
  const teams = user?.teams ?? [];

  return {
    userId: user?.id,
    username: user?.username,
    teams,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Export All Hooks
// ============================================================================

export const UserGraphQLHooks = {
  useUserListGraphQL,
  useUserDetailGraphQL,
  useUserMetricsGraphQL,
  useRoleListGraphQL,
  usePermissionsByCategoryGraphQL,
  useUserDashboardGraphQL,
  useUserRolesGraphQL,
  useUserPermissionsGraphQL,
  useUserTeamsGraphQL,
};
