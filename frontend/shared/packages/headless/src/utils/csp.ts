/**
 * Content Security Policy utilities for nonce generation and management
 */

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API which is available in both Node.js and Edge Runtime
 */
export function generateNonce(): string {
  // Use crypto.getRandomValues which works in both Node.js and edge runtime
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // Fallback for environments without Web Crypto API
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result + "==";
}

/**
 * Generate CSP header with nonce support
 */
export function generateCSP(nonce: string, isDevelopment = false): string {
  const policies = [
    `default-src 'self'`,
    // Use nonce for scripts instead of unsafe-inline
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Tightened CSP: Remove unsafe-inline in production, use nonce for inline styles
    `style-src 'self'${isDevelopment ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`} fonts.googleapis.com`,
    `font-src 'self' fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' ws: wss: https:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ];

  return policies.join("; ");
}

/**
 * Generate CSP meta tag for client-side enforcement
 */
export function generateCSPMeta(nonce: string): string {
  const csp = generateCSP(nonce, process.env["NODE_ENV"] === "development");
  return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}

/**
 * Extract nonce from CSP header
 */
export function extractNonce(cspHeader: string): string | null {
  const match = cspHeader.match(/'nonce-([^']+)'/);
  return match ? match[1] : null;
}

/**
 * Validate nonce format
 */
export function isValidNonce(nonce: string): boolean {
  // Base64 encoded 16 bytes = 24 chars (with padding)
  return /^[A-Za-z0-9+/]{22}==$/.test(nonce);
}
