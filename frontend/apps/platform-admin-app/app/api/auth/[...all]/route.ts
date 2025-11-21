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

import { NextResponse } from "next/server";
import { getAuth } from "@dotmac/better-auth/server";
import { toNextJsHandler } from "better-auth/next-js";

type HandlerGroup = ReturnType<typeof toNextJsHandler>;
let handlers: HandlerGroup | null = null;
let authWarningLogged = false;

const getHandlers = (): HandlerGroup => {
  if (!handlers) {
    handlers = toNextJsHandler(getAuth());
  }

  return handlers;
};

const handleAuthFailure = (error: unknown) => {
  if (!authWarningLogged) {
    authWarningLogged = true;
    console.error(
      "[better-auth] Failed to initialize auth handler. Did you set DATABASE_URL and BETTER_AUTH_SECRET?",
      error,
    );
  }

  return NextResponse.json(
    {
      error: "Better Auth is not configured. Set DATABASE_URL/BETTER_AUTH_SECRET or disable auth for local development.",
    },
    { status: 503 },
  );
};

export const GET: HandlerGroup["GET"] = async (...args) => {
  try {
    const handler = getHandlers().GET;
    if (!handler) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }
    return handler(...args);
  } catch (error) {
    return handleAuthFailure(error);
  }
};

export const POST: HandlerGroup["POST"] = async (...args) => {
  try {
    const handler = getHandlers().POST;
    if (!handler) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }
    return handler(...args);
  } catch (error) {
    return handleAuthFailure(error);
  }
};

// Optional: Configure route segment options
export const runtime = "nodejs"; // Use Node.js runtime for database connections
export const dynamic = "force-dynamic"; // Always run dynamically (no static generation)
