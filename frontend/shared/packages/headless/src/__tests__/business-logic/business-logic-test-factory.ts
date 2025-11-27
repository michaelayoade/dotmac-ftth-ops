/**
 * DRY Business Logic Test Factory
 * Production-level test generation leveraging existing patterns
 */

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import type {
  AuthProviderConfig,
  LoginCredentials,
  User,
  AuthError,
  PortalConfig,
} from "@dotmac/headless/auth/types";

// DRY Test Configuration Factory
export class BusinessLogicTestFactory {
  private static queryClient: QueryClient;

  static initialize() {
    this.queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  }

  // DRY Portal Configuration Generator
  static createPortalConfig(type: string, overrides: Partial<PortalConfig> = {}): PortalConfig {
    const baseConfigs = {
      admin: {
        type: "admin",
        id: "admin_portal",
        tenantId: "tenant_test",
        security: {
          requireDeviceVerification: true,
          maxSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
          sessionWarningThreshold: 15 * 60 * 1000, // 15 minutes
        },
        features: {
          mfaRequired: true,
          passwordPolicy: {
            minLength: 12,
            requireSpecialChars: true,
            requireNumbers: true,
          },
        },
      },
      customer: {
        type: "customer",
        id: "customer_portal",
        tenantId: "tenant_test",
        security: {
          requireDeviceVerification: false,
          maxSessionDuration: 2 * 60 * 60 * 1000, // 2 hours
          sessionWarningThreshold: 10 * 60 * 1000, // 10 minutes
        },
        features: {
          mfaRequired: false,
          passwordPolicy: {
            minLength: 8,
            requireSpecialChars: false,
            requireNumbers: true,
          },
        },
      },
      technician: {
        type: "technician",
        id: "technician_portal",
        tenantId: "tenant_test",
        security: {
          requireDeviceVerification: true,
          maxSessionDuration: 12 * 60 * 60 * 1000, // 12 hours (field work)
          sessionWarningThreshold: 30 * 60 * 1000, // 30 minutes
        },
        features: {
          mfaRequired: true,
          passwordPolicy: {
            minLength: 10,
            requireSpecialChars: true,
            requireNumbers: true,
          },
        },
      },
      reseller: {
        type: "reseller",
        id: "reseller_portal",
        tenantId: "tenant_test",
        security: {
          requireDeviceVerification: false,
          maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
          sessionWarningThreshold: 15 * 60 * 1000, // 15 minutes
        },
        features: {
          mfaRequired: false,
          passwordPolicy: {
            minLength: 8,
            requireSpecialChars: true,
            requireNumbers: true,
          },
        },
      },
    };

    return {
      ...baseConfigs[type as keyof typeof baseConfigs],
      ...overrides,
    } as PortalConfig;
  }

  // DRY Auth Configuration Generator
  static createAuthConfig(
    portalType: string,
    overrides: Partial<AuthProviderConfig> = {},
  ): AuthProviderConfig {
    return {
      portal: this.createPortalConfig(portalType),
      secureStorage: true,
      autoRefresh: true,
      rateLimiting: true,
      redirectOnLogout: `/${portalType}/login`,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...overrides,
    };
  }

  // DRY User Data Generator
  static createUser(role: string, overrides: Partial<User> = {}): User {
    const baseUsers = {
      admin: {
        id: "user_admin_001",
        email: "admin@test-isp.com",
        name: "Admin User",
        role: "admin",
        tenantId: "tenant_test",
        permissions: ["all"],
        mfaEnabled: true,
        avatar: null,
        preferences: {
          theme: "light",
          compactMode: false,
        },
      },
      customer: {
        id: "user_customer_001",
        email: "customer@example.com",
        name: "Customer User",
        role: "customer",
        tenantId: "tenant_test",
        permissions: ["billing", "services", "support"],
        mfaEnabled: false,
        avatar: null,
        preferences: {
          theme: "light",
          compactMode: false,
        },
      },
      technician: {
        id: "user_tech_001",
        email: "tech@test-isp.com",
        name: "Field Technician",
        role: "technician",
        tenantId: "tenant_test",
        permissions: ["field_ops", "customer_sites", "work_orders"],
        mfaEnabled: true,
        avatar: null,
        preferences: {
          theme: "light",
          compactMode: true,
        },
      },
      reseller: {
        id: "user_reseller_001",
        email: "partner@reseller.com",
        name: "Reseller Partner",
        role: "reseller",
        tenantId: "tenant_test",
        permissions: ["territory", "customers", "commission"],
        mfaEnabled: false,
        avatar: null,
        preferences: {
          theme: "light",
          compactMode: false,
        },
      },
    };

    return {
      ...baseUsers[role as keyof typeof baseUsers],
      ...overrides,
    } as User;
  }

  // DRY Credentials Generator
  static createCredentials(
    type: "valid" | "invalid" | "expired" | "mfa_required" | "password_expired",
    overrides: Partial<LoginCredentials> = {},
  ): LoginCredentials {
    const baseCredentials = {
      valid: {
        email: "admin@test-isp.com",
        password: "SecurePassword123!",
      },
      invalid: {
        email: "admin@test-isp.com",
        password: "wrongpassword",
      },
      expired: {
        email: "expired@test-isp.com",
        password: "ExpiredPassword123!",
      },
      mfa_required: {
        email: "mfa@test-isp.com",
        password: "MfaPassword123!",
      },
      password_expired: {
        email: "pwdexp@test-isp.com",
        password: "ExpiredPwd123!",
      },
    };

    return {
      ...baseCredentials[type],
      ...overrides,
    };
  }

  // DRY Error Generator
  static createAuthError(type: string): AuthError {
    const errors = {
      INVALID_CREDENTIALS: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
      ACCOUNT_LOCKED: {
        code: "ACCOUNT_LOCKED",
        message: "Account temporarily locked due to too many failed attempts",
        retryAfter: 300,
      },
      MFA_REQUIRED: {
        code: "MFA_REQUIRED",
        message: "Multi-factor authentication required",
        requires_2fa: true,
      },
      PASSWORD_EXPIRED: {
        code: "PASSWORD_EXPIRED",
        message: "Password has expired and must be changed",
        password_expired: true,
      },
      RATE_LIMITED: {
        code: "RATE_LIMITED",
        message: "Too many login attempts. Try again in 60s",
        retryAfter: 60,
      },
      SESSION_EXPIRED: {
        code: "SESSION_EXPIRED",
        message: "Session has expired",
      },
      NETWORK_ERROR: {
        code: "NETWORK_ERROR",
        message: "Network connection failed",
      },
    };

    return errors[type as keyof typeof errors] as AuthError;
  }

  // DRY Test Wrapper with Providers
  static createTestWrapper(
    config?: Partial<{
      queryClient?: QueryClient;
      mockWebSocket?: boolean;
    }>,
  ) {
    const client = config?.queryClient || this.queryClient;

    return function TestWrapper({ children }: { children: ReactNode }) {
      return React.createElement(QueryClientProvider, { client }, children);
    };
  }

  // DRY API Mock Factory
  static createMockFetch(scenarios: Record<string, any>) {
    return jest.fn().mockImplementation(async (url: string, options: any = {}) => {
      const method = options.method || "GET";
      const key = `${method} ${url}`;

      if (scenarios[key]) {
        const scenario = scenarios[key];

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, scenario.delay || 10));

        if (scenario.error) {
          throw scenario.error;
        }

        return {
          ok: scenario.status >= 200 && scenario.status < 300,
          status: scenario.status || 200,
          json: async () => scenario.data || {},
          headers: new Headers(scenario.headers || {}),
        };
      }

      // Default 404 response
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      };
    });
  }

  // DRY Business Logic Test Suite Generator
  static createBusinessLogicTestSuite<T>(
    hookName: string,
    hookImplementation: () => T,
    testDefinition: BusinessLogicTestDefinition<T>,
  ) {
    describe(`${hookName} Business Logic`, () => {
      beforeEach(() => {
        this.initialize();
        // Setup common mocks
        global.fetch = this.createMockFetch(testDefinition.mockScenarios || {});
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      // Test initial state
      it("should initialize with correct default state", () => {
        const { result } = renderHook(hookImplementation, {
          wrapper: this.createTestWrapper(),
        });

        expect(result.current).toMatchObject(testDefinition.initialState);
      });

      // Test successful operations
      testDefinition.successScenarios?.forEach((scenario) => {
        it(`should handle ${scenario.name} successfully`, async () => {
          const { result } = renderHook(hookImplementation, {
            wrapper: this.createTestWrapper(),
          });

          await act(async () => {
            await scenario.action(result.current);
          });

          scenario.expectations(result.current);
        });
      });

      // Test error scenarios
      testDefinition.errorScenarios?.forEach((scenario) => {
        it(`should handle ${scenario.name} error correctly`, async () => {
          const { result } = renderHook(hookImplementation, {
            wrapper: this.createTestWrapper(),
          });

          await act(async () => {
            await scenario.action(result.current);
          });

          scenario.expectations(result.current);
        });
      });

      // Test business rules
      testDefinition.businessRules?.forEach((rule) => {
        it(`should enforce business rule: ${rule.description}`, async () => {
          const { result } = renderHook(hookImplementation, {
            wrapper: this.createTestWrapper(),
          });

          await act(async () => {
            await rule.setup(result.current);
          });

          rule.test(result.current);
        });
      });

      // Test edge cases
      testDefinition.edgeCases?.forEach((edgeCase) => {
        it(`should handle edge case: ${edgeCase.description}`, async () => {
          const { result } = renderHook(hookImplementation, {
            wrapper: this.createTestWrapper(),
          });

          await act(async () => {
            await edgeCase.setup(result.current);
          });

          edgeCase.test(result.current);
        });
      });
    });
  }
}

// Type definitions for test configuration
interface BusinessLogicTestDefinition<T> {
  initialState: Partial<T>;
  mockScenarios?: Record<
    string,
    {
      status?: number;
      data?: any;
      error?: Error;
      delay?: number;
      headers?: Record<string, string>;
    }
  >;
  successScenarios?: Array<{
    name: string;
    action: (hook: T) => Promise<void> | void;
    expectations: (hook: T) => void;
  }>;
  errorScenarios?: Array<{
    name: string;
    action: (hook: T) => Promise<void> | void;
    expectations: (hook: T) => void;
  }>;
  businessRules?: Array<{
    description: string;
    setup: (hook: T) => Promise<void> | void;
    test: (hook: T) => void;
  }>;
  edgeCases?: Array<{
    description: string;
    setup: (hook: T) => Promise<void> | void;
    test: (hook: T) => void;
  }>;
}

// ISP-specific test data factories
export class ISPTestDataFactory {
  static createNetworkDevice(type: string, overrides = {}) {
    const devices = {
      router: {
        id: "router_001",
        name: "Core Router 1",
        type: "router",
        status: "online",
        uptime: 99.98,
        load: 34.2,
        location: { lat: 40.7128, lng: -74.006 },
      },
      switch: {
        id: "switch_001",
        name: "Access Switch 1",
        type: "switch",
        status: "online",
        uptime: 99.95,
        load: 12.8,
        location: { lat: 40.713, lng: -74.006 },
      },
      ap: {
        id: "ap_001",
        name: "Wireless AP 1",
        type: "access_point",
        status: "online",
        uptime: 99.92,
        connectedDevices: 23,
        location: { lat: 40.7128, lng: -74.006 },
      },
    };

    return {
      ...devices[type as keyof typeof devices],
      ...overrides,
    };
  }

  static createCustomer(type: string, overrides = {}) {
    const customers = {
      residential: {
        id: "cust_res_001",
        name: "John Doe",
        email: "john.doe@email.com",
        phone: "555-0123",
        type: "residential",
        plan: "Home Premium 100",
        status: "active",
        monthlyRevenue: 79.99,
        installDate: "2023-03-15",
        address: {
          street: "123 Main St",
          city: "Anytown",
          state: "NY",
          zip: "12345",
        },
      },
      business: {
        id: "cust_bus_001",
        name: "Acme Corp",
        email: "it@acmecorp.com",
        phone: "555-9999",
        type: "business",
        plan: "Business Pro 500",
        status: "active",
        monthlyRevenue: 299.99,
        installDate: "2023-01-10",
        address: {
          street: "456 Business Ave",
          city: "Commerce City",
          state: "NY",
          zip: "12346",
        },
      },
    };

    return {
      ...customers[type as keyof typeof customers],
      ...overrides,
    };
  }

  static createServicePlan(tier: string, overrides = {}) {
    const plans = {
      basic: {
        id: "plan_basic",
        name: "Basic Internet",
        speed: "25 Mbps",
        price: 39.99,
        features: ["Standard Support", "Basic WiFi"],
      },
      premium: {
        id: "plan_premium",
        name: "Premium Internet",
        speed: "100 Mbps",
        price: 69.99,
        features: ["Priority Support", "Advanced WiFi", "Static IP"],
      },
      enterprise: {
        id: "plan_enterprise",
        name: "Enterprise Internet",
        speed: "1 Gbps",
        price: 299.99,
        features: ["24/7 Support", "Managed WiFi", "Multiple IPs", "SLA"],
      },
    };

    return {
      ...plans[tier as keyof typeof plans],
      ...overrides,
    };
  }

  static createBillingData(scenario: string, overrides = {}) {
    const scenarios = {
      current: {
        invoiceId: "INV-2024-001",
        customerId: "cust_001",
        amount: 79.99,
        dueDate: "2024-02-15",
        status: "paid",
        items: [{ description: "Internet Service - Premium 100", amount: 79.99 }],
      },
      overdue: {
        invoiceId: "INV-2024-002",
        customerId: "cust_002",
        amount: 159.98,
        dueDate: "2024-01-15",
        status: "overdue",
        daysPastDue: 30,
        items: [
          { description: "Internet Service - Premium 100", amount: 79.99 },
          { description: "Late Fee", amount: 79.99 },
        ],
      },
    };

    return {
      ...scenarios[scenario as keyof typeof scenarios],
      ...overrides,
    };
  }
}

export default BusinessLogicTestFactory;

// Expose ISP test data factory through the main factory for convenience in other suites
(BusinessLogicTestFactory as any).ISPTestDataFactory = ISPTestDataFactory;

// Provide a minimal test so Jest doesn't treat this helper file as an empty suite
describe("BusinessLogicTestFactory helpers", () => {
  it("makes portal and ISP factories available", () => {
    expect(BusinessLogicTestFactory.createPortalConfig).toBeInstanceOf(Function);
    expect((BusinessLogicTestFactory as any).ISPTestDataFactory).toBe(ISPTestDataFactory);
  });
});
