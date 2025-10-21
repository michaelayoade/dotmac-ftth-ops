/**
 * @jest-environment jsdom
 */
import {
  User,
  UserRole,
  Permission,
  AuthError,
  InvalidCredentialsError,
  AccountLockedError,
  SessionExpiredError,
  MFARequiredError,
  PermissionDeniedError,
  SecurityEventType,
  PortalType,
  AuthVariant,
  LoginCredentials,
  AuthTokens,
  AuthConfig,
} from "../types";

describe("Auth Types", () => {
  describe("UserRole Enum", () => {
    it("has all expected role values", () => {
      expect(UserRole.SUPER_ADMIN).toBe("super_admin");
      expect(UserRole.MASTER_ADMIN).toBe("master_admin");
      expect(UserRole.TENANT_ADMIN).toBe("tenant_admin");
      expect(UserRole.MANAGER).toBe("manager");
      expect(UserRole.AGENT).toBe("agent");
      expect(UserRole.CUSTOMER).toBe("customer");
      expect(UserRole.RESELLER).toBe("reseller");
      expect(UserRole.TECHNICIAN).toBe("technician");
      expect(UserRole.READONLY).toBe("readonly");
    });

    it("contains all roles defined in type system", () => {
      const roleValues = Object.values(UserRole);
      expect(roleValues).toHaveLength(9);
      expect(roleValues).toContain("super_admin");
      expect(roleValues).toContain("customer");
      expect(roleValues).toContain("technician");
    });
  });

  describe("Permission Enum", () => {
    it("has user management permissions", () => {
      expect(Permission.USERS_READ).toBe("users:read");
      expect(Permission.USERS_CREATE).toBe("users:create");
      expect(Permission.USERS_UPDATE).toBe("users:update");
      expect(Permission.USERS_DELETE).toBe("users:delete");
    });

    it("has customer management permissions", () => {
      expect(Permission.CUSTOMERS_READ).toBe("customers:read");
      expect(Permission.CUSTOMERS_CREATE).toBe("customers:create");
      expect(Permission.CUSTOMERS_UPDATE).toBe("customers:update");
      expect(Permission.CUSTOMERS_DELETE).toBe("customers:delete");
    });

    it("has billing management permissions", () => {
      expect(Permission.BILLING_READ).toBe("billing:read");
      expect(Permission.BILLING_CREATE).toBe("billing:create");
      expect(Permission.BILLING_UPDATE).toBe("billing:update");
      expect(Permission.BILLING_DELETE).toBe("billing:delete");
    });

    it("has network management permissions", () => {
      expect(Permission.NETWORK_READ).toBe("network:read");
      expect(Permission.NETWORK_CREATE).toBe("network:create");
      expect(Permission.NETWORK_UPDATE).toBe("network:update");
      expect(Permission.NETWORK_DELETE).toBe("network:delete");
    });

    it("has system administration permissions", () => {
      expect(Permission.SYSTEM_ADMIN).toBe("system:admin");
      expect(Permission.SYSTEM_CONFIG).toBe("system:config");
      expect(Permission.SYSTEM_MONITOR).toBe("system:monitor");
    });

    it("has reports and analytics permissions", () => {
      expect(Permission.REPORTS_READ).toBe("reports:read");
      expect(Permission.REPORTS_CREATE).toBe("reports:create");
      expect(Permission.ANALYTICS_READ).toBe("analytics:read");
    });

    it("has support and tickets permissions", () => {
      expect(Permission.TICKETS_READ).toBe("tickets:read");
      expect(Permission.TICKETS_CREATE).toBe("tickets:create");
      expect(Permission.TICKETS_UPDATE).toBe("tickets:update");
      expect(Permission.TICKETS_DELETE).toBe("tickets:delete");
    });

    it("follows consistent naming pattern", () => {
      const permissions = Object.values(Permission);
      permissions.forEach((permission) => {
        expect(permission).toMatch(/^[a-z_]+:[a-z]+$/);
      });
    });
  });

  describe("SecurityEventType Enum", () => {
    it("has authentication event types", () => {
      expect(SecurityEventType.LOGIN_SUCCESS).toBe("login_success");
      expect(SecurityEventType.LOGIN_FAILURE).toBe("login_failure");
      expect(SecurityEventType.LOGIN_ATTEMPT).toBe("login_attempt");
      expect(SecurityEventType.LOGOUT).toBe("logout");
    });

    it("has token management event types", () => {
      expect(SecurityEventType.TOKEN_REFRESH).toBe("token_refresh");
      expect(SecurityEventType.TOKEN_EXPIRED).toBe("token_expired");
      expect(SecurityEventType.TOKEN_REFRESH_SUCCESS).toBe("token_refresh_success");
      expect(SecurityEventType.TOKEN_REFRESH_FAILED).toBe("token_refresh_failed");
    });

    it("has session management event types", () => {
      expect(SecurityEventType.SESSION_TIMEOUT).toBe("session_timeout");
      expect(SecurityEventType.SESSION_EXTENDED).toBe("session_extended");
      expect(SecurityEventType.INACTIVITY_WARNING).toBe("inactivity_warning");
      expect(SecurityEventType.SESSION_VALIDATION_FAILED).toBe("session_validation_failed");
    });

    it("has security event types", () => {
      expect(SecurityEventType.ACCOUNT_LOCKED).toBe("account_locked");
      expect(SecurityEventType.SUSPICIOUS_ACTIVITY).toBe("suspicious_activity");
      expect(SecurityEventType.PERMISSION_DENIED).toBe("permission_denied");
      expect(SecurityEventType.MFA_ENABLED).toBe("mfa_enabled");
      expect(SecurityEventType.MFA_DISABLED).toBe("mfa_disabled");
    });

    it("has profile management event types", () => {
      expect(SecurityEventType.PROFILE_LOADED).toBe("profile_loaded");
      expect(SecurityEventType.PROFILE_UPDATED).toBe("profile_updated");
      expect(SecurityEventType.PROFILE_UPDATE_FAILED).toBe("profile_update_failed");
      expect(SecurityEventType.PASSWORD_CHANGED).toBe("password_changed");
    });

    it("follows consistent naming pattern", () => {
      const eventTypes = Object.values(SecurityEventType);
      eventTypes.forEach((eventType) => {
        expect(eventType).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe("Type Definitions", () => {
    it("defines PortalType correctly", () => {
      const portals: PortalType[] = [
        "admin",
        "customer",
        "reseller",
        "technician",
        "management-admin",
        "management-reseller",
        "tenant-portal",
      ];
      expect(portals).toHaveLength(7);

      // TypeScript compilation ensures these are valid
      const adminPortal: PortalType = "admin";
      const customerPortal: PortalType = "customer";
      expect(adminPortal).toBe("admin");
      expect(customerPortal).toBe("customer");
    });

    it("defines AuthVariant correctly", () => {
      const variants: AuthVariant[] = ["simple", "secure", "enterprise"];
      expect(variants).toHaveLength(3);

      const simpleVariant: AuthVariant = "simple";
      const secureVariant: AuthVariant = "secure";
      const enterpriseVariant: AuthVariant = "enterprise";
      expect(simpleVariant).toBe("simple");
      expect(secureVariant).toBe("secure");
      expect(enterpriseVariant).toBe("enterprise");
    });

    it("defines User interface structure", () => {
      const user: User = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: UserRole.TENANT_ADMIN,
        permissions: [Permission.USERS_READ, Permission.CUSTOMERS_READ],
        tenantId: "tenant-1",
        portalId: "portal-1",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
      };

      expect(user.id).toBe("user-1");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.role).toBe(UserRole.TENANT_ADMIN);
      expect(user.permissions).toHaveLength(2);
      expect(user.tenantId).toBe("tenant-1");
      expect(user.portalId).toBe("portal-1");
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("defines LoginCredentials interface structure", () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "securepassword",
        portal: "admin",
        mfaCode: "123456",
        rememberMe: true,
      };

      expect(credentials.email).toBe("test@example.com");
      expect(credentials.password).toBe("securepassword");
      expect(credentials.portal).toBe("admin");
      expect(credentials.mfaCode).toBe("123456");
      expect(credentials.rememberMe).toBe(true);

      // Username instead of email
      const usernameCredentials: LoginCredentials = {
        username: "testuser",
        password: "securepassword",
        portal: "customer",
      };

      expect(usernameCredentials.username).toBe("testuser");
      expect(usernameCredentials.email).toBeUndefined();
    });

    it("defines AuthTokens interface structure", () => {
      const tokens: AuthTokens = {
        accessToken: "access-token-123",
        refreshToken: "refresh-token-456",
        expiresAt: Date.now() + 3600000, // 1 hour
        tokenType: "Bearer",
      };

      expect(tokens.accessToken).toBe("access-token-123");
      expect(tokens.refreshToken).toBe("refresh-token-456");
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
      expect(tokens.tokenType).toBe("Bearer");
    });

    it("defines AuthConfig interface structure", () => {
      const config: AuthConfig = {
        sessionTimeout: 30 * 60 * 1000,
        enableMFA: true,
        enablePermissions: true,
        requirePasswordComplexity: true,
        maxLoginAttempts: 3,
        lockoutDuration: 15 * 60 * 1000,
        enableAuditLog: true,
        tokenRefreshThreshold: 5 * 60 * 1000,
        endpoints: {
          login: "/api/auth/login",
          logout: "/api/auth/logout",
          refresh: "/api/auth/refresh",
          profile: "/api/auth/profile",
        },
      };

      expect(config.sessionTimeout).toBe(1800000);
      expect(config.enableMFA).toBe(true);
      expect(config.enablePermissions).toBe(true);
      expect(config.requirePasswordComplexity).toBe(true);
      expect(config.maxLoginAttempts).toBe(3);
      expect(config.lockoutDuration).toBe(900000);
      expect(config.enableAuditLog).toBe(true);
      expect(config.tokenRefreshThreshold).toBe(300000);
      expect(config.endpoints.login).toBe("/api/auth/login");
    });
  });
});

describe("Auth Error Classes", () => {
  describe("AuthError", () => {
    it("creates base auth error correctly", () => {
      const error = new AuthError("Test error", "TEST_CODE", 400);

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(400);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
    });

    it("creates auth error without status code", () => {
      const error = new AuthError("Test error", "TEST_CODE");

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBeUndefined();
    });

    it("preserves error stack trace", () => {
      const error = new AuthError("Test error", "TEST_CODE");
      expect(error.stack).toBeDefined();
    });
  });

  describe("InvalidCredentialsError", () => {
    it("creates invalid credentials error with default message", () => {
      const error = new InvalidCredentialsError();

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Invalid credentials");
      expect(error.code).toBe("INVALID_CREDENTIALS");
      expect(error.statusCode).toBe(401);
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(InvalidCredentialsError);
    });

    it("creates invalid credentials error with custom message", () => {
      const error = new InvalidCredentialsError("Wrong username or password");

      expect(error.message).toBe("Wrong username or password");
      expect(error.code).toBe("INVALID_CREDENTIALS");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("AccountLockedError", () => {
    it("creates account locked error with default message", () => {
      const error = new AccountLockedError();

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Account is locked");
      expect(error.code).toBe("ACCOUNT_LOCKED");
      expect(error.statusCode).toBe(423);
      expect(error.unlockTime).toBeUndefined();
    });

    it("creates account locked error with custom message and unlock time", () => {
      const unlockTime = Date.now() + 900000; // 15 minutes
      const error = new AccountLockedError("Account locked due to too many attempts", unlockTime);

      expect(error.message).toBe("Account locked due to too many attempts");
      expect(error.code).toBe("ACCOUNT_LOCKED");
      expect(error.statusCode).toBe(423);
      expect(error.unlockTime).toBe(unlockTime);
    });

    it("preserves unlock time property", () => {
      const unlockTime = Date.now() + 300000; // 5 minutes
      const error = new AccountLockedError("Locked", unlockTime);

      expect(error.unlockTime).toBe(unlockTime);
      expect(typeof error.unlockTime).toBe("number");
    });
  });

  describe("SessionExpiredError", () => {
    it("creates session expired error with default message", () => {
      const error = new SessionExpiredError();

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Session has expired");
      expect(error.code).toBe("SESSION_EXPIRED");
      expect(error.statusCode).toBe(401);
    });

    it("creates session expired error with custom message", () => {
      const error = new SessionExpiredError("Your session timed out");

      expect(error.message).toBe("Your session timed out");
      expect(error.code).toBe("SESSION_EXPIRED");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("MFARequiredError", () => {
    it("creates MFA required error with default message", () => {
      const error = new MFARequiredError();

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("MFA verification required");
      expect(error.code).toBe("MFA_REQUIRED");
      expect(error.statusCode).toBe(428);
    });

    it("creates MFA required error with custom message", () => {
      const error = new MFARequiredError("Please enter your 2FA code");

      expect(error.message).toBe("Please enter your 2FA code");
      expect(error.code).toBe("MFA_REQUIRED");
      expect(error.statusCode).toBe(428);
    });
  });

  describe("PermissionDeniedError", () => {
    it("creates permission denied error with default message", () => {
      const error = new PermissionDeniedError();

      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Permission denied");
      expect(error.code).toBe("PERMISSION_DENIED");
      expect(error.statusCode).toBe(403);
    });

    it("creates permission denied error with custom message", () => {
      const error = new PermissionDeniedError("You do not have access to this resource");

      expect(error.message).toBe("You do not have access to this resource");
      expect(error.code).toBe("PERMISSION_DENIED");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("Error Inheritance", () => {
    it("all auth errors inherit from Error", () => {
      const authError = new AuthError("test", "TEST");
      const invalidCredentials = new InvalidCredentialsError();
      const accountLocked = new AccountLockedError();
      const sessionExpired = new SessionExpiredError();
      const mfaRequired = new MFARequiredError();
      const permissionDenied = new PermissionDeniedError();

      expect(authError).toBeInstanceOf(Error);
      expect(invalidCredentials).toBeInstanceOf(Error);
      expect(accountLocked).toBeInstanceOf(Error);
      expect(sessionExpired).toBeInstanceOf(Error);
      expect(mfaRequired).toBeInstanceOf(Error);
      expect(permissionDenied).toBeInstanceOf(Error);
    });

    it("all specific errors inherit from AuthError", () => {
      const invalidCredentials = new InvalidCredentialsError();
      const accountLocked = new AccountLockedError();
      const sessionExpired = new SessionExpiredError();
      const mfaRequired = new MFARequiredError();
      const permissionDenied = new PermissionDeniedError();

      expect(invalidCredentials).toBeInstanceOf(AuthError);
      expect(accountLocked).toBeInstanceOf(AuthError);
      expect(sessionExpired).toBeInstanceOf(AuthError);
      expect(mfaRequired).toBeInstanceOf(AuthError);
      expect(permissionDenied).toBeInstanceOf(AuthError);
    });

    it("errors can be caught as AuthError", () => {
      const errors = [
        new InvalidCredentialsError(),
        new AccountLockedError(),
        new SessionExpiredError(),
        new MFARequiredError(),
        new PermissionDeniedError(),
      ];

      errors.forEach((error) => {
        try {
          throw error;
        } catch (e) {
          expect(e).toBeInstanceOf(AuthError);
          expect((e as AuthError).code).toBeDefined();
          expect((e as AuthError).statusCode).toBeDefined();
        }
      });
    });

    it("errors have correct HTTP status codes", () => {
      expect(new InvalidCredentialsError().statusCode).toBe(401);
      expect(new AccountLockedError().statusCode).toBe(423);
      expect(new SessionExpiredError().statusCode).toBe(401);
      expect(new MFARequiredError().statusCode).toBe(428);
      expect(new PermissionDeniedError().statusCode).toBe(403);
    });

    it("errors have unique error codes", () => {
      const errors = [
        new InvalidCredentialsError(),
        new AccountLockedError(),
        new SessionExpiredError(),
        new MFARequiredError(),
        new PermissionDeniedError(),
      ];

      const codes = errors.map((error) => error.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(errors.length);
    });
  });

  describe("Error Serialization", () => {
    it("errors can be serialized to JSON", () => {
      const error = new InvalidCredentialsError("Test error");

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe("AuthError");
      expect(parsed.message).toBe("Test error");
      expect(parsed.code).toBe("INVALID_CREDENTIALS");
      expect(parsed.statusCode).toBe(401);
    });

    it("AccountLockedError preserves unlockTime in serialization", () => {
      const unlockTime = Date.now() + 900000;
      const error = new AccountLockedError("Locked", unlockTime);

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        unlockTime: error.unlockTime,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.unlockTime).toBe(unlockTime);
    });
  });
});
