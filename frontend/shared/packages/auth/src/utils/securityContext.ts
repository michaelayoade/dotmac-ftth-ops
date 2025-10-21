/**
 * Security Context Utilities
 * Captures IP address, user agent, and device information for security tracking
 */

import type { SecurityContext } from "../types";

export class SecurityContextManager {
  private static cachedContext: SecurityContext | null = null;
  private static lastUpdate = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive security context from browser environment
   */
  static async getSecurityContext(): Promise<SecurityContext> {
    // Return cached context if still valid
    if (this.cachedContext && Date.now() - this.lastUpdate < this.CACHE_DURATION) {
      return { ...this.cachedContext, timestamp: Date.now() };
    }

    const context: SecurityContext = {
      timestamp: Date.now(),
      userAgent: this.getUserAgent(),
      sessionId: this.getOrCreateSessionId(),
      device: this.getDeviceInfo(),
      ipAddress: await this.getClientIP(),
      location: await this.getLocationInfo(),
    };

    // Cache the context (excluding timestamp which should always be current)
    this.cachedContext = context;
    this.lastUpdate = Date.now();

    return context;
  }

  /**
   * Get user agent string
   */
  private static getUserAgent(): string {
    return typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  }

  /**
   * Get or create session ID for tracking
   */
  private static getOrCreateSessionId(): string {
    if (typeof window === "undefined") return "server-side";

    let sessionId = sessionStorage.getItem("auth-session-id");

    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("auth-session-id", sessionId);
    }

    return sessionId;
  }

  /**
   * Extract device information from user agent
   */
  private static getDeviceInfo(): SecurityContext["device"] {
    if (typeof navigator === "undefined") {
      return { type: "server", os: "unknown", browser: "unknown" };
    }

    const userAgent = navigator.userAgent;

    // Detect device type
    let deviceType = "desktop";
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? "tablet" : "mobile";
    }

    // Detect OS
    let os = "unknown";
    if (/Windows/.test(userAgent)) os = "Windows";
    else if (/Mac OS/.test(userAgent)) os = "macOS";
    else if (/Linux/.test(userAgent)) os = "Linux";
    else if (/Android/.test(userAgent)) os = "Android";
    else if (/iOS/.test(userAgent)) os = "iOS";

    // Detect browser
    let browser = "unknown";
    if (/Chrome/.test(userAgent) && !/Edg/.test(userAgent)) browser = "Chrome";
    else if (/Firefox/.test(userAgent)) browser = "Firefox";
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = "Safari";
    else if (/Edg/.test(userAgent)) browser = "Edge";

    return { type: deviceType, os, browser };
  }

  /**
   * Get client IP address (requires backend support)
   */
  private static async getClientIP(): Promise<string> {
    if (typeof window === "undefined") return "unknown";

    try {
      // Try to get IP from a privacy-friendly service
      const response = await fetch("/api/security/client-info", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        return data.ipAddress || "unknown";
      }
    } catch (error) {
      console.warn("Could not determine client IP:", error);
    }

    return "unknown";
  }

  /**
   * Get approximate location information (respects privacy)
   */
  private static async getLocationInfo(): Promise<SecurityContext["location"]> {
    if (typeof window === "undefined") return undefined;

    try {
      // Use browser's timezone to get general location (privacy-friendly)
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Extract general region from timezone (e.g., "America/New_York" -> "Americas")
      const region = timeZone.split("/")[0];

      return {
        region: this.mapTimezoneToRegion(region),
      };
    } catch (error) {
      console.warn("Could not determine location info:", error);
      return undefined;
    }
  }

  /**
   * Map timezone regions to readable names
   */
  private static mapTimezoneToRegion(region: string): string {
    const regionMap: Record<string, string> = {
      America: "Americas",
      Europe: "Europe",
      Asia: "Asia",
      Africa: "Africa",
      Australia: "Oceania",
      Pacific: "Pacific",
    };

    return regionMap[region] || region;
  }

  /**
   * Update security context with new information
   */
  static updateContext(updates: Partial<SecurityContext>): SecurityContext {
    if (this.cachedContext) {
      this.cachedContext = {
        ...this.cachedContext,
        ...updates,
        timestamp: Date.now(),
      };
      return this.cachedContext;
    }

    return {
      timestamp: Date.now(),
      userAgent: "unknown",
      sessionId: "unknown",
      ...updates,
    };
  }

  /**
   * Clear cached context (useful for logout)
   */
  static clearContext(): void {
    this.cachedContext = null;
    this.lastUpdate = 0;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("auth-session-id");
    }
  }

  /**
   * Validate security context for suspicious patterns
   */
  static validateContext(context: SecurityContext): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for missing critical fields
    if (!context.userAgent || context.userAgent === "unknown") {
      warnings.push("Missing or invalid user agent");
    }

    if (!context.sessionId) {
      warnings.push("Missing session ID");
    }

    // Check for suspicious user agents
    if (context.userAgent && /bot|crawler|spider|scraper/i.test(context.userAgent)) {
      warnings.push("Suspicious user agent detected");
    }

    // Check timestamp validity (not too old, not in future)
    const now = Date.now();
    const timeDiff = Math.abs(now - context.timestamp);

    if (timeDiff > 10 * 60 * 1000) {
      // More than 10 minutes
      warnings.push("Context timestamp is stale or invalid");
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}
