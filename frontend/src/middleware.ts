import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ordely_session";

// Cheap presence check so logged-out visitors never see app pages.
// The backend still verifies the token on every request.
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/call-logs/:path*",
    "/orders/:path*",
    "/analytics/:path*",
    "/integrations/:path*",
    "/settings/:path*",
  ],
};
