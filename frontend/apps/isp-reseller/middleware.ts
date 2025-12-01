import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
const PROTECTED_PATHS = ["/portal"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path requires authentication
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // For protected paths, check for token in cookies or redirect to login
  if (isProtectedPath) {
    // Check for reseller token in cookies
    const token = request.cookies.get("reseller_access_token");

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If authenticated and trying to access login, redirect to portal
  if (isPublicPath && pathname === "/login") {
    const token = request.cookies.get("reseller_access_token");
    if (token) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
