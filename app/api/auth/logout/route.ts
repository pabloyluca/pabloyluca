import { api, sameOrigin } from "@/lib/http";
import { logout } from "@/lib/auth";
export const POST = api(async (req) => {
  sameOrigin(req);
  await logout();
  return Response.redirect(new URL("/login", req.url), 303);
});
