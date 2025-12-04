"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  clearPortalAuthToken,
  CUSTOMER_PORTAL_REFRESH_TOKEN_KEY,
  CUSTOMER_PORTAL_TOKEN_KEY,
  getPortalAuthToken,
  setPortalAuthToken,
} from "../../../../shared/utils/operatorAuth";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";

const buildApiUrl = platformConfig.api.buildUrl;

// ============================================================================
// Types
// ============================================================================

interface CustomerUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  account_number: string;
  phone?: string;
}

interface CustomerAuthContextType {
  user: CustomerUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ============================================================================
// Context
// ============================================================================

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getPortalAuthToken({
          tokenKey: CUSTOMER_PORTAL_TOKEN_KEY,
          required: false,
        });

        if (!token) {
          setLoading(false);
          return;
        }

        // Verify token and get user info
        const response = await fetch(buildApiUrl("/customer/profile"), {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser({
            id: data.id,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            account_number: data.account_number,
            phone: data.phone,
          });
        } else {
          // Token is invalid, clear it
          clearPortalAuthToken(CUSTOMER_PORTAL_TOKEN_KEY);
          clearPortalAuthToken(CUSTOMER_PORTAL_REFRESH_TOKEN_KEY);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        clearPortalAuthToken(CUSTOMER_PORTAL_TOKEN_KEY);
        clearPortalAuthToken(CUSTOMER_PORTAL_REFRESH_TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl("/auth/customer/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();

      // Store access token (refresh tokens remain server-side for safety)
      setPortalAuthToken(data.access_token ?? null, CUSTOMER_PORTAL_TOKEN_KEY);
      clearPortalAuthToken(CUSTOMER_PORTAL_REFRESH_TOKEN_KEY);

      // Set user data
      setUser({
        id: data.user.id,
        email: data.user.email,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        account_number: data.user.account_number,
        phone: data.user.phone,
      });

      // Redirect to dashboard
      router.push("/customer-portal");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred during login";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Clear tokens
    clearPortalAuthToken(CUSTOMER_PORTAL_TOKEN_KEY);
    clearPortalAuthToken(CUSTOMER_PORTAL_REFRESH_TOKEN_KEY);
    clearPortalAuthToken(); // default key cleanup
    // Clear any stray auth artifacts
    try {
      localStorage.removeItem("customer_access_token");
      localStorage.removeItem("customer_refresh_token");
    } catch {
      // Ignore storage errors
    }

    // Attempt server-side logout to invalidate refresh tokens (best-effort)
    try {
      await fetch(buildApiUrl("/auth/customer/logout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      toast({
        title: "Signed out",
        description: "You have been logged out of the customer portal.",
      });
    } catch {
      toast({
        title: "Signed out locally",
        description: "Network issue while logging out from the server.",
        variant: "destructive",
      });
    }

    // Clear user state
    setUser(null);

    // Redirect to login
    router.push("/customer-portal/login");
  };

  const value: CustomerAuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}

// ============================================================================
// Protected Route Component
// ============================================================================

export function CustomerProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/customer-portal/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
