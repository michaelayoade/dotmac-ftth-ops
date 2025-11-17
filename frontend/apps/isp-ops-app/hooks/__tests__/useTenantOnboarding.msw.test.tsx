/**
 * MSW Tests for useTenantOnboarding hook
 * Tests tenant onboarding automation with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  useTenantOnboarding,
  useOnboardingStatus,
  useSlugGeneration,
  usePasswordGeneration,
} from "../useTenantOnboarding";
import {
  seedOnboardingStatuses,
  seedOnboardingHistory,
  clearTenantOnboardingData,
} from "@/__tests__/msw/handlers/tenant-onboarding";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useTenantOnboarding", () => {
  beforeEach(() => {
    clearTenantOnboardingData();
  });

  describe("Tenant Onboarding Operations", () => {
    describe("useTenantOnboarding", () => {
      it("should onboard new tenant successfully", async () => {
        const { result } = renderHook(() => useTenantOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.onboardAsync({
            tenant: {
              name: "Acme Corp",
              slug: "acme-corp",
              plan: "enterprise",
              contact_email: "contact@acme.com",
              contact_phone: "+1234567890",
              billing_email: "billing@acme.com",
              address: "123 Main St",
              city: "San Francisco",
              state: "CA",
              postal_code: "94102",
              country: "US",
            },
            tenant_id: undefined,
            options: {
              apply_default_settings: true,
              mark_onboarding_complete: true,
              activate_tenant: true,
              allow_existing_tenant: false,
            },
            admin_user: {
              username: "admin",
              email: "admin@acme.com",
              password: undefined,
              generate_password: true,
              full_name: "Admin User",
              roles: ["admin"],
              send_activation_email: true,
            },
            settings: [
              { key: "theme", value: "dark", value_type: "string" },
              { key: "timezone", value: "America/Los_Angeles", value_type: "string" },
            ],
            metadata: { source: "sales_team", campaign: "Q4_2024" },
            invitations: [
              { email: "user1@acme.com", role: "user", message: "Welcome to the team!" },
              { email: "user2@acme.com", role: "manager", message: undefined },
            ],
            feature_flags: { analytics: true, reports: true, api_access: false },
          });
        });

        await waitFor(() => expect(result.current.onboardingResult).toBeDefined());
        expect(result.current.onboardingResult).toBeDefined();
        expect(result.current.onboardingResult?.tenant).toBeDefined();
        expect(result.current.onboardingResult?.tenant.name).toBe("Acme Corp");
        expect(result.current.onboardingResult?.tenant.slug).toBe("acme-corp");
        expect(result.current.onboardingResult?.created).toBe(true);
        expect(result.current.onboardingResult?.onboarding_status).toBe("complete");
        expect(result.current.onboardingResult?.admin_user_id).toBeDefined();
        expect(result.current.onboardingResult?.admin_user_password).toBeDefined();
        expect(result.current.onboardingResult?.invitations).toHaveLength(2);
        expect(result.current.onboardingResult?.applied_settings).toHaveLength(2);
        expect(result.current.onboardingResult?.feature_flags_updated).toBe(true);
        expect(result.current.onboardingResult?.logs).toBeDefined();
        expect(result.current.onboardingResult?.logs.length).toBeGreaterThan(0);
      });

      it("should onboard existing tenant", async () => {
        const { result } = renderHook(() => useTenantOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.onboardAsync({
            tenant: undefined,
            tenant_id: "existing-tenant-123",
            options: {
              apply_default_settings: false,
              mark_onboarding_complete: true,
              activate_tenant: false,
              allow_existing_tenant: true,
            },
            admin_user: undefined,
            settings: undefined,
            metadata: undefined,
            invitations: undefined,
            feature_flags: undefined,
          });
        });

        await waitFor(() => expect(result.current.onboardingResult).toBeDefined());
        expect(result.current.onboardingResult).toBeDefined();
        expect(result.current.onboardingResult?.created).toBe(false);
        expect(result.current.onboardingResult?.admin_user_id).toBeUndefined();
        expect(result.current.onboardingResult?.admin_user_password).toBeUndefined();
      });

      it("should handle onboarding with minimal options", async () => {
        const { result } = renderHook(() => useTenantOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.onboardAsync({
            tenant: {
              name: "Basic Tenant",
              slug: "basic-tenant",
              plan: "basic",
              contact_email: undefined,
              contact_phone: undefined,
              billing_email: undefined,
              address: undefined,
              city: undefined,
              state: undefined,
              postal_code: undefined,
              country: undefined,
            },
            tenant_id: undefined,
            options: {
              apply_default_settings: false,
              mark_onboarding_complete: false,
              activate_tenant: true,
              allow_existing_tenant: false,
            },
            admin_user: undefined,
            settings: undefined,
            metadata: undefined,
            invitations: undefined,
            feature_flags: undefined,
          });
        });

        await waitFor(() => expect(result.current.onboardingResult).toBeDefined());
        expect(result.current.onboardingResult).toBeDefined();
        expect(result.current.onboardingResult?.onboarding_status).toBe("pending");
        expect(result.current.onboardingResult?.admin_user_id).toBeUndefined();
        expect(result.current.onboardingResult?.invitations).toHaveLength(0);
        expect(result.current.onboardingResult?.applied_settings).toHaveLength(0);
        expect(result.current.onboardingResult?.feature_flags_updated).toBe(false);
      });

      it("should track isOnboarding status correctly", async () => {
        const { result } = renderHook(() => useTenantOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isOnboarding).toBe(false);

        act(() => {
          result.current.onboard({
            tenant: {
              name: "Test",
              slug: "test",
              plan: "basic",
              contact_email: undefined,
              contact_phone: undefined,
              billing_email: undefined,
              address: undefined,
              city: undefined,
              state: undefined,
              postal_code: undefined,
              country: undefined,
            },
            tenant_id: undefined,
            options: {
              apply_default_settings: true,
              mark_onboarding_complete: true,
              activate_tenant: true,
              allow_existing_tenant: false,
            },
            admin_user: undefined,
            settings: undefined,
            metadata: undefined,
            invitations: undefined,
            feature_flags: undefined,
          });
        });

        await waitFor(() => expect(result.current.isOnboarding).toBe(false));
      });

      it("should reset mutation state", async () => {
        const { result } = renderHook(() => useTenantOnboarding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.onboardAsync({
            tenant: {
              name: "Test",
              slug: "test",
              plan: "basic",
              contact_email: undefined,
              contact_phone: undefined,
              billing_email: undefined,
              address: undefined,
              city: undefined,
              state: undefined,
              postal_code: undefined,
              country: undefined,
            },
            tenant_id: undefined,
            options: {
              apply_default_settings: true,
              mark_onboarding_complete: true,
              activate_tenant: true,
              allow_existing_tenant: false,
            },
            admin_user: undefined,
            settings: undefined,
            metadata: undefined,
            invitations: undefined,
            feature_flags: undefined,
          });
        });

        await waitFor(() => expect(result.current.onboardingResult).toBeDefined());
        expect(result.current.onboardingResult).toBeDefined();

        act(() => {
          result.current.reset();
        });

        // After reset, the mutation should be back to idle state
        await waitFor(() => {
          expect(result.current.onboardingResult).toBeUndefined();
        });
        expect(result.current.onboardingError).toBeNull();
      });
    });
  });

  describe("Onboarding Status", () => {
    describe("useOnboardingStatus", () => {
      it("should fetch onboarding status successfully", async () => {
        seedOnboardingStatuses([
          {
            tenant_id: "tenant-123",
            status: "complete",
            completed: true,
            metadata: {
              created: true,
              admin_user_created: true,
              invitations_sent: 2,
              settings_applied: 3,
            },
            updated_at: "2025-01-15T10:00:00Z",
          },
        ]);

        const { result } = renderHook(() => useOnboardingStatus("tenant-123"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.tenant_id).toBe("tenant-123");
        expect(result.current.data?.status).toBe("complete");
        expect(result.current.data?.completed).toBe(true);
        expect(result.current.data?.metadata.admin_user_created).toBe(true);
      });

      it("should not fetch when tenantId is undefined", async () => {
        const { result } = renderHook(() => useOnboardingStatus(undefined), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.fetchStatus).toBe("idle");
      });

      it("should handle missing status", async () => {
        const { result } = renderHook(() => useOnboardingStatus("non-existent"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
      });

      it("should have correct stale time", async () => {
        seedOnboardingStatuses([
          {
            tenant_id: "tenant-456",
            status: "pending",
            completed: false,
          },
        ]);

        const { result } = renderHook(() => useOnboardingStatus("tenant-456"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.status).toBe("pending");
      });
    });
  });

  describe("Utility Functions", () => {
    describe("useSlugGeneration", () => {
      it("should provide generateSlug function", () => {
        const { result } = renderHook(() => useSlugGeneration());

        expect(result.current.generateSlug).toBeDefined();
        expect(typeof result.current.generateSlug).toBe("function");
      });

      it("should generate slug from name", () => {
        const { result } = renderHook(() => useSlugGeneration());

        const slug = result.current.generateSlug("Test Tenant Name");

        expect(slug).toBe("test-tenant-name");
      });

      it("should handle special characters", () => {
        const { result } = renderHook(() => useSlugGeneration());

        const slug = result.current.generateSlug("Test & Company LLC!");

        expect(slug).toBe("test-company-llc");
      });

      it("should handle multiple spaces", () => {
        const { result } = renderHook(() => useSlugGeneration());

        const slug = result.current.generateSlug("Test   Multiple   Spaces");

        expect(slug).toBe("test-multiple-spaces");
      });
    });

    describe("usePasswordGeneration", () => {
      it("should provide generatePassword function", () => {
        const { result } = renderHook(() => usePasswordGeneration());

        expect(result.current.generatePassword).toBeDefined();
        expect(typeof result.current.generatePassword).toBe("function");
      });

      it("should generate password with default length", () => {
        const { result } = renderHook(() => usePasswordGeneration());

        const password = result.current.generatePassword();

        expect(password).toBeDefined();
        expect(password.length).toBe(16);
      });

      it("should generate password with custom length", () => {
        const { result } = renderHook(() => usePasswordGeneration());

        const password = result.current.generatePassword(24);

        expect(password.length).toBe(24);
      });

      it("should generate unique passwords", () => {
        const { result } = renderHook(() => usePasswordGeneration());

        const password1 = result.current.generatePassword();
        const password2 = result.current.generatePassword();

        expect(password1).not.toBe(password2);
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete enterprise onboarding workflow", async () => {
      const { result } = renderHook(() => useTenantOnboarding(), {
        wrapper: createQueryWrapper(),
      });

      // Onboard with full features
      await act(async () => {
        await result.current.onboardAsync({
          tenant: {
            name: "Enterprise Corp",
            slug: "enterprise-corp",
            plan: "enterprise",
            contact_email: "contact@enterprise.com",
            contact_phone: "+1234567890",
            billing_email: "billing@enterprise.com",
            address: "456 Enterprise Ave",
            city: "New York",
            state: "NY",
            postal_code: "10001",
            country: "US",
          },
          tenant_id: undefined,
          options: {
            apply_default_settings: true,
            mark_onboarding_complete: true,
            activate_tenant: true,
            allow_existing_tenant: false,
          },
          admin_user: {
            username: "admin",
            email: "admin@enterprise.com",
            password: undefined,
            generate_password: true,
            full_name: "Enterprise Admin",
            roles: ["admin", "super_user"],
            send_activation_email: true,
          },
          settings: [
            { key: "max_users", value: 1000, value_type: "integer" },
            { key: "storage_quota", value: 1000000, value_type: "integer" },
            { key: "custom_domain", value: "app.enterprise.com", value_type: "string" },
          ],
          metadata: { sales_rep: "john.doe", contract_id: "ENT-2025-001" },
          invitations: [
            { email: "manager1@enterprise.com", role: "manager", message: "Welcome!" },
            { email: "manager2@enterprise.com", role: "manager", message: undefined },
          ],
          feature_flags: {
            advanced_analytics: true,
            api_access: true,
            custom_integrations: true,
            white_label: true,
          },
        });
      });

      await waitFor(() => expect(result.current.onboardingResult).toBeDefined());
      const tenantId = result.current.onboardingResult?.tenant.id;
      expect(tenantId).toBeDefined();

      // Check onboarding status
      const { result: statusResult } = renderHook(
        () => useOnboardingStatus(tenantId),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(statusResult.current.isLoading).toBe(false));

      expect(statusResult.current.data?.status).toBe("complete");
      expect(statusResult.current.data?.completed).toBe(true);
    });

    it("should handle existing tenant re-onboarding", async () => {
      // First onboarding
      const { result: firstResult } = renderHook(() => useTenantOnboarding(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await firstResult.current.onboardAsync({
          tenant: {
            name: "Existing Tenant",
            slug: "existing-tenant",
            plan: "basic",
            contact_email: undefined,
            contact_phone: undefined,
            billing_email: undefined,
            address: undefined,
            city: undefined,
            state: undefined,
            postal_code: undefined,
            country: undefined,
          },
          tenant_id: undefined,
          options: {
            apply_default_settings: true,
            mark_onboarding_complete: false,
            activate_tenant: true,
            allow_existing_tenant: false,
          },
          admin_user: undefined,
          settings: undefined,
          metadata: undefined,
          invitations: undefined,
          feature_flags: undefined,
        });
      });

      await waitFor(() => expect(firstResult.current.onboardingResult).toBeDefined());
      const tenantId = firstResult.current.onboardingResult?.tenant.id;

      // Re-onboard the same tenant
      const { result: secondResult } = renderHook(() => useTenantOnboarding(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await secondResult.current.onboardAsync({
          tenant: undefined,
          tenant_id: tenantId,
          options: {
            apply_default_settings: true,
            mark_onboarding_complete: true,
            activate_tenant: false,
            allow_existing_tenant: true,
          },
          admin_user: undefined,
          settings: [
            { key: "upgraded_feature", value: true, value_type: "boolean" },
          ],
          metadata: { upgrade_date: "2025-01-15" },
          invitations: undefined,
          feature_flags: { new_feature: true },
        });
      });

      await waitFor(() => expect(secondResult.current.onboardingResult).toBeDefined());
      expect(secondResult.current.onboardingResult?.created).toBe(false);
      expect(secondResult.current.onboardingResult?.onboarding_status).toBe("complete");
      expect(secondResult.current.onboardingResult?.feature_flags_updated).toBe(true);
    });
  });
});
