/**
 * Better Auth - Server-Only Entry Point
 *
 * This module exports server-side auth configuration including database connection.
 * ONLY use this in:
 * - API routes (app/api/...)
 * - Server Actions
 * - Server Components (when you need the auth instance)
 *
 * DO NOT import this in client components or pages.
 */

// Import type extensions
import "./types";

// Re-export server configuration (includes database connection)
export { getAuth, ISP_ROLES } from "./auth";
export type { Auth, Session, User } from "./auth";
export type { ExtendedUser } from "./types";
