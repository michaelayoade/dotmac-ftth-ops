/**
 * Territory Validation Service
 * Handles geographic boundary validation and partner territory enforcement
 */

import { z } from "zod";

// Territory Definition Schema
const TerritorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  partnerId: z.string().min(1),
  boundaries: z.object({
    zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).optional(),
    cities: z.array(z.string().min(1)).optional(),
    counties: z.array(z.string().min(1)).optional(),
    states: z.array(z.string().length(2)).optional(),
    coordinates: z
      .object({
        polygon: z.array(
          z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          }),
        ),
      })
      .optional(),
  }),
  exclusions: z
    .object({
      zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).optional(),
      addresses: z.array(z.string().min(5)).optional(),
    })
    .optional(),
  priority: z.number().min(1).max(10).default(5), // Higher number = higher priority
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Address validation schema
const AddressSchema = z.object({
  street: z.string().min(5).max(200),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().length(2).default("US"),
});

// Validation result schema
const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  assignedPartnerId: z.string().optional(),
  territoryId: z.string().optional(),
  territoryName: z.string().optional(),
  conflictingTerritories: z
    .array(
      z.object({
        territoryId: z.string(),
        territoryName: z.string(),
        partnerId: z.string(),
        priority: z.number(),
      }),
    )
    .optional(),
  validationMethod: z.enum(["zipcode", "city", "county", "state", "coordinates"]),
  confidence: z.number().min(0).max(1), // 0-1 confidence score
  warnings: z.array(z.string()).optional(),
});

export type Territory = z.infer<typeof TerritorySchema>;
export type Address = z.infer<typeof AddressSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export class TerritoryValidator {
  private territories: Territory[] = [];
  private geocodingService:
    | ((address: Address) => Promise<{ lat: number; lng: number }>)
    | undefined;

  constructor(
    territories: Territory[] = [],
    geocodingService?: (address: Address) => Promise<{ lat: number; lng: number }>,
  ) {
    this.territories = territories.map((t) => TerritorySchema.parse(t));
    this.geocodingService = geocodingService;
  }

  // Add or update territory
  addTerritory(territory: unknown): void {
    const validatedTerritory = TerritorySchema.parse(territory);
    const existingIndex = this.territories.findIndex((t) => t.id === validatedTerritory.id);

    if (existingIndex >= 0) {
      this.territories[existingIndex] = validatedTerritory;
    } else {
      this.territories.push(validatedTerritory);
    }
  }

  // Remove territory
  removeTerritory(territoryId: string): void {
    this.territories = this.territories.filter((t) => t.id !== territoryId);
  }

  // Get territories for a partner
  getPartnerTerritories(partnerId: string): Territory[] {
    return this.territories.filter((t) => t.partnerId === partnerId && t.isActive);
  }

  // Validate address against territories
  async validateAddress(address: unknown, requestingPartnerId?: string): Promise<ValidationResult> {
    const validatedAddress = AddressSchema.parse(address);

    const activeTerritories = this.territories.filter((t) => t.isActive);
    const matchingTerritories: Array<{
      territory: Territory;
      method: ValidationResult["validationMethod"];
      confidence: number;
    }> = [];

    // 1. Check ZIP code matches (highest confidence)
    for (const territory of activeTerritories) {
      if (territory.boundaries.zipCodes?.includes(validatedAddress.zipCode)) {
        // Check exclusions
        if (!this.isExcluded(validatedAddress, territory)) {
          matchingTerritories.push({
            territory,
            method: "zipcode",
            confidence: 0.95,
          });
        }
      }
    }

    // 2. Check city matches if no ZIP code match
    if (matchingTerritories.length === 0) {
      for (const territory of activeTerritories) {
        if (
          territory.boundaries.cities?.some(
            (city) => city.toLowerCase() === validatedAddress.city.toLowerCase(),
          )
        ) {
          if (!this.isExcluded(validatedAddress, territory)) {
            matchingTerritories.push({
              territory,
              method: "city",
              confidence: 0.8,
            });
          }
        }
      }
    }

    // 3. Check state matches (lowest confidence)
    if (matchingTerritories.length === 0) {
      for (const territory of activeTerritories) {
        if (territory.boundaries.states?.includes(validatedAddress.state)) {
          if (!this.isExcluded(validatedAddress, territory)) {
            matchingTerritories.push({
              territory,
              method: "state",
              confidence: 0.4,
            });
          }
        }
      }
    }

    // 4. Geographic coordinate validation (if geocoding service available)
    if (matchingTerritories.length === 0 && this.geocodingService) {
      try {
        const coordinates = await this.geocodingService(validatedAddress);

        for (const territory of activeTerritories) {
          if (territory.boundaries.coordinates) {
            if (this.isPointInPolygon(coordinates, territory.boundaries.coordinates.polygon)) {
              if (!this.isExcluded(validatedAddress, territory)) {
                matchingTerritories.push({
                  territory,
                  method: "coordinates",
                  confidence: 0.9,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn("Geocoding failed:", error);
      }
    }

    // Sort by priority and confidence
    matchingTerritories.sort((a, b) => {
      const priorityDiff = b.territory.priority - a.territory.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    const warnings: string[] = [];

    if (matchingTerritories.length === 0) {
      return ValidationResultSchema.parse({
        isValid: false,
        validationMethod: "state",
        confidence: 0,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    const bestMatch = matchingTerritories[0]!;
    const conflictingTerritories = matchingTerritories.slice(1).map((mt) => ({
      territoryId: mt.territory.id,
      territoryName: mt.territory.name,
      partnerId: mt.territory.partnerId,
      priority: mt.territory.priority,
    }));

    if (conflictingTerritories.length > 0) {
      warnings.push(`Address matches multiple territories. Using highest priority territory.`);
    }

    // Check partner access
    if (requestingPartnerId) {
      const assignedPartnerId = bestMatch.territory.partnerId;
      if (assignedPartnerId !== requestingPartnerId) {
        warnings.push(`Address is in territory assigned to partner ${assignedPartnerId}`);
      }
    }

    return ValidationResultSchema.parse({
      isValid: true,
      assignedPartnerId: bestMatch.territory.partnerId,
      territoryId: bestMatch.territory.id,
      territoryName: bestMatch.territory.name,
      conflictingTerritories:
        conflictingTerritories.length > 0 ? conflictingTerritories : undefined,
      validationMethod: bestMatch.method || "state",
      confidence: bestMatch.confidence || 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  // Check if address is in exclusion list
  private isExcluded(address: Address, territory: Territory): boolean {
    if (!territory.exclusions) return false;

    // Check ZIP code exclusions
    if (territory.exclusions.zipCodes?.includes(address.zipCode)) {
      return true;
    }

    // Check address exclusions (simple string match)
    if (territory.exclusions.addresses) {
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
      return territory.exclusions.addresses.some((excludedAddress) =>
        fullAddress.toLowerCase().includes(excludedAddress.toLowerCase()),
      );
    }

    return false;
  }

  // Point-in-polygon algorithm for coordinate-based validation
  private isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: Array<{ lat: number; lng: number }>,
  ): boolean {
    if (polygon.length < 3) {
      return false;
    }

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const current = polygon[i]!;
      const previous = polygon[j]!;
      if (
        current.lng > point.lng !== previous.lng > point.lng &&
        point.lat <
          ((previous.lat - current.lat) * (point.lng - current.lng)) /
            (previous.lng - current.lng) +
            current.lat
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  // Validate partner has access to territory
  validatePartnerAccess(partnerId: string, territoryId: string): boolean {
    const territory = this.territories.find((t) => t.id === territoryId);
    return territory?.partnerId === partnerId && territory?.isActive === true;
  }

  // Get territory coverage statistics
  getTerritoryStats(territoryId: string): {
    zipCodeCount: number;
    cityCount: number;
    hasCoordinateBoundaries: boolean;
    priority: number;
    isActive: boolean;
  } {
    const territory = this.territories.find((t) => t.id === territoryId);

    if (!territory) {
      throw new Error(`Territory ${territoryId} not found`);
    }

    return {
      zipCodeCount: territory.boundaries.zipCodes?.length || 0,
      cityCount: territory.boundaries.cities?.length || 0,
      hasCoordinateBoundaries: !!territory.boundaries.coordinates,
      priority: territory.priority,
      isActive: territory.isActive,
    };
  }

  // Find optimal territory assignments to minimize conflicts
  optimizeTerritoryAssignments(): Array<{
    territoryId: string;
    suggestedChanges: string[];
    conflictScore: number;
  }> {
    const results: Array<{
      territoryId: string;
      suggestedChanges: string[];
      conflictScore: number;
    }> = [];

    // Analyze overlaps between territories
    for (const territory of this.territories) {
      const conflicts: string[] = [];
      let conflictScore = 0;

      // Check for ZIP code overlaps
      if (territory.boundaries.zipCodes) {
        for (const otherTerritory of this.territories) {
          if (otherTerritory.id === territory.id) continue;

          const overlap = territory.boundaries.zipCodes.filter((zip) =>
            otherTerritory.boundaries.zipCodes?.includes(zip),
          );

          if (overlap.length > 0) {
            conflicts.push(`ZIP code overlap with ${otherTerritory.name}: ${overlap.join(", ")}`);
            conflictScore += overlap.length * 10;
          }
        }
      }

      // Check for city overlaps
      if (territory.boundaries.cities) {
        for (const otherTerritory of this.territories) {
          if (otherTerritory.id === territory.id) continue;

          const overlap = territory.boundaries.cities.filter((city) =>
            otherTerritory.boundaries.cities?.some(
              (otherCity) => city.toLowerCase() === otherCity.toLowerCase(),
            ),
          );

          if (overlap.length > 0) {
            conflicts.push(`City overlap with ${otherTerritory.name}: ${overlap.join(", ")}`);
            conflictScore += overlap.length * 5;
          }
        }
      }

      results.push({
        territoryId: territory.id,
        suggestedChanges: conflicts,
        conflictScore,
      });
    }

    return results.sort((a, b) => b.conflictScore - a.conflictScore);
  }

  // Bulk validation for multiple addresses
  async validateBulkAddresses(
    addresses: unknown[],
    requestingPartnerId?: string,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const address of addresses) {
      try {
        const result = await this.validateAddress(address, requestingPartnerId);
        results.push(result);
      } catch (error) {
        // Return invalid result for malformed addresses
        results.push({
          isValid: false,
          validationMethod: "state",
          confidence: 0,
          warnings: [
            `Invalid address format: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
        });
      }
    }

    return results;
  }
}

// Export default instance
export const territoryValidator = new TerritoryValidator();
