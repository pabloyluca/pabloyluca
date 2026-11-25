import { api, sameOrigin } from "@/lib/http";
import { logout } from "@/lib/auth";
export const POST = api(async (req) => {
  sameOrigin(req);
  await logout();
  return new Response(null, {
    status: 303,
    headers: { Location: "/login", "Cache-Control": "no-store" },
  });
});
