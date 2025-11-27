/**
 * Commission Calculation Engine
 * Handles secure, validated commission calculations with audit trails
 */

import { z } from "zod";

// Commission Tier Configuration
export interface CommissionTier {
  id: string;
  name: string;
  minimumRevenue: number;
  baseRate: number; // Percentage as decimal (0.05 = 5%)
  bonusRate?: number; // Additional bonus rate
  productMultipliers?: Record<string, number>; // Product-specific multipliers
}

// Default commission tiers
export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  {
    id: "bronze",
    name: "Bronze Partner",
    minimumRevenue: 0,
    baseRate: 0.05, // 5%
    productMultipliers: {
      residential_basic: 1.0,
      residential_premium: 1.2,
      business_pro: 1.5,
      enterprise: 2.0,
    },
  },
  {
    id: "silver",
    name: "Silver Partner",
    minimumRevenue: 50000,
    baseRate: 0.07, // 7%
    bonusRate: 0.01, // 1% bonus
    productMultipliers: {
      residential_basic: 1.0,
      residential_premium: 1.3,
      business_pro: 1.6,
      enterprise: 2.2,
    },
  },
  {
    id: "gold",
    name: "Gold Partner",
    minimumRevenue: 150000,
    baseRate: 0.1, // 10%
    bonusRate: 0.02, // 2% bonus
    productMultipliers: {
      residential_basic: 1.1,
      residential_premium: 1.4,
      business_pro: 1.8,
      enterprise: 2.5,
    },
  },
  {
    id: "platinum",
    name: "Platinum Partner",
    minimumRevenue: 500000,
    baseRate: 0.12, // 12%
    bonusRate: 0.03, // 3% bonus
    productMultipliers: {
      residential_basic: 1.2,
      residential_premium: 1.5,
      business_pro: 2.0,
      enterprise: 3.0,
    },
  },
];

// Commission Calculation Input Schema
const CommissionCalculationInputSchema = z.object({
  customerId: z.string().min(1),
  partnerId: z.string().min(1),
  partnerTier: z.enum(["bronze", "silver", "gold", "platinum"]),
  productType: z.enum(["residential_basic", "residential_premium", "business_pro", "enterprise"]),
  monthlyRevenue: z.number().min(0),
  partnerLifetimeRevenue: z.number().min(0),
  isNewCustomer: z.boolean(),
  contractLength: z.number().min(1).max(36), // 1-36 months
  promotionalRate: z.number().min(0).max(1).optional(),
  territoryBonus: z.number().min(0).max(0.05).optional(), // Max 5% territory bonus
});

// Commission Calculation Result
export interface CommissionResult {
  customerId: string;
  partnerId: string;
  baseCommission: number;
  bonusCommission: number;
  totalCommission: number;
  effectiveRate: number;
  tier: string;
  breakdown: {
    baseAmount: number;
    tierMultiplier: number;
    productMultiplier: number;
    newCustomerBonus: number;
    territoryBonus: number;
    contractLengthBonus: number;
    promotionalAdjustment: number;
  };
  calculatedAt: string;
  auditTrail: string[];
}

export interface CommissionEngineConfig {
  enableCaching?: boolean;
}

export class CommissionEngine {
  private tiers: CommissionTier[];
  private auditLog: string[] = [];
  private cache: Map<string, CommissionResult> | null;
  private history: Record<string, Array<Record<string, any>>> = {};

  constructor(customTiers?: CommissionTier[], config: CommissionEngineConfig = {}) {
    this.tiers = customTiers || DEFAULT_COMMISSION_TIERS;
    this.cache = config.enableCaching ? new Map() : null;
  }

  private addAudit(message: string): void {
    const timestamp = new Date().toISOString();
    this.auditLog.push(`${timestamp}: ${message}`);
  }

  private getTier(tierName: string): CommissionTier {
    const tier = this.tiers.find((t) => t.id === tierName);
    if (!tier) {
      throw new Error(`Invalid commission tier: ${tierName}`);
    }
    return tier;
  }

  private validateTierEligibility(lifetimeRevenue: number, tier: CommissionTier): boolean {
    return lifetimeRevenue >= tier.minimumRevenue;
  }

  private calculateNewCustomerBonus(tier: CommissionTier, monthlyRevenue: number): number {
    // New customer bonus: 50% of first month's commission
    const baseCommission = monthlyRevenue * tier.baseRate;
    return baseCommission * 0.5;
  }

  private calculateContractLengthBonus(contractLength: number, baseCommission: number): number {
    // Bonus based on contract length
    if (contractLength >= 24) return baseCommission * 0.1; // 10% for 2+ years
    if (contractLength >= 12) return baseCommission * 0.05; // 5% for 1+ year
    return 0;
  }

  private calculateTerritoryBonus(territoryBonus: number = 0, baseCommission: number): number {
    return baseCommission * territoryBonus;
  }

  private applyPromotionalAdjustment(promotionalRate: number = 1, totalCommission: number): number {
    return totalCommission * promotionalRate;
  }

  calculateCommission(input: unknown): CommissionResult {
    // Clear previous audit log
    this.auditLog = [];

    // Validate input
    const validatedInput = CommissionCalculationInputSchema.parse(input);
    this.addAudit(`Starting commission calculation for customer ${validatedInput.customerId}`);

    const tier = this.getTier(validatedInput.partnerTier);
    this.addAudit(`Using tier: ${tier.name} (${tier.baseRate * 100}% base rate)`);

    // Validate tier eligibility
    if (!this.validateTierEligibility(validatedInput.partnerLifetimeRevenue, tier)) {
      const error = `Partner not eligible for ${tier.name} tier (requires $${tier.minimumRevenue}, has $${validatedInput.partnerLifetimeRevenue})`;
      this.addAudit(`ERROR: ${error}`);
      throw new Error(error);
    }

    // Base commission calculation
    const baseAmount = validatedInput.monthlyRevenue;
    const tierMultiplier = tier.baseRate + (tier.bonusRate || 0);
    const productMultiplier = tier.productMultipliers?.[validatedInput.productType] || 1;

    const baseCommission = baseAmount * tierMultiplier * productMultiplier;
    this.addAudit(
      `Base commission: $${baseAmount} × ${tierMultiplier} × ${productMultiplier} = $${baseCommission.toFixed(2)}`,
    );

    // Calculate bonuses
    const newCustomerBonus = validatedInput.isNewCustomer
      ? this.calculateNewCustomerBonus(tier, validatedInput.monthlyRevenue)
      : 0;

    const contractLengthBonus = this.calculateContractLengthBonus(
      validatedInput.contractLength,
      baseCommission,
    );

    const territoryBonus = this.calculateTerritoryBonus(
      validatedInput.territoryBonus,
      baseCommission,
    );

    this.addAudit(`New customer bonus: $${newCustomerBonus.toFixed(2)}`);
    this.addAudit(`Contract length bonus: $${contractLengthBonus.toFixed(2)}`);
    this.addAudit(`Territory bonus: $${territoryBonus.toFixed(2)}`);

    // Calculate total before promotional adjustment
    const prePromotionalTotal =
      baseCommission + newCustomerBonus + contractLengthBonus + territoryBonus;

    // Apply promotional adjustment
    const promotionalAdjustment = this.applyPromotionalAdjustment(
      validatedInput.promotionalRate,
      prePromotionalTotal,
    );

    const totalCommission = promotionalAdjustment;
    const bonusCommission = newCustomerBonus + contractLengthBonus + territoryBonus;
    const effectiveRate = totalCommission / validatedInput.monthlyRevenue;

    this.addAudit(
      `Final commission: $${totalCommission.toFixed(2)} (${(effectiveRate * 100).toFixed(2)}% effective rate)`,
    );

    // Security check: Ensure commission doesn't exceed reasonable limits
    const maxCommissionRate = 0.5; // 50% maximum
    if (effectiveRate > maxCommissionRate) {
      const error = `Commission rate ${(effectiveRate * 100).toFixed(2)}% exceeds maximum allowed ${maxCommissionRate * 100}%`;
      this.addAudit(`SECURITY ERROR: ${error}`);
      throw new Error(error);
    }

    return {
      customerId: validatedInput.customerId,
      partnerId: validatedInput.partnerId,
      baseCommission,
      bonusCommission,
      totalCommission,
      effectiveRate,
      tier: tier.name,
      breakdown: {
        baseAmount,
        tierMultiplier,
        productMultiplier,
        newCustomerBonus,
        territoryBonus,
        contractLengthBonus,
        promotionalAdjustment: promotionalAdjustment - prePromotionalTotal,
      },
      calculatedAt: new Date().toISOString(),
      auditTrail: [...this.auditLog],
    };
  }

  // Batch calculation with transaction safety
  calculateBatchCommissions(inputs: unknown[]): CommissionResult[] {
    const results: CommissionResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < inputs.length; i++) {
      try {
        const result = this.calculateCommission(inputs[i]);
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (errors.length > 0) {
      throw new Error(`Batch calculation failed: ${JSON.stringify(errors)}`);
    }

    return results;
  }

  // Commission validation for existing records
  validateCommission(commission: CommissionResult, originalInput: unknown): boolean {
    try {
      const recalculated = this.calculateCommission(originalInput);

      // Compare with tolerance for floating point precision
      const tolerance = 0.01;
      const totalMatch =
        Math.abs(recalculated.totalCommission - commission.totalCommission) < tolerance;
      const rateMatch = Math.abs(recalculated.effectiveRate - commission.effectiveRate) < tolerance;

      return totalMatch && rateMatch;
    } catch (error) {
      return false;
    }
  }

  // Get partner tier based on lifetime revenue
  determineEligibleTier(lifetimeRevenue: number): CommissionTier {
    // Find the highest tier the partner qualifies for
    const eligibleTiers = this.tiers
      .filter((tier) => lifetimeRevenue >= tier.minimumRevenue)
      .sort((a, b) => b.minimumRevenue - a.minimumRevenue);

    const bestTier = eligibleTiers[0];
    if (bestTier) {
      return bestTier;
    }

    const fallbackTier = this.tiers[0];
    if (fallbackTier) {
      return fallbackTier;
    }

    throw new Error("No commission tiers configured");
  }

  // Simulate commission for what-if scenarios
  simulateCommission(
    baseRevenue: number,
    targetTier: string,
    productMix: Record<string, number>,
  ): { projectedCommissions: number; revenueNeeded: number } {
    const tier = this.getTier(targetTier);
    let totalCommissions = 0;

    for (const [productType, revenue] of Object.entries(productMix)) {
      const multiplier = tier.productMultipliers?.[productType] || 1;
      const commission = revenue * (tier.baseRate + (tier.bonusRate || 0)) * multiplier;
      totalCommissions += commission;
    }

    const revenueNeeded = Math.max(0, tier.minimumRevenue - baseRevenue);

    return {
      projectedCommissions: totalCommissions,
      revenueNeeded,
    };
  }

  calculateWithCaching(input: unknown): CommissionResult {
    const key = JSON.stringify(input);
    if (this.cache && this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      return { ...cached, auditTrail: [...cached.auditTrail] };
    }

    const result = this.calculateCommission(input);
    if (this.cache) {
      this.cache.set(key, result);
    }
    return result;
  }

  generateChecksum(data: Record<string, unknown>): string {
    const payload = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return `chk_${Math.abs(hash)}`;
  }

  recordCalculation(calculation: Record<string, any>) {
    const partnerId = calculation.partnerId || "unknown";
    if (!this.history[partnerId]) {
      this.history[partnerId] = [];
    }
    this.history[partnerId].push(calculation);
  }

  getCalculationHistory(partnerId: string, period?: string) {
    const records = this.history[partnerId] || [];
    if (!period) return records;
    return records.filter((entry) => {
      const timestamp = entry.date || entry.timestamp || entry.period || "";
      return typeof timestamp === "string" && timestamp.includes(period);
    });
  }
}

// Global commission engine instance
export const commissionEngine = new CommissionEngine();

interface TierCommissionInput {
  revenue: number;
  tier: CommissionTier;
  productType: string;
  applyBonusRate?: boolean;
}

export function calculateTierCommission({
  revenue,
  tier,
  productType,
  applyBonusRate = false,
}: TierCommissionInput) {
  if (revenue < 0) {
    return {
      eligible: false,
      reason: "Commission cannot be calculated for negative revenue",
      total: 0,
      baseCommission: 0,
      productBonus: 0,
      bonusCommission: 0,
      tier: tier.id,
      inputRevenue: revenue,
    };
  }

  const eligible = revenue >= (tier.minimumRevenue ?? 0);
  if (!eligible) {
    return {
      eligible,
      reason: "Revenue below tier minimum",
      total: 0,
      baseCommission: 0,
      productBonus: 0,
      bonusCommission: 0,
      tier: tier.id,
      inputRevenue: revenue,
    };
  }

  const baseCommission = revenue * (tier.baseRate || 0);
  const multiplier = tier.productMultipliers?.[productType] ?? 1;
  const productBonus = baseCommission * (multiplier - 1);
  const bonusCommission = applyBonusRate && tier.bonusRate ? revenue * tier.bonusRate : 0;
  const total = baseCommission * multiplier + bonusCommission;

  return {
    eligible: true,
    reason: undefined,
    baseCommission,
    productBonus,
    bonusCommission,
    total,
    tier: tier.id,
    inputRevenue: revenue,
  };
}

export function calculateTotalCommission({
  sales,
  tier,
  period,
}: {
  sales: Array<{ revenue: number; productType: string; partnerId: string }>;
  tier: CommissionTier;
  period: string;
}) {
  const breakdown = sales.map((sale) => ({
    partnerId: sale.partnerId,
    ...calculateTierCommission({ revenue: sale.revenue, tier, productType: sale.productType }),
  }));

  const total = breakdown.reduce((sum, item) => sum + (item.total || 0), 0);

  return { total, breakdown, period };
}

export function validateCommissionData(data: Record<string, any>) {
  if (!data.partnerId || typeof data.revenue !== "number" || data.revenue < 0) {
    throw new Error("Invalid commission data");
  }
  if (data.revenue > 1_000_000_000) {
    throw new Error("Revenue exceeds maximum allowed");
  }
  const validProducts = [
    "residential_basic",
    "residential_premium",
    "business_pro",
    "enterprise",
  ];
  if (data.productType && !validProducts.includes(data.productType)) {
    throw new Error("Invalid commission data");
  }
  if (data.partnerId?.startsWith("SUSPENDED")) {
    throw new Error("Partner not eligible for commissions");
  }
  return true;
}

export function auditCommissionCalculation(inputData: Record<string, any>) {
  return {
    partnerId: inputData.partnerId,
    calculationType: "tier_commission",
    inputData,
    timestamp: new Date().toISOString(),
    checksum: commissionEngine.generateChecksum(inputData),
  };
}
