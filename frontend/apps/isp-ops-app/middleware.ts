/**
 * ISP Operations App - Route Protection Middleware
 *
 * Blocks access to platform admin routes that should not be accessible
 * in the ISP operations app.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSS_BUNDLE_PATH = "/_next/static/css/";

/**
 * Platform admin routes that should NOT be accessible in ISP Ops App
 */
const PLATFORM_ONLY_ROUTES = [
  "/dashboard/platform-admin",
  "/dashboard/licensing", // Platform licensing management
  "/tenant-portal", // Tenant self-service (platform admin manages tenants)
];

/**
 * ISP Operations routes that SHOULD be accessible
 */
const ISP_OPS_ROUTES = [
  "/dashboard/network",
  "/dashboard/radius",
  "/dashboard/pon",
  "/dashboard/devices",
  "/dashboard/automation",
  "/dashboard/fiber",
  "/dashboard/wireless",
  "/dashboard/subscribers",
  "/dashboard/services/internet-plans",
  "/dashboard/infrastructure",
  "/customer-portal", // End-customer self-service
  "/dashboard/partners/managed-tenants", // Partner multi-tenancy
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Guard against Next dev serving CSS bundles through <script> tags.
  // When the browser fetches vendor.css as a script, we return an empty JS
  // response to avoid the "Unexpected token '.'" runtime crash on /login.
  if (pathname.startsWith(CSS_BUNDLE_PATH)) {
    const destination = request.headers.get("sec-fetch-dest");

    if (destination === "script") {
      return new NextResponse("", {
        status: 200,
        headers: {
          "content-type": "application/javascript",
          "cache-control": "public, max-age=60",
        },
      });
    }

    return NextResponse.next();
  }

  // Check if trying to access platform-only routes
  const isAccessingPlatformRoute = PLATFORM_ONLY_ROUTES.some((route) => pathname.startsWith(route));

  if (isAccessingPlatformRoute) {
    // Block access with forbidden response
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `This route is only accessible in the Platform Admin App. ISP users cannot access platform-level administration features.`,
        route: pathname,
        allowedApp: "platform-admin-app",
        currentApp: "isp-ops-app",
        suggestion:
          "Contact your platform administrator if you need access to platform-level features.",
      },
      { status: 403 },
    );
  }

  // Allow all other routes
  return NextResponse.next();
}

/**
 * Configure which routes this middleware should run on
 */
export const config = {
  matcher: [
    // Also run on CSS bundle requests so we can drop accidental script fetches
    "/_next/static/css/:path*",
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - API routes (handled by backend)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg).*)",
  ],
};
