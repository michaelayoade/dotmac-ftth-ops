/**
 * Business Logic Validation Hook
 * Provides client-side business rule validation with server synchronization
 */

import { useCallback, useState } from "react";
import { commissionEngine } from "../business/commission-engine";
import { territoryValidator } from "../business/territory-validator";
import type { Customer } from "../validation/partner-schemas";

export interface BusinessValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface CustomerBusinessValidation extends BusinessValidationResult {
  territoryValidation?: {
    isInTerritory: boolean;
    assignedPartnerId?: string;
    territoryName?: string;
    confidence: number;
  };
  commissionEstimate?: {
    monthlyCommission: number;
    annualCommission: number;
    effectiveRate: number;
  };
}

export function useBusinessValidation(partnerId?: string) {
  const [validationCache, setValidationCache] = useState<Map<string, BusinessValidationResult>>(
    new Map(),
  );

  // Validate customer business rules
  const validateCustomer = useCallback(
    async (customer: Partial<Customer>): Promise<CustomerBusinessValidation> => {
      const warnings: string[] = [];
      const errors: string[] = [];
      const suggestions: string[] = [];

      let territoryValidation: CustomerBusinessValidation["territoryValidation"];
      let commissionEstimate: CustomerBusinessValidation["commissionEstimate"];

      try {
        // Territory validation
        if (customer.address && partnerId) {
          try {
            // Parse address for validation
            const addressParts = customer.address.split(",").map((s) => s.trim());
            if (addressParts.length >= 3) {
              const street = addressParts[0];
              const city = addressParts[1];
              const stateZip = addressParts[2]?.split(" ") ?? [];
              const [state, zipCode] = stateZip;

              if (street && city && state && zipCode) {
                const address = { street, city, state, zipCode };
                const result = await territoryValidator.validateAddress(address, partnerId);

                const validationDetails: NonNullable<
                  CustomerBusinessValidation["territoryValidation"]
                > = {
                  isInTerritory: result.isValid && result.assignedPartnerId === partnerId,
                  confidence: result.confidence,
                };

                if (result.assignedPartnerId) {
                  validationDetails.assignedPartnerId = result.assignedPartnerId;
                }

                if (result.territoryName) {
                  validationDetails.territoryName = result.territoryName;
                }

                territoryValidation = validationDetails;

                if (!result.isValid) {
                  errors.push("Customer address is not in any assigned territory");
                } else if (result.assignedPartnerId !== partnerId) {
                  errors.push(
                    `Customer is in territory assigned to partner ${result.assignedPartnerId}`,
                  );
                }

                if (result.warnings) {
                  warnings.push(...result.warnings);
                }

                if (result.confidence < 0.8) {
                  warnings.push(
                    "Territory assignment has low confidence - manual review recommended",
                  );
                }
              }
            }
          } catch (error) {
            warnings.push("Could not validate territory - address format may be incorrect");
          }
        }

        // Commission estimation
        if (customer.plan && customer.mrr && partnerId) {
          try {
            // Get partner's current tier (defaulting to Bronze for estimation)
            const tier = commissionEngine.determineEligibleTier(100000); // Assume $100k lifetime revenue for estimation

            const commissionResult = commissionEngine.calculateCommission({
              customerId: customer.id || "new-customer",
              partnerId,
              partnerTier: tier.id,
              productType: customer.plan,
              monthlyRevenue: customer.mrr,
              partnerLifetimeRevenue: 100000, // Default for estimation
              isNewCustomer: true,
              contractLength: 12, // Default 12 months
            });

            commissionEstimate = {
              monthlyCommission: commissionResult.totalCommission,
              annualCommission: commissionResult.totalCommission * 12,
              effectiveRate: commissionResult.effectiveRate,
            };

            // Add suggestions based on commission calculation
            if (commissionResult.effectiveRate < 0.05) {
              suggestions.push(
                "Consider upgrading customer to higher-value plan for better commission rates",
              );
            }

            if (commissionResult.breakdown.newCustomerBonus > 0) {
              suggestions.push(
                `New customer bonus of $${commissionResult.breakdown.newCustomerBonus.toFixed(2)} applies`,
              );
            }
          } catch (error) {
            warnings.push("Could not calculate commission estimate");
          }
        }

        // Business rule validations
        if (customer.mrr && customer.mrr < 10) {
          warnings.push("Monthly recurring revenue is very low - confirm pricing accuracy");
        }

        if (customer.mrr && customer.mrr > 1000) {
          suggestions.push("High-value customer - consider priority support assignment");
        }

        if (customer.plan === "enterprise" && customer.mrr && customer.mrr < 200) {
          warnings.push("Enterprise plan pricing seems low - verify plan selection");
        }

        if (customer.status === "suspended") {
          warnings.push("Customer account is suspended - resolve issues before activation");
        }

        if (customer.status === "pending" && customer.joinDate) {
          const joinDate = new Date(customer.joinDate);
          const daysSinceJoin = Math.floor(
            (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysSinceJoin > 30) {
            warnings.push("Customer has been pending for over 30 days - follow up required");
          }
        }

        const isValid = errors.length === 0;

        const validationResult: CustomerBusinessValidation = {
          isValid,
          warnings,
          errors,
          suggestions,
        };

        if (territoryValidation) {
          validationResult.territoryValidation = territoryValidation;
        }

        if (commissionEstimate) {
          validationResult.commissionEstimate = commissionEstimate;
        }

        return validationResult;
      } catch (error) {
        const validationResult: CustomerBusinessValidation = {
          isValid: false,
          warnings,
          errors: [
            ...errors,
            `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
          suggestions,
        };

        if (territoryValidation) {
          validationResult.territoryValidation = territoryValidation;
        }

        if (commissionEstimate) {
          validationResult.commissionEstimate = commissionEstimate;
        }

        return validationResult;
      }
    },
    [partnerId],
  );

  // Validate commission calculation
  const validateCommission = useCallback(
    (
      customerId: string,
      monthlyRevenue: number,
      productType: string,
      partnerTier: string,
      isNewCustomer: boolean = false,
      contractLength: number = 12,
    ): BusinessValidationResult => {
      const warnings: string[] = [];
      const errors: string[] = [];
      const suggestions: string[] = [];

      try {
        if (!partnerId) {
          errors.push("Partner ID is required for commission validation");
          return { isValid: false, warnings, errors, suggestions };
        }

        // Validate commission calculation
        const result = commissionEngine.calculateCommission({
          customerId,
          partnerId,
          partnerTier,
          productType,
          monthlyRevenue,
          partnerLifetimeRevenue: 100000, // This should come from actual partner data
          isNewCustomer,
          contractLength,
        });

        // Business rule checks
        if (result.effectiveRate > 0.25) {
          warnings.push("Commission rate exceeds 25% - verify calculation parameters");
        }

        if (result.totalCommission > monthlyRevenue * 0.5) {
          errors.push("Commission exceeds 50% of monthly revenue - calculation may be incorrect");
        }

        if (result.breakdown.newCustomerBonus > 0 && !isNewCustomer) {
          errors.push("New customer bonus applied to existing customer");
        }

        // Suggestions
        if (contractLength < 12) {
          suggestions.push("Longer contract terms may increase commission rates");
        }

        if (result.breakdown.territoryBonus === 0) {
          suggestions.push("Check if territory bonus applies for this customer location");
        }

        return {
          isValid: errors.length === 0,
          warnings,
          errors,
          suggestions,
        };
      } catch (error) {
        return {
          isValid: false,
          warnings,
          errors: [error instanceof Error ? error.message : "Commission validation failed"],
          suggestions,
        };
      }
    },
    [partnerId],
  );

  // Validate territory assignment
  const validateTerritoryAssignment = useCallback(
    async (address: string): Promise<BusinessValidationResult> => {
      const warnings: string[] = [];
      const errors: string[] = [];
      const suggestions: string[] = [];

      try {
        if (!partnerId) {
          errors.push("Partner ID is required for territory validation");
          return { isValid: false, warnings, errors, suggestions };
        }

        // Parse address
        const addressParts = address.split(",").map((s) => s.trim());
        if (addressParts.length < 3) {
          errors.push("Address must include street, city, and state/zip");
          return { isValid: false, warnings, errors, suggestions };
        }

        const street = addressParts[0];
        const city = addressParts[1];
        const stateZip = addressParts[2]?.split(" ") ?? [];
        const [state, zipCode] = stateZip;

        if (!street || !city || !state || !zipCode) {
          errors.push("Incomplete address information");
          return { isValid: false, warnings, errors, suggestions };
        }

        const addressObj = { street, city, state, zipCode };
        const result = await territoryValidator.validateAddress(addressObj, partnerId);

        if (!result.isValid) {
          errors.push("Address is not in any assigned territory");
        } else if (result.assignedPartnerId !== partnerId) {
          errors.push(`Address is in territory assigned to partner ${result.assignedPartnerId}`);
          suggestions.push("Contact territory management for reassignment if needed");
        }

        if (result.confidence < 0.7) {
          warnings.push("Low confidence territory match - manual review recommended");
        }

        if (result.warnings) {
          warnings.push(...result.warnings);
        }

        return {
          isValid: errors.length === 0,
          warnings,
          errors,
          suggestions,
        };
      } catch (error) {
        return {
          isValid: false,
          warnings,
          errors: [
            `Territory validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
          suggestions,
        };
      }
    },
    [partnerId],
  );

  // Get cached validation result
  const getCachedValidation = useCallback(
    (key: string): BusinessValidationResult | null => {
      return validationCache.get(key) || null;
    },
    [validationCache],
  );

  // Cache validation result
  const cacheValidation = useCallback((key: string, result: BusinessValidationResult) => {
    setValidationCache((prev) => new Map(prev.set(key, result)));
  }, []);

  return {
    validateCustomer,
    validateCommission,
    validateTerritoryAssignment,
    getCachedValidation,
    cacheValidation,
  };
}
