/**
 * Better Auth API Routes for ISP Ops App
 *
 * This catch-all route handles all Better Auth endpoints:
 * - POST /api/auth/sign-in
 * - POST /api/auth/sign-up
 * - POST /api/auth/sign-out
 * - GET /api/auth/session
 * - And all other Better Auth endpoints
 */

import { auth } from "@dotmac/better-auth/server";
import { toNextJsHandler } from "better-auth/next-js";

// Export both GET and POST handlers
export const { POST, GET } = toNextJsHandler(auth);

// Optional: Configure route segment options
export const runtime = "nodejs"; // Use Node.js runtime for database connections
export const dynamic = "force-dynamic"; // Always run dynamically (no static generation)
