import { z } from "zod";
import { api, budget, sameOrigin } from "@/lib/http";
import { signIn } from "@/lib/auth";
export const POST = api(async (req) => {
  sameOrigin(req);
  await budget(req, "login", 16, 900);
  const data = await req.formData();
  const input = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(512) })
    .parse(Object.fromEntries(data));
  const session = await signIn(input.email, input.password);
  const target = session
    ? session.role === "KITCHEN" || data.get("next") === "kitchen"
      ? "/kitchen"
      : "/admin"
    : "/login?error=1";
  return Response.redirect(new URL(target, req.url), 303);
});
