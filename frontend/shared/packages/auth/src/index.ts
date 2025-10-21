// Main exports
export { AuthProvider, useAuth, AuthContext } from "./AuthProvider";
export { SimpleAuthProvider } from "./providers/SimpleAuthProvider";
export { SecureAuthProvider } from "./providers/SecureAuthProvider";
export { EnterpriseAuthProvider } from "./providers/EnterpriseAuthProvider";

// Hooks
export { useAuthenticatedApi } from "./hooks/useAuthenticatedApi";

// Utilities
export {
  createAuthRequestInterceptor,
  createAuthResponseInterceptor,
} from "./utils/authInterceptors";

// Types
export type {
  AuthVariant,
  User,
  UserRole,
  Permission,
  LoginCredentials,
  AuthTokens,
  AuthConfig,
  PartialAuthConfig,
  AuthContextValue,
  AuthState,
  AuthActions,
  AuthStore,
  LoginResponse,
  RefreshTokenResponse,
  MFASetupResponse,
  SecurityEvent,
  SecurityEventType,
  AuthError,
  InvalidCredentialsError,
  AccountLockedError,
  SessionExpiredError,
  MFARequiredError,
  PermissionDeniedError,
  PortalType,
} from "./types";

// PortalType is now defined in types.ts
