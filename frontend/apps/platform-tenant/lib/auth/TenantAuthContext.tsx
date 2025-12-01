"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  getTenantToken,
  setTenantToken,
  setTenantRefreshToken,
  clearTenantTokens,
  isTenantAuthenticated,
} from "./token-utils";
import { tenantAppConfig } from "../config";

interface TenantUser {
  id: string;
  email: string;
  tenant_id: string;
  tenant_name: string;
  role: string;
  plan?: string;
}

interface TenantAuthContextType {
  user: TenantUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const TenantAuthContext = createContext<TenantAuthContextType | null>(null);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    const token = getTenantToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        tenantAppConfig.api.buildUrl("/auth/tenant/me"),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        clearTenantTokens();
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch tenant user:", error);
      clearTenantTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          tenantAppConfig.api.buildUrl("/auth/tenant/login"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Login failed");
        }

        const data = await response.json();
        setTenantToken(data.access_token);
        if (data.refresh_token) {
          setTenantRefreshToken(data.refresh_token);
        }

        await fetchCurrentUser();
        router.push("/portal");
      } catch (error) {
        setIsLoading(false);
        throw error;
      }
    },
    [router, fetchCurrentUser]
  );

  const logout = useCallback(async () => {
    try {
      const token = getTenantToken();
      if (token) {
        await fetch(tenantAppConfig.api.buildUrl("/auth/tenant/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      }
    } finally {
      clearTenantTokens();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const refreshAuth = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <TenantAuthContext.Provider
      value={{
        user,
        isAuthenticated: isTenantAuthenticated() && !!user,
        isLoading,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error("useTenantAuth must be used within a TenantAuthProvider");
  }
  return context;
}
