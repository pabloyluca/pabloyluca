import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let res = NextResponse.next({ request });
  if (
    !["live","online-sandbox"].includes(process.env.COMMERCE_MODE || "") ||
    !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))
  )
    return res;
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          for (const c of items) request.cookies.set(c.name, c.value);
          res = NextResponse.next({ request });
          for (const c of items) res.cookies.set(c.name, c.value, c.options);
        },
      },
    },
  );
  await sb.auth.getClaims();
  return res;
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/kitchen/:path*",
    "/api/admin",
    "/api/kitchen",
    "/api/ops",
    "/api/live",
    "/api/reports",
    "/api/upload",
    "/api/files/:path*",
  ],
};
