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
  getPartnerToken,
  setPartnerToken,
  setPartnerRefreshToken,
  clearPartnerTokens,
  isPartnerAuthenticated,
} from "./token-utils";
import { platformResellerConfig } from "../config";

interface PartnerUser {
  id: string;
  email: string;
  partner_id: string;
  partner_name: string;
  company_name: string;
  role: string;
  tier: string;
}

interface PartnerAuthContextType {
  user: PartnerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const PartnerAuthContext = createContext<PartnerAuthContextType | null>(null);

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    const token = getPartnerToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        platformResellerConfig.api.buildUrl("/auth/partner/me"),
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
        clearPartnerTokens();
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch partner user:", error);
      clearPartnerTokens();
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
          platformResellerConfig.api.buildUrl("/auth/partner/login"),
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
        setPartnerToken(data.access_token);
        if (data.refresh_token) {
          setPartnerRefreshToken(data.refresh_token);
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
      const token = getPartnerToken();
      if (token) {
        await fetch(platformResellerConfig.api.buildUrl("/auth/partner/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      }
    } finally {
      clearPartnerTokens();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const refreshAuth = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <PartnerAuthContext.Provider
      value={{
        user,
        isAuthenticated: isPartnerAuthenticated() && !!user,
        isLoading,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  const context = useContext(PartnerAuthContext);
  if (!context) {
    throw new Error("usePartnerAuth must be used within a PartnerAuthProvider");
  }
  return context;
}
