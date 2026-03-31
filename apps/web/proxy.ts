import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Get session from cookie - check both secure and non-secure cookie names
  // Better Auth uses __Secure- prefix in production (HTTPS)
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token");
  const hasSession = !!sessionCookie?.value;

  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect unauthenticated users to login
  if (pathname.startsWith("/dashboard") && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (hasSession && (pathname === "/login" || pathname === "/verify-otp")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/verify-otp",
    // Exclude workflow endpoints
    "/((?!.well-known/workflow|api/workflow).*)",
  ],
};
