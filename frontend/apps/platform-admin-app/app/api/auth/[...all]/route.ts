/**
 * Better Auth API Routes for Platform Admin App
 *
 * This catch-all route handles all Better Auth endpoints:
 * - POST /api/auth/sign-in
 * - POST /api/auth/sign-up
 * - POST /api/auth/sign-out
 * - GET /api/auth/session
 * - And all other Better Auth endpoints
 */

import { getAuth } from "@dotmac/better-auth/server";
import { toNextJsHandler } from "better-auth/next-js";

type HandlerGroup = ReturnType<typeof toNextJsHandler>;
let handlers: HandlerGroup | null = null;

const getHandlers = (): HandlerGroup => {
  if (!handlers) {
    handlers = toNextJsHandler(getAuth());
  }

  return handlers;
};

export const GET: HandlerGroup["GET"] = async (...args) => getHandlers().GET(...args);
export const POST: HandlerGroup["POST"] = async (...args) => getHandlers().POST(...args);

// Optional: Configure route segment options
export const runtime = "nodejs"; // Use Node.js runtime for database connections
export const dynamic = "force-dynamic"; // Always run dynamically (no static generation)
