/**
 * JWT Utility Functions
 *
 * Provides utilities for decoding and extracting information from JWT tokens.
 * Used primarily for extracting tenant_id from access tokens.
 */

interface JWTPayload {
  tenant_id?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT token without verification (client-side only).
 * Server-side verification happens in the backend.
 *
 * @param token - The JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1]!;

    // Base64URL decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
}

/**
 * Extract tenant_id from a JWT access token.
 *
 * @param token - The JWT access token
 * @returns tenant_id or null if not found
 */
export function getTenantIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const payload = decodeJWT(token);
  return payload?.tenant_id || null;
}

/**
 * Check if a JWT token is expired.
 *
 * @param token - The JWT token
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);

  if (!payload?.exp) {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
}

/**
 * Get tenant ID from multiple sources in priority order:
 * 1. JWT token (production)
 * 2. localStorage (development only)
 * 3. sessionStorage (development fallback)
 *
 * @param accessToken - The current access token
 * @returns tenant_id or null
 */
export function resolveTenantId(accessToken: string | null): string | null {
  // Priority 1: Extract from JWT token (production)
  if (accessToken) {
    const tenantId = getTenantIdFromToken(accessToken);
    if (tenantId) {
      return tenantId;
    }
  }

  // Priority 2 & 3: Fallback to storage (development only)
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('tenant_id') || sessionStorage.getItem('tenant_id');
    } catch {
      return null;
    }
  }

  return null;
}
