/**
 * User Service
 * Interfaces with DotMac backend to fetch user and tenant data
 */

import type { User, PortalType } from "../types";

// This would typically interface with your backend API
// For now, using a mock database that could be replaced with real DB calls

export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  permissions: string[];
  tenant_id: string;
  portal_id?: string;
  metadata?: Record<string, any>;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface DbTenant {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, any>;
  is_active: boolean;
}

// Mock database - replace with real database connections
const mockUsers: DbUser[] = [
  {
    id: "user-123",
    email: "admin@dotmac.com",
    name: "Admin User",
    role: "admin",
    permissions: ["users:read", "users:write", "billing:read", "system:admin"],
    tenant_id: "tenant-1",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-456",
    email: "customer@example.com",
    name: "John Customer",
    role: "customer",
    permissions: ["billing:read", "tickets:create"],
    tenant_id: "tenant-1",
    portal_id: "customer-portal-123",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-789",
    email: "reseller@partner.com",
    name: "Jane Reseller",
    role: "reseller",
    permissions: ["customers:read", "customers:create", "billing:read", "reports:read"],
    tenant_id: "tenant-2",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-101112",
    email: "tech@field.com",
    name: "Bob Technician",
    role: "technician",
    permissions: ["tickets:read", "tickets:update", "network:read"],
    tenant_id: "tenant-1",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

const mockTenants: DbTenant[] = [
  {
    id: "tenant-1",
    name: "DotMac ISP",
    domain: "dotmac.com",
    settings: {
      maxUsers: 1000,
      features: ["billing", "support", "analytics"],
    },
    is_active: true,
  },
  {
    id: "tenant-2",
    name: "Partner ISP",
    domain: "partner.com",
    settings: {
      maxUsers: 500,
      features: ["reseller", "billing"],
    },
    is_active: true,
  },
];

export class UserService {
  /**
   * Get user by ID and tenant ID
   */
  static async getUserById(userId: string, tenantId: string): Promise<User | null> {
    try {
      // In production, this would be a database query
      // SELECT * FROM users WHERE id = ? AND tenant_id = ? AND is_active = true
      const dbUser = mockUsers.find(
        (u) => u.id === userId && u.tenant_id === tenantId && u.is_active,
      );

      if (!dbUser) return null;

      return this.mapDbUserToUser(dbUser);
    } catch (error) {
      console.error("Failed to get user by ID:", error);
      return null;
    }
  }

  /**
   * Get user by email and portal type
   */
  static async getUserByEmail(
    email: string,
    portalType: PortalType,
    tenantId?: string,
  ): Promise<User | null> {
    try {
      // In production: SELECT * FROM users WHERE email = ? AND (tenant_id = ? OR portal_type = ?) AND is_active = true
      let dbUser = mockUsers.find((u) => u.email === email && u.is_active);

      // Filter by tenant if specified
      if (tenantId) {
        dbUser = mockUsers.find(
          (u) => u.email === email && u.tenant_id === tenantId && u.is_active,
        );
      }

      if (!dbUser) return null;

      return this.mapDbUserToUser(dbUser);
    } catch (error) {
      console.error("Failed to get user by email:", error);
      return null;
    }
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: string, tenantId: string): Promise<void> {
    try {
      // In production: UPDATE users SET last_login_at = NOW() WHERE id = ? AND tenant_id = ?
      const userIndex = mockUsers.findIndex((u) => u.id === userId && u.tenant_id === tenantId);
      if (userIndex !== -1) {
        mockUsers[userIndex].last_login_at = new Date().toISOString();
        mockUsers[userIndex].updated_at = new Date().toISOString();
      }
    } catch (error) {
      console.error("Failed to update last login:", error);
    }
  }

  /**
   * Get tenant information
   */
  static async getTenant(tenantId: string): Promise<DbTenant | null> {
    try {
      // In production: SELECT * FROM tenants WHERE id = ? AND is_active = true
      return mockTenants.find((t) => t.id === tenantId && t.is_active) || null;
    } catch (error) {
      console.error("Failed to get tenant:", error);
      return null;
    }
  }

  /**
   * Verify user credentials for login
   */
  static async verifyCredentials(
    email: string,
    password: string,
    portalType: PortalType,
  ): Promise<User | null> {
    try {
      // In production, this would hash the password and compare with stored hash
      // For demo purposes, accept any password
      if (!email || !password) return null;

      return this.getUserByEmail(email, portalType);
    } catch (error) {
      console.error("Failed to verify credentials:", error);
      return null;
    }
  }

  /**
   * Map database user to application User type
   */
  private static mapDbUserToUser(dbUser: DbUser): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatar: dbUser.avatar,
      role: dbUser.role as any, // Type assertion - in production, ensure role enum matching
      permissions: dbUser.permissions as any[], // Type assertion for permissions enum
      tenantId: dbUser.tenant_id,
      portalId: dbUser.portal_id,
      metadata: dbUser.metadata || {},
      lastLoginAt: dbUser.last_login_at ? new Date(dbUser.last_login_at) : undefined,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
    };
  }

  /**
   * Check if user has specific permission
   */
  static userHasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission as any);
  }

  /**
   * Check if user has any of the specified roles
   */
  static userHasRole(user: User, roles: string[]): boolean {
    return roles.includes(user.role);
  }
}
