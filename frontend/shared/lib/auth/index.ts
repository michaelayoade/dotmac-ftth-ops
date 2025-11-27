/**
 * Auth Module
 *
 * Main entry point for authentication functionality.
 * Provides JWT cookie-based authentication with the FastAPI backend.
 */

// Context and hooks
export { AuthProvider, useAuth, useSession, AuthContext } from "./AuthContext";

// Services
export {
  login,
  logout,
  verify2FA,
  getCurrentUser,
  refreshToken,
  TwoFactorRequiredError,
} from "./loginService";

export {
  requestPasswordReset,
  confirmPasswordReset,
  type PasswordResetResult,
} from "./passwordService";

// Bypass utilities
export { isAuthBypassEnabled, MOCK_USER, MOCK_ACTIVE_ORGANIZATION, getMockUser } from "./bypass";

// Interceptor
export { setupRefreshInterceptor, defaultAuthFailureHandler } from "./refreshInterceptor";

// Types
export type {
  UserInfo,
  ActiveOrganization,
  LoginRequest,
  LoginResponse,
  LoginResult,
  TwoFactorVerifyRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  AuthState,
  AuthActions,
  AuthContextValue,
} from "./types";

// Re-export ExtendedUser as alias for UserInfo (legacy compatibility)
export type { UserInfo as ExtendedUser } from "./types";
