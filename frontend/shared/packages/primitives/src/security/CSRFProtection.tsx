/**
 * CSRF Protection Component
 * Provides CSRF token management and validation
 */

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface CSRFContextValue {
  token: string | null;
  generateToken: () => string;
  validateToken: (token: string) => boolean;
  refreshToken: () => void;
}

const CSRFContext = createContext<CSRFContextValue | null>(null);

interface CSRFProviderProps {
  children: ReactNode;
  endpoint?: string; // API endpoint to get server-side CSRF token
}

// Generate a cryptographically secure token
const generateSecureToken = (): string => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments without crypto.getRandomValues
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
};

export function CSRFProvider({ children, endpoint }: CSRFProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverToken, setServerToken] = useState<string | null>(null);

  // Fetch server-side CSRF token if endpoint provided
  useEffect(() => {
    const fetchServerToken = async () => {
      if (!endpoint) return;

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setServerToken(data.token);
        }
      } catch (error) {
        console.warn("Failed to fetch server CSRF token:", error);
      }
    };

    fetchServerToken();
  }, [endpoint]);

  // Generate initial client token
  useEffect(() => {
    const initialToken = generateSecureToken();
    setToken(initialToken);

    // Store in session storage for validation
    sessionStorage.setItem("csrf-token", initialToken);

    // Set up cleanup
    return () => {
      sessionStorage.removeItem("csrf-token");
    };
  }, []);

  const generateToken = (): string => {
    const newToken = generateSecureToken();
    setToken(newToken);
    sessionStorage.setItem("csrf-token", newToken);
    return newToken;
  };

  const validateToken = (tokenToValidate: string): boolean => {
    // Check against both client and server tokens
    const storedToken = sessionStorage.getItem("csrf-token");
    return (
      tokenToValidate === storedToken || (serverToken !== null && tokenToValidate === serverToken)
    );
  };

  const refreshToken = () => {
    generateToken();
  };

  const contextValue: CSRFContextValue = {
    token: serverToken ?? token,
    generateToken,
    validateToken,
    refreshToken,
  };

  return <CSRFContext.Provider value={contextValue}>{children}</CSRFContext.Provider>;
}

export function useCSRF(): CSRFContextValue {
  const context = useContext(CSRFContext);
  if (!context) {
    throw new Error("useCSRF must be used within a CSRFProvider");
  }
  return context;
}

// CSRF Token Input Component
interface CSRFTokenProps {
  name?: string;
  hidden?: boolean;
}

export function CSRFToken({ name = "csrf_token", hidden = true }: CSRFTokenProps) {
  const { token } = useCSRF();

  if (!token) return null;

  return <input type={hidden ? "hidden" : "text"} name={name} value={token} readOnly />;
}

// Higher-order component for CSRF protection
export function withCSRFProtection<P extends object>(Component: React.ComponentType<P>) {
  return function CSRFProtectedComponent(props: P) {
    return (
      <CSRFProvider>
        <Component {...props} />
      </CSRFProvider>
    );
  };
}

// Hook for secure fetch with CSRF protection
export function useSecureFetch() {
  const { token, validateToken } = useCSRF();

  const secureFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (!token) {
      throw new Error("CSRF token not available");
    }

    const headers = new Headers(options.headers);
    headers.set("X-CSRF-Token", token);
    headers.set("Content-Type", "application/json");

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for session-based CSRF
    });

    // Validate response for potential CSRF attacks
    const responseToken = response.headers.get("X-CSRF-Token");
    if (responseToken && !validateToken(responseToken)) {
      throw new Error("CSRF token validation failed");
    }

    return response;
  };

  return { secureFetch, token };
}
