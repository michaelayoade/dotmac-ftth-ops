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
  getResellerToken,
  setResellerToken,
  setResellerRefreshToken,
  clearResellerTokens,
  isResellerAuthenticated,
} from "./token-utils";
import { resellerAppConfig } from "../config";

interface ResellerUser {
  id: string;
  email: string;
  partner_id: string;
  partner_name: string;
  role: string;
}

interface ResellerAuthContextType {
  user: ResellerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const ResellerAuthContext = createContext<ResellerAuthContextType | null>(null);

export function ResellerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ResellerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    const token = getResellerToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        resellerAppConfig.api.buildUrl("/auth/partner/me"),
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
        clearResellerTokens();
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch reseller user:", error);
      clearResellerTokens();
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
          resellerAppConfig.api.buildUrl("/auth/partner/login"),
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
        setResellerToken(data.access_token);
        if (data.refresh_token) {
          setResellerRefreshToken(data.refresh_token);
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
      const token = getResellerToken();
      if (token) {
        await fetch(resellerAppConfig.api.buildUrl("/auth/partner/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      }
    } finally {
      clearResellerTokens();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const refreshAuth = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <ResellerAuthContext.Provider
      value={{
        user,
        isAuthenticated: isResellerAuthenticated() && !!user,
        isLoading,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </ResellerAuthContext.Provider>
  );
}

export function useResellerAuth() {
  const context = useContext(ResellerAuthContext);
  if (!context) {
    throw new Error(
      "useResellerAuth must be used within a ResellerAuthProvider"
    );
  }
  return context;
}
