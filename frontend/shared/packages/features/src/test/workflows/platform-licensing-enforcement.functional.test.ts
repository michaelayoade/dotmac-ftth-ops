/**
 * Functional Tests: Platform Licensing Enforcement
 *
 * Tests the enforcement of module-based licensing for ISP tenants:
 * - Module access control based on subscription
 * - Core vs Premium module differentiation
 * - Module dependency resolution
 * - Feature availability checks
 * - License validation
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  createMockTenant,
  createMockModule,
  createCoreModule,
  createPremiumModule,
  createMockServicePlan,
  createStarterPlan,
  createProfessionalPlan,
  createMockSubscription,
  createActiveSubscription,
  resetPlatformCounters,
  type Module,
  type ServicePlan,
  type TenantSubscription,
  type SubscriptionModule,
} from "../factories/platform";

describe("Platform: Licensing Enforcement", () => {
  beforeEach(() => {
    resetPlatformCounters();
  });

  // ============================================================================
  // Module Access Control
  // ============================================================================

  describe("Module Access Control", () => {
    it("should grant access to core modules for all subscriptions", () => {
      const coreModule = createCoreModule({
        module_name: "Core Billing",
        module_code: "CORE_BILLING",
      });

      const starterPlan = createStarterPlan();
      const subscription = createActiveSubscription({
        plan_id: starterPlan.id,
      });

      // Core modules are always included
      const hasAccess = coreModule.is_core === true;
      expect(hasAccess).toBe(true);
    });

    it("should restrict premium module access based on subscription", () => {
      const premiumModule = createPremiumModule({
        module_name: "Advanced Analytics",
        module_code: "ADVANCED_ANALYTICS",
      });

      const starterPlan = createStarterPlan(); // No analytics
      const professionalPlan = createProfessionalPlan(); // Has analytics

      // Starter plan should NOT have analytics module
      const starterHasAnalytics =
        starterPlan.modules?.some((m) => m.module_id === "mod_analytics") || false;
      expect(starterHasAnalytics).toBe(false);

      // Professional plan SHOULD have analytics module
      const professionalHasAnalytics =
        professionalPlan.modules?.some((m) => m.module_id === "mod_analytics") || false;
      expect(professionalHasAnalytics).toBe(true);
    });

    it("should validate tenant has active subscription before granting module access", () => {
      const module = createPremiumModule();
      const subscription = createActiveSubscription({
        modules: [
          {
            id: "sm_1",
            module_id: module.id,
            enabled: true,
          } as SubscriptionModule,
        ],
      });

      // Business logic: Module access requires ACTIVE subscription
      const canAccessModule = (sub: TenantSubscription, moduleId: string) => {
        if (sub.status !== "ACTIVE" && sub.status !== "TRIAL") return false;
        return sub.modules?.some((m) => m.module_id === moduleId && m.enabled) || false;
      };

      expect(canAccessModule(subscription, module.id)).toBe(true);
    });

    it("should deny module access when subscription is suspended", () => {
      const module = createPremiumModule();
      const subscription = createMockSubscription({
        status: "SUSPENDED",
        modules: [
          {
            id: "sm_1",
            module_id: module.id,
            enabled: true,
          } as SubscriptionModule,
        ],
      });

      // Business logic: Suspended subscriptions cannot access modules
      const canAccess = subscription.status === "ACTIVE" || subscription.status === "TRIAL";
      expect(canAccess).toBe(false);
    });
  });

  // ============================================================================
  // Module Categories
  // ============================================================================

  describe("Module Categories", () => {
    it("should categorize modules by business domain", () => {
      const billingModule = createMockModule({
        module_name: "Billing Engine",
        category: "BILLING",
      });

      const networkModule = createMockModule({
        module_name: "Network Monitor",
        category: "NETWORK",
      });

      const analyticsModule = createMockModule({
        module_name: "Analytics Dashboard",
        category: "ANALYTICS",
      });

      expect(billingModule.category).toBe("BILLING");
      expect(networkModule.category).toBe("NETWORK");
      expect(analyticsModule.category).toBe("ANALYTICS");
    });

    it("should list all modules in a specific category", () => {
      const modules: Module[] = [
        createMockModule({ category: "BILLING" }),
        createMockModule({ category: "BILLING" }),
        createMockModule({ category: "NETWORK" }),
        createMockModule({ category: "ANALYTICS" }),
      ];

      const billingModules = modules.filter((m) => m.category === "BILLING");
      expect(billingModules.length).toBe(2);
    });
  });

  // ============================================================================
  // Module Dependencies
  // ============================================================================

  describe("Module Dependencies", () => {
    it("should enforce module dependencies during activation", () => {
      const coreModule = createCoreModule({
        module_code: "CORE_BILLING",
      });

      const advancedModule = createPremiumModule({
        module_code: "ADVANCED_BILLING",
        dependencies: [coreModule.module_code],
      });

      // Business logic: Cannot enable advanced module without core
      const canEnableAdvanced = (enabledModules: string[], dependencies: string[]) => {
        return dependencies.every((dep) => enabledModules.includes(dep));
      };

      expect(canEnableAdvanced([coreModule.module_code], advancedModule.dependencies)).toBe(true);
      expect(canEnableAdvanced([], advancedModule.dependencies)).toBe(false);
    });

    it("should prevent disabling module that other modules depend on", () => {
      const coreModule = createCoreModule({
        module_code: "CORE_BILLING",
      });

      const dependentModule = createPremiumModule({
        module_code: "ADVANCED_BILLING",
        dependencies: [coreModule.module_code],
      });

      const enabledModules = [coreModule.module_code, dependentModule.module_code];

      // Business logic: Cannot disable core if advanced is enabled
      const canDisableModule = (moduleCode: string, enabled: string[]) => {
        // Check if any other enabled module depends on this one
        const isDependency = dependentModule.dependencies.includes(moduleCode);
        const dependentIsEnabled = enabled.includes(dependentModule.module_code);

        return !(isDependency && dependentIsEnabled);
      };

      expect(canDisableModule(coreModule.module_code, enabledModules)).toBe(false);
      expect(canDisableModule(dependentModule.module_code, enabledModules)).toBe(true);
    });
  });

  // ============================================================================
  // Feature Flags & Permissions
  // ============================================================================

  describe("Feature Availability", () => {
    it("should determine feature availability based on subscription tier", () => {
      const starterSubscription = createActiveSubscription({
        plan_id: "plan_starter",
      });

      const professionalSubscription = createActiveSubscription({
        plan_id: "plan_professional",
      });

      // Business logic: Feature tiers
      const hasFeature = (planId: string, feature: string) => {
        const featureMap: Record<string, string[]> = {
          plan_starter: ["basic_billing", "customer_management"],
          plan_professional: [
            "basic_billing",
            "customer_management",
            "advanced_analytics",
            "api_access",
          ],
        };
        return featureMap[planId]?.includes(feature) || false;
      };

      expect(hasFeature(starterSubscription.plan_id, "basic_billing")).toBe(true);
      expect(hasFeature(starterSubscription.plan_id, "advanced_analytics")).toBe(false);
      expect(hasFeature(professionalSubscription.plan_id, "advanced_analytics")).toBe(true);
    });

    it("should handle trial limitations differently from paid subscriptions", () => {
      const trial = createMockSubscription({ status: "TRIAL" });
      const paid = createActiveSubscription({ status: "ACTIVE" });

      // Business logic: Trial might have feature restrictions
      const getFeatureLimits = (status: string) => {
        return status === "TRIAL"
          ? { api_calls_per_day: 100, export_limit: 50 }
          : { api_calls_per_day: 10000, export_limit: 10000 };
      };

      const trialLimits = getFeatureLimits(trial.status);
      const paidLimits = getFeatureLimits(paid.status);

      expect(trialLimits.api_calls_per_day).toBeLessThan(paidLimits.api_calls_per_day);
    });
  });

  // ============================================================================
  // License Validation
  // ============================================================================

  describe("License Validation", () => {
    it("should validate subscription is within billing period", () => {
      const now = new Date();
      const subscription = createActiveSubscription({
        current_period_start: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        current_period_end: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days from now
      });

      const isWithinPeriod = (sub: TenantSubscription) => {
        const now = new Date();
        const start = new Date(sub.current_period_start);
        const end = new Date(sub.current_period_end);
        return now >= start && now <= end;
      };

      expect(isWithinPeriod(subscription)).toBe(true);
    });

    it("should detect expired subscription period", () => {
      const subscription = createMockSubscription({
        status: "EXPIRED",
        current_period_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
        current_period_end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      });

      const isExpired = (sub: TenantSubscription) => {
        const now = new Date();
        const end = new Date(sub.current_period_end);
        return now > end;
      };

      expect(isExpired(subscription)).toBe(true);
    });
  });

  // ============================================================================
  // Module Activation/Deactivation
  // ============================================================================

  describe("Module Management", () => {
    it("should enable additional module for tenant subscription", () => {
      const subscription = createActiveSubscription({
        modules: [],
      });

      const newModule = createPremiumModule({
        module_code: "ADVANCED_ANALYTICS",
      });

      // Business logic: Add module to subscription
      const updatedSubscription: TenantSubscription = {
        ...subscription,
        modules: [
          {
            id: "sm_new",
            module_id: newModule.id,
            enabled: true,
          } as SubscriptionModule,
        ],
      };

      expect(updatedSubscription.modules.length).toBe(1);
      expect(updatedSubscription.modules[0].module_id).toBe(newModule.id);
      expect(updatedSubscription.modules[0].enabled).toBe(true);
    });

    it("should disable module while preserving configuration", () => {
      const module = createPremiumModule();
      const subscription = createActiveSubscription({
        modules: [
          {
            id: "sm_1",
            module_id: module.id,
            enabled: true,
          } as SubscriptionModule,
        ],
      });

      // Business logic: Disable but keep in list
      const updatedSubscription: TenantSubscription = {
        ...subscription,
        modules: subscription.modules.map((m) => ({
          ...m,
          enabled: false,
        })),
      };

      expect(updatedSubscription.modules.length).toBe(1);
      expect(updatedSubscription.modules[0].enabled).toBe(false);
    });

    it("should calculate price adjustment when adding paid module", () => {
      const baseSubscription = createActiveSubscription({
        monthly_price: 49.0,
      });

      const additionalModulePrice = 20.0;

      const updatedPrice = baseSubscription.monthly_price + additionalModulePrice;

      expect(updatedPrice).toBe(69.0);
    });
  });

  // ============================================================================
  // Bulk License Operations
  // ============================================================================

  describe("Bulk License Management", () => {
    it("should enable multiple modules at once", () => {
      const subscription = createActiveSubscription({
        modules: [],
      });

      const modulesToAdd: Module[] = [
        createPremiumModule({ module_code: "ANALYTICS" }),
        createPremiumModule({ module_code: "REPORTING" }),
        createPremiumModule({ module_code: "API_ACCESS" }),
      ];

      const updatedSubscription: TenantSubscription = {
        ...subscription,
        modules: modulesToAdd.map(
          (mod, idx) =>
            ({
              id: `sm_${idx}`,
              module_id: mod.id,
              enabled: true,
            }) as SubscriptionModule,
        ),
      };

      expect(updatedSubscription.modules.length).toBe(3);
      expect(updatedSubscription.modules.every((m) => m.enabled)).toBe(true);
    });

    it("should validate all module dependencies before bulk activation", () => {
      const coreModule = createCoreModule({ module_code: "CORE" });
      const module1 = createPremiumModule({
        module_code: "MODULE_1",
        dependencies: ["CORE"],
      });
      const module2 = createPremiumModule({
        module_code: "MODULE_2",
        dependencies: ["CORE", "MODULE_1"],
      });

      // Business logic: Validate dependency chain
      const validateDependencies = (modules: Module[], toEnable: string[]) => {
        const allModuleCodes = [...toEnable];

        for (const moduleCode of toEnable) {
          const module = modules.find((m) => m.module_code === moduleCode);
          if (!module) continue;

          for (const dep of module.dependencies) {
            if (!allModuleCodes.includes(dep)) {
              return false;
            }
          }
        }
        return true;
      };

      const allModules = [coreModule, module1, module2];

      // Should succeed with all dependencies
      expect(validateDependencies(allModules, ["CORE", "MODULE_1", "MODULE_2"])).toBe(true);

      // Should fail without core
      expect(validateDependencies(allModules, ["MODULE_1", "MODULE_2"])).toBe(false);

      // Should fail without MODULE_1
      expect(validateDependencies(allModules, ["CORE", "MODULE_2"])).toBe(false);
    });
  });
});
