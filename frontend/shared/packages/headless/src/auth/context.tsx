import * as React from "react";

import type { AuthContext as AuthState, LoginFlow, PortalConfig } from "../types/auth";
import type { Tenant, User } from "../types";

export interface ExtendedAuthState extends AuthState {
  sessionId?: string;
  tenantId?: string;
  loginFlow?: LoginFlow;
  setAuthState: (updates: Partial<ExtendedAuthState>) => void;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  value?: Partial<ExtendedAuthState>;
}

const defaultAuthState: ExtendedAuthState = {
  user: null,
  portal: null,
  tenant: null,
  permissions: [],
  roles: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,
  setAuthState: () => {},
};

const AuthContext = React.createContext<ExtendedAuthState>(defaultAuthState);

export function AuthProvider({ children, value }: AuthProviderProps): JSX.Element {
  const [state, setState] = React.useState<ExtendedAuthState>({
    ...defaultAuthState,
    ...value,
  });

  const setAuthState = React.useCallback((updates: Partial<ExtendedAuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      ...state,
      setAuthState,
    }),
    [state, setAuthState],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): ExtendedAuthState {
  return React.useContext(AuthContext);
}

export type { AuthState, PortalConfig, Tenant, User };
