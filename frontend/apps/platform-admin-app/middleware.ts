/**
 * Platform Admin App - Route Protection Middleware
 *
 * Blocks access to ISP-specific routes that should not be accessible
 * in the platform admin app.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ISP-specific routes that should NOT be accessible in Platform Admin App
 */
const ISP_ONLY_ROUTES = [
  "/dashboard/network",
  "/dashboard/radius",
  "/dashboard/pon",
  "/dashboard/devices",
  "/dashboard/automation",
  "/dashboard/fiber",
  "/dashboard/wireless",
  "/dashboard/subscribers",
  "/dashboard/services/internet-plans",
  "/dashboard/infrastructure/ipam",
  "/dashboard/infrastructure/dcim",
  "/dashboard/infrastructure/devices",
  "/customer-portal", // Customer portal is ISP app only
];

/**
 * Platform Admin routes that SHOULD be accessible
 */
const PLATFORM_ADMIN_ROUTES = [
  "/dashboard/platform-admin",
  "/dashboard/licensing",
  "/tenant-portal",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if trying to access ISP-only routes
  const isAccessingIspRoute = ISP_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isAccessingIspRoute) {
    // Block access with forbidden response
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `This route is only accessible in the ISP Operations App. Platform Admin users cannot access ISP-specific features.`,
        route: pathname,
        allowedApp: "isp-ops-app",
        currentApp: "platform-admin-app",
      },
      { status: 403 }
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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg).*)",
  ],
};
