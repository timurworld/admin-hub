import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Routes that don't require authentication.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export const config = {
  // Run on every request except Next internals and static assets.
  matcher: ["/((?!_next/|favicon|.*\\..*).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(token)) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to /login, preserving intent
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  if (pathname !== "/" && pathname !== "/login") {
    loginUrl.searchParams.set("from", pathname);
  } else {
    loginUrl.searchParams.delete("from");
  }
  return NextResponse.redirect(loginUrl);
}
