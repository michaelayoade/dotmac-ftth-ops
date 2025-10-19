'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { authService, User } from '@/lib/api/services/auth.service';
import { logger } from '@/lib/logger';
import { apiClient } from '@/lib/api/client';

interface UserPermissions {
  effective_permissions?: Array<{ name: string }>;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  permissions: UserPermissions | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { email: string; password: string; name?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);

      // Skip auth check in E2E test mode
      if (typeof window !== 'undefined' && (window as any).__e2e_test__) {
        logger.info('AuthProvider: E2E test mode detected, skipping auth check');
        setUser({
          id: 'e2e-test-user',
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Test Admin'
        } as User);
        setPermissions({
          effective_permissions: []
        });
        setLoading(false);
        return;
      }

      console.log('[AuthProvider] Calling getCurrentUser...');
      const userData = await authService.getCurrentUser();
      console.log('[AuthProvider] getCurrentUser success:', !!userData);
      if (userData) {
        setUser(userData);

        // Store tenant ID in localStorage for API client interceptor
        if (userData.tenant_id) {
          localStorage.setItem('tenant_id', userData.tenant_id);
        }

        // Fetch user permissions from RBAC endpoint
        try {
          const permissionsResponse = await apiClient.get('/auth/rbac/my-permissions');
          setPermissions(permissionsResponse.data as UserPermissions);
          logger.info('User permissions loaded', {
            userId: userData.id,
            permissionCount: (permissionsResponse.data as UserPermissions)?.effective_permissions?.length || 0
          });
        } catch (permErr) {
          if (axios.isAxiosError(permErr) && permErr.response?.status === 403) {
            logger.warn('Permissions endpoint returned 403. Defaulting to empty permissions.');
            setPermissions({ effective_permissions: [] });
          } else {
            logger.error('Failed to fetch permissions', permErr instanceof Error ? permErr : new Error(String(permErr)));
          }
          // Continue even if permissions fail to load
        }
      } else {
        setUser(null);
        setPermissions(null);
        localStorage.removeItem('tenant_id');
      }
    } catch (err) {
      console.error('[AuthProvider] Auth check failed:', err);
      // Add detailed error logging
      if (err && typeof err === 'object') {
        console.error('[AuthProvider] Error details:', {
          message: (err as any).message,
          response: (err as any).response?.data,
          status: (err as any).response?.status,
          apiError: (err as any).apiError
        });
      }
      logger.error('Auth check failed', err instanceof Error ? err : new Error(String(err)));

      // Delay before clearing user state to allow reading error
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('[AuthProvider] Clearing user state after error...');

      setUser(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const authResponse = await authService.login({ username, password });

      if (authResponse && authResponse.user) {
        setUser(authResponse.user);

        // Store tenant ID in localStorage for API client interceptor
        if (authResponse.user.tenant_id) {
          localStorage.setItem('tenant_id', authResponse.user.tenant_id);
        }

        // Fetch permissions after successful login
        try {
          const permissionsResponse = await apiClient.get('/auth/rbac/my-permissions');
          setPermissions(permissionsResponse.data as UserPermissions);
          logger.info('User permissions loaded after login', {
            userId: authResponse.user.id,
            permissionCount: (permissionsResponse.data as UserPermissions)?.effective_permissions?.length || 0
          });
        } catch (permErr) {
          if (axios.isAxiosError(permErr) && permErr.response?.status === 403) {
            logger.warn('Permissions endpoint returned 403 after login. Defaulting to empty permissions.');
            setPermissions({ effective_permissions: [] });
          } else {
            logger.error('Failed to fetch permissions after login', permErr instanceof Error ? permErr : new Error(String(permErr)));
          }
        }

        // Small delay to ensure cookies are set before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push('/dashboard');
      } else {
        throw new Error('Login failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setUser(null);
      setPermissions(null);
      localStorage.removeItem('tenant_id');
      router.push('/login');
    } catch (err) {
      logger.error('Logout failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; name?: string }) => {
    try {
      setLoading(true);
      setError(null);

      await authService.register({
        email: data.email,
        password: data.password,
        name: data.name || ''
      });

      router.push('/login?registered=true');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        permissions,
        login,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push('/login');
      }
    }, [user, loading, router]);

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    if (!user) {
      return null;
    }

    return <Component {...props} />;
  };
}
