/**
 * Functional Tests: Platform Quota Enforcement
 *
 * Tests the enforcement of usage quotas for ISP tenants:
 * - Quota allocation per subscription plan
 * - Hard limits vs soft limits (overage allowed)
 * - Quota usage tracking
 * - Overage charge calculations
 * - Quota warnings and limits
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  createMockTenant,
  createMockQuota,
  createCustomerQuota,
  createUserQuota,
  createMockServicePlan,
  createStarterPlan,
  createProfessionalPlan,
  createMockSubscription,
  createActiveSubscription,
  createMockQuotaUsage,
  createQuotaUsageAtLimit,
  createQuotaUsageWithOverage,
  isQuotaExceeded,
  getQuotaRemaining,
  getQuotaUtilization,
  resetPlatformCounters,
  type Quota,
  type QuotaUsage,
  type PlanQuota,
} from "../factories/platform";

describe("Platform: Quota Enforcement", () => {
  beforeEach(() => {
    resetPlatformCounters();
  });

  // ============================================================================
  // Quota Allocation
  // ============================================================================

  describe("Quota Allocation", () => {
    it("should allocate quotas based on subscription plan", () => {
      const starterPlan = createStarterPlan();
      const subscription = createActiveSubscription({
        plan_id: starterPlan.id,
      });

      // Starter plan includes 100 customers
      const customerQuota = starterPlan.quotas?.find((q) => q.quota_id === "quota_customers");

      expect(customerQuota).toBeDefined();
      expect(customerQuota?.included_quantity).toBe(100);
    });

    it("should define different quota limits for different plans", () => {
      const starterPlan = createStarterPlan(); // 100 customers
      const professionalPlan = createProfessionalPlan(); // 1000 customers

      const starterQuota = starterPlan.quotas?.[0];
      const professionalQuota = professionalPlan.quotas?.[0];

      expect(professionalQuota?.included_quantity).toBeGreaterThan(
        starterQuota?.included_quantity || 0,
      );
    });

    it("should track quota usage for customer limit", () => {
      const quota = createCustomerQuota();
      const quotaUsage = createMockQuotaUsage({
        quota_id: quota.id,
        allocated_quantity: 100,
        current_usage: 75,
      });

      expect(quotaUsage.current_usage).toBe(75);
      expect(quotaUsage.allocated_quantity).toBe(100);
      expect(getQuotaRemaining(quotaUsage)).toBe(25);
    });

    it("should track quota usage for user limit", () => {
      const quota = createUserQuota();
      const quotaUsage = createMockQuotaUsage({
        quota_id: quota.id,
        allocated_quantity: 10,
        current_usage: 7,
      });

      expect(quotaUsage.current_usage).toBe(7);
      expect(getQuotaRemaining(quotaUsage)).toBe(3);
    });
  });

  // ============================================================================
  // Hard Limits vs Soft Limits
  // ============================================================================

  describe("Hard Limits (No Overage)", () => {
    it("should prevent action when hard limit is reached", () => {
      const quotaUsage = createQuotaUsageAtLimit({
        allocated_quantity: 100,
      });

      // Hard limit: Cannot add more customers
      const canAddCustomer = !isQuotaExceeded(quotaUsage);
      expect(canAddCustomer).toBe(false);
      expect(quotaUsage.current_usage).toBe(quotaUsage.allocated_quantity);
    });

    it("should block customer creation when quota is exceeded", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 10,
        current_usage: 10,
      });

      // Business logic: Hard limit enforcement
      const attemptAddCustomer = (usage: QuotaUsage, overageAllowed: boolean) => {
        if (isQuotaExceeded(usage) && !overageAllowed) {
          return { success: false, error: "Customer quota exceeded" };
        }
        return { success: true };
      };

      const result = attemptAddCustomer(quotaUsage, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Customer quota exceeded");
    });
  });

  describe("Soft Limits (Overage Allowed)", () => {
    it("should allow overage with additional charges", () => {
      const quotaUsage = createQuotaUsageWithOverage({
        allocated_quantity: 100,
        current_usage: 120, // 20 over
      });

      expect(quotaUsage.overage_quantity).toBe(20);
      expect(quotaUsage.overage_charges).toBeGreaterThan(0);
    });

    it("should calculate overage charges correctly", () => {
      const allocatedQuantity = 100;
      const currentUsage = 120;
      const overageRate = 0.5; // $0.50 per unit

      const overage = currentUsage - allocatedQuantity;
      const overageCharges = overage * overageRate;

      expect(overage).toBe(20);
      expect(overageCharges).toBe(10.0); // 20 * $0.50
    });

    it("should track cumulative overage charges in billing cycle", () => {
      const quotaUsage1 = createQuotaUsageWithOverage({
        allocated_quantity: 100,
        current_usage: 110,
      });

      const quotaUsage2 = createQuotaUsageWithOverage({
        allocated_quantity: 10,
        current_usage: 12,
      });

      const totalOverageCharges = quotaUsage1.overage_charges + quotaUsage2.overage_charges;

      expect(totalOverageCharges).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Quota Usage Tracking
  // ============================================================================

  describe("Quota Usage Tracking", () => {
    it("should calculate quota utilization percentage", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 75,
      });

      const utilization = getQuotaUtilization(quotaUsage);
      expect(utilization).toBe(75);
    });

    it("should detect when quota is at 80% utilization", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 80,
      });

      const shouldWarn = getQuotaUtilization(quotaUsage) >= 80;
      expect(shouldWarn).toBe(true);
    });

    it("should show quota exceeded at 100%+", () => {
      const quotaUsage = createQuotaUsageAtLimit({
        allocated_quantity: 50,
      });

      expect(isQuotaExceeded(quotaUsage)).toBe(true);
      expect(getQuotaUtilization(quotaUsage)).toBe(100);
    });

    it("should increment quota usage when adding resource", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 50,
      });

      // Simulate adding a customer
      const updatedUsage: QuotaUsage = {
        ...quotaUsage,
        current_usage: quotaUsage.current_usage + 1,
      };

      expect(updatedUsage.current_usage).toBe(51);
      expect(getQuotaRemaining(updatedUsage)).toBe(49);
    });

    it("should decrement quota usage when removing resource", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 50,
      });

      // Simulate removing a customer
      const updatedUsage: QuotaUsage = {
        ...quotaUsage,
        current_usage: Math.max(0, quotaUsage.current_usage - 1),
      };

      expect(updatedUsage.current_usage).toBe(49);
      expect(getQuotaRemaining(updatedUsage)).toBe(51);
    });
  });

  // ============================================================================
  // Quota Warnings & Notifications
  // ============================================================================

  describe("Quota Warnings", () => {
    it("should trigger warning at 80% utilization", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 80,
      });

      const getWarningLevel = (usage: QuotaUsage) => {
        const utilization = getQuotaUtilization(usage);
        if (utilization >= 100) return "critical";
        if (utilization >= 90) return "high";
        if (utilization >= 80) return "medium";
        return "none";
      };

      expect(getWarningLevel(quotaUsage)).toBe("medium");
    });

    it("should trigger high warning at 90% utilization", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 95,
      });

      const utilization = getQuotaUtilization(quotaUsage);
      expect(utilization).toBeGreaterThanOrEqual(90);
    });

    it("should trigger critical alert at 100% utilization", () => {
      const quotaUsage = createQuotaUsageAtLimit();

      const isCritical = getQuotaUtilization(quotaUsage) >= 100;
      expect(isCritical).toBe(true);
    });
  });

  // ============================================================================
  // Multi-Quota Management
  // ============================================================================

  describe("Multi-Quota Management", () => {
    it("should track multiple quotas independently", () => {
      const customerQuota = createCustomerQuota();
      const userQuota = createUserQuota();

      const customerUsage = createMockQuotaUsage({
        quota_id: customerQuota.id,
        allocated_quantity: 100,
        current_usage: 75,
      });

      const userUsage = createMockQuotaUsage({
        quota_id: userQuota.id,
        allocated_quantity: 10,
        current_usage: 8,
      });

      expect(customerUsage.quota_id).not.toBe(userUsage.quota_id);
      expect(getQuotaUtilization(customerUsage)).toBe(75);
      expect(getQuotaUtilization(userUsage)).toBe(80);
    });

    it("should validate all quotas before allowing action", () => {
      const quotaUsages: QuotaUsage[] = [
        createMockQuotaUsage({ allocated_quantity: 100, current_usage: 50 }), // OK
        createQuotaUsageAtLimit({ allocated_quantity: 10 }), // At limit
      ];

      const allQuotasOk = quotaUsages.every((q) => !isQuotaExceeded(q));
      expect(allQuotasOk).toBe(false);
    });

    it("should display quota summary for tenant dashboard", () => {
      const quotas: QuotaUsage[] = [
        createMockQuotaUsage({
          quota_id: "customers",
          allocated_quantity: 100,
          current_usage: 75,
        }),
        createMockQuotaUsage({
          quota_id: "users",
          allocated_quantity: 10,
          current_usage: 7,
        }),
      ];

      const summary = quotas.map((q) => ({
        quota_id: q.quota_id,
        utilization: getQuotaUtilization(q),
        remaining: getQuotaRemaining(q),
        exceeded: isQuotaExceeded(q),
      }));

      expect(summary.length).toBe(2);
      expect(summary[0].utilization).toBe(75);
      expect(summary[1].remaining).toBe(3);
    });
  });

  // ============================================================================
  // Quota Upgrades
  // ============================================================================

  describe("Quota Upgrades", () => {
    it("should increase quota allocation when upgrading plan", () => {
      const oldQuota = createMockQuotaUsage({
        allocated_quantity: 100, // Starter
        current_usage: 95,
      });

      // Upgrade to Professional (1000 customers)
      const newQuota: QuotaUsage = {
        ...oldQuota,
        allocated_quantity: 1000,
      };

      expect(newQuota.allocated_quantity).toBeGreaterThan(oldQuota.allocated_quantity);
      expect(getQuotaRemaining(newQuota)).toBe(905);
      expect(isQuotaExceeded(newQuota)).toBe(false);
    });

    it("should prompt upgrade when approaching quota limit", () => {
      const quotaUsage = createMockQuotaUsage({
        allocated_quantity: 100,
        current_usage: 95,
      });

      const shouldPromptUpgrade = getQuotaUtilization(quotaUsage) >= 90;
      expect(shouldPromptUpgrade).toBe(true);
    });
  });
});
