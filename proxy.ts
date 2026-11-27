import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Sends signed-out visitors to Sign in before a signed-in page loads.
 * It only checks that the cookie exists; the (app) layout and each API route
 * still read the full session and check the role.
 * (Next 16 renamed middleware.ts to proxy.ts.)
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/patients/:path*", "/intake/:path*", "/tasks/:path*", "/admin/:path*"],
};
