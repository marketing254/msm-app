import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "msm_session";

/** Every page except sign-in needs a session. Later this checks the Supabase session instead. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  // The rank worker authenticates with its own token, checked inside the route.
  if (pathname.startsWith("/api/worker/")) return NextResponse.next();
  if (pathname.startsWith("/sign-in")) {
    if (signedIn) return NextResponse.redirect(new URL("/reports", request.url));
    return NextResponse.next();
  }
  if (!signedIn) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
