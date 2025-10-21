/**
 * Commission Engine Tests
 * Critical business logic testing for commission calculations
 */

import {
  CommissionEngine,
  CommissionTier,
  DEFAULT_COMMISSION_TIERS,
  calculateTierCommission,
  calculateTotalCommission,
  validateCommissionData,
  auditCommissionCalculation,
} from "../commission-engine";

describe("CommissionEngine", () => {
  let commissionEngine: CommissionEngine;

  beforeEach(() => {
    commissionEngine = new CommissionEngine();
  });

  describe("Tier-based Commission Calculations", () => {
    const testTier: CommissionTier = {
      id: "test_tier",
      name: "Test Tier",
      minimumRevenue: 10000,
      baseRate: 0.08, // 8%
      bonusRate: 0.02, // 2% bonus
      productMultipliers: {
        residential_basic: 1.0,
        residential_premium: 1.5,
        business_pro: 2.0,
        enterprise: 3.0,
      },
    };

    test("calculates basic commission correctly", () => {
      const revenue = 25000;
      const expectedCommission = revenue * testTier.baseRate; // 25000 * 0.08 = 2000

      const result = calculateTierCommission({
        revenue,
        tier: testTier,
        productType: "residential_basic",
      });

      expect(result.baseCommission).toBe(expectedCommission);
      expect(result.total).toBe(expectedCommission);
      expect(result.tier).toBe(testTier.id);
    });

    test("applies product multipliers correctly", () => {
      const revenue = 20000;
      const productType = "enterprise";
      const multiplier = testTier.productMultipliers![productType]; // 3.0
      const expectedCommission = revenue * testTier.baseRate * multiplier; // 20000 * 0.08 * 3.0 = 4800

      const result = calculateTierCommission({
        revenue,
        tier: testTier,
        productType,
      });

      expect(result.baseCommission).toBe(revenue * testTier.baseRate);
      expect(result.productBonus).toBe(revenue * testTier.baseRate * (multiplier - 1));
      expect(result.total).toBe(expectedCommission);
    });

    test("applies bonus rate when applicable", () => {
      const revenue = 50000;
      const baseCommission = revenue * testTier.baseRate;
      const bonusCommission = revenue * testTier.bonusRate!;
      const expectedTotal = baseCommission + bonusCommission;

      const result = calculateTierCommission({
        revenue,
        tier: testTier,
        productType: "residential_basic",
        applyBonusRate: true,
      });

      expect(result.baseCommission).toBe(baseCommission);
      expect(result.bonusCommission).toBe(bonusCommission);
      expect(result.total).toBe(expectedTotal);
    });

    test("handles minimum revenue requirements", () => {
      const revenue = 5000; // Below minimum of 10000

      const result = calculateTierCommission({
        revenue,
        tier: testTier,
        productType: "residential_basic",
      });

      expect(result.eligible).toBe(false);
      expect(result.total).toBe(0);
      expect(result.reason).toBe("Revenue below tier minimum");
    });

    test("calculates multi-tier commission structure", () => {
      const sales = [
        {
          revenue: 15000,
          productType: "residential_premium",
          partnerId: "P001",
        },
        { revenue: 30000, productType: "business_pro", partnerId: "P001" },
        { revenue: 50000, productType: "enterprise", partnerId: "P001" },
      ];

      const totalCommission = calculateTotalCommission({
        sales,
        tier: testTier,
        period: "2024-08",
      });

      const expectedTotal =
        15000 * 0.08 * 1.5 + // Premium residential: 1800
        30000 * 0.08 * 2.0 + // Business pro: 4800
        50000 * 0.08 * 3.0; // Enterprise: 12000
      // Total: 18600

      expect(totalCommission.total).toBe(expectedTotal);
      expect(totalCommission.breakdown).toHaveLength(3);
      expect(totalCommission.period).toBe("2024-08");
    });
  });

  describe("Commission Validation", () => {
    test("validates commission data structure", () => {
      const validData = {
        partnerId: "P001",
        revenue: 25000,
        productType: "residential_premium",
        salesDate: "2024-08-15",
        tier: "gold",
      };

      expect(() => validateCommissionData(validData)).not.toThrow();
    });

    test("rejects invalid commission data", () => {
      const invalidData = {
        partnerId: "",
        revenue: -1000, // Negative revenue
        productType: "invalid_type",
        salesDate: "invalid-date",
      };

      expect(() => validateCommissionData(invalidData)).toThrow("Invalid commission data");
    });

    test("validates revenue ranges", () => {
      const extremeRevenue = {
        revenue: 999999999,
        partnerId: "P001",
        productType: "enterprise",
      };

      expect(() => validateCommissionData(extremeRevenue)).toThrow(
        "Revenue exceeds maximum allowed",
      );
    });

    test("validates partner eligibility", () => {
      const suspendedPartner = {
        partnerId: "SUSPENDED_001",
        revenue: 10000,
        productType: "residential_basic",
      };

      expect(() => validateCommissionData(suspendedPartner)).toThrow(
        "Partner not eligible for commissions",
      );
    });
  });

  describe("Audit Trail and Security", () => {
    test("creates audit trail for commission calculations", () => {
      const calculationData = {
        partnerId: "P001",
        revenue: 25000,
        productType: "business_pro",
        tier: "gold",
        timestamp: new Date().toISOString(),
      };

      const auditRecord = auditCommissionCalculation(calculationData);

      expect(auditRecord).toMatchObject({
        partnerId: "P001",
        calculationType: "tier_commission",
        inputData: expect.objectContaining({
          revenue: 25000,
          productType: "business_pro",
        }),
        timestamp: expect.any(String),
        checksum: expect.any(String),
      });
    });

    test("detects tampering with commission data", () => {
      const originalData = { revenue: 25000, partnerId: "P001" };
      const tamperedData = { revenue: 50000, partnerId: "P001" }; // Revenue doubled

      const originalChecksum = commissionEngine.generateChecksum(originalData);
      const tamperedChecksum = commissionEngine.generateChecksum(tamperedData);

      expect(originalChecksum).not.toBe(tamperedChecksum);
    });

    test("maintains calculation history", () => {
      const calculations = [
        { partnerId: "P001", revenue: 10000, date: "2024-08-01" },
        { partnerId: "P001", revenue: 15000, date: "2024-08-15" },
        { partnerId: "P001", revenue: 20000, date: "2024-08-30" },
      ];

      calculations.forEach((calc) => commissionEngine.recordCalculation(calc));

      const history = commissionEngine.getCalculationHistory("P001", "2024-08");

      expect(history).toHaveLength(3);
      expect(history[0].revenue).toBe(10000);
      expect(history[2].revenue).toBe(20000);
    });
  });

  describe("Default Commission Tiers", () => {
    test("has valid default tier structure", () => {
      expect(DEFAULT_COMMISSION_TIERS).toHaveLength(4);

      const [bronze, silver, gold, platinum] = DEFAULT_COMMISSION_TIERS;

      expect(bronze.id).toBe("bronze");
      expect(bronze.minimumRevenue).toBe(0);
      expect(silver.minimumRevenue).toBeGreaterThan(bronze.minimumRevenue);
      expect(gold.minimumRevenue).toBeGreaterThan(silver.minimumRevenue);
      expect(platinum.minimumRevenue).toBeGreaterThan(gold.minimumRevenue);
    });

    test("has ascending commission rates", () => {
      const rates = DEFAULT_COMMISSION_TIERS.map((tier) => tier.baseRate);

      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeGreaterThan(rates[i - 1]);
      }
    });

    test("has consistent product multipliers", () => {
      DEFAULT_COMMISSION_TIERS.forEach((tier) => {
        expect(tier.productMultipliers).toBeDefined();
        expect(tier.productMultipliers!["residential_basic"]).toBe(1.0);
        expect(tier.productMultipliers!["enterprise"]).toBeGreaterThan(1.0);
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles zero revenue gracefully", () => {
      const result = calculateTierCommission({
        revenue: 0,
        tier: DEFAULT_COMMISSION_TIERS[0],
        productType: "residential_basic",
      });

      expect(result.total).toBe(0);
      expect(result.eligible).toBe(true); // Zero revenue is valid for bronze tier
    });

    test("handles missing product multipliers", () => {
      const tierWithoutMultipliers: CommissionTier = {
        id: "basic",
        name: "Basic Tier",
        minimumRevenue: 0,
        baseRate: 0.05,
      };

      const result = calculateTierCommission({
        revenue: 10000,
        tier: tierWithoutMultipliers,
        productType: "unknown_product",
      });

      expect(result.total).toBe(10000 * 0.05); // Base rate only
      expect(result.productBonus).toBe(0);
    });

    test("handles concurrent calculation requests", async () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        revenue: 10000 + i * 100,
        tier: DEFAULT_COMMISSION_TIERS[1],
        productType: "residential_premium",
      }));

      const results = await Promise.all(
        requests.map((req) => Promise.resolve(calculateTierCommission(req))),
      );

      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        const expectedRevenue = 10000 + index * 100;
        expect(result.inputRevenue).toBe(expectedRevenue);
        expect(result.total).toBeGreaterThan(0);
      });
    });

    test("prevents negative commission calculations", () => {
      const result = calculateTierCommission({
        revenue: -5000,
        tier: DEFAULT_COMMISSION_TIERS[0],
        productType: "residential_basic",
      });

      expect(result.eligible).toBe(false);
      expect(result.total).toBe(0);
      expect(result.reason).toContain("negative revenue");
    });
  });

  describe("Performance and Optimization", () => {
    test("calculates commissions within performance bounds", () => {
      const startTime = performance.now();

      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        revenue: Math.random() * 100000,
        tier: DEFAULT_COMMISSION_TIERS[Math.floor(Math.random() * 4)],
        productType: "residential_premium",
      }));

      largeBatch.forEach((item) => calculateTierCommission(item));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test("caches tier calculations efficiently", () => {
      const engine = new CommissionEngine({ enableCaching: true });
      const testData = {
        revenue: 25000,
        tier: DEFAULT_COMMISSION_TIERS[1],
        productType: "business_pro",
      };

      // First calculation
      const startTime1 = performance.now();
      const result1 = engine.calculateWithCaching(testData);
      const duration1 = performance.now() - startTime1;

      // Second identical calculation (should be cached)
      const startTime2 = performance.now();
      const result2 = engine.calculateWithCaching(testData);
      const duration2 = performance.now() - startTime2;

      expect(result1.total).toBe(result2.total);
      expect(duration2).toBeLessThan(duration1); // Cached result should be faster
    });
  });
});
