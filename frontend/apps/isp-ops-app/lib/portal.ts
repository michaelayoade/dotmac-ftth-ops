/**
 * Portal Utilities
 *
 * Utilities for portal type detection and access control
 */

import { detectPortalFromRoute, type PortalDesignType as PortalType } from "@dotmac/ui";

/**
 * Get the current portal type based on the current route
 * Works in both client and server environments
 */
export function getPortalType(): PortalType {
  // ISP Operations App - always return ispAdmin
  // This app is for individual ISP/tenant operations and management
  return "ispAdmin";
}

/**
 * Check if the current portal is allowed to access a feature
 *
 * @param allowedPortals - List of portals that can access the feature (undefined means all portals allowed)
 * @param currentPortal - Current portal type (defaults to auto-detected portal)
 * @returns true if the portal is allowed, false otherwise
 */
export function portalAllows(
  allowedPortals: PortalType[] | undefined,
  currentPortal?: PortalType,
): boolean {
  // If no restrictions specified, allow all portals
  if (!allowedPortals || allowedPortals.length === 0) {
    return true;
  }

  // Get current portal if not provided
  const portal = currentPortal ?? getPortalType();

  // Check if current portal is in the allowed list
  return allowedPortals.includes(portal);
}

/**
 * Re-export PortalType for convenience
 */
export type { PortalType };
