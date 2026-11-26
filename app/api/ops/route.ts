import { z } from "zod";
import { mutate } from "@/lib/domain";
import { api, body, json, allStaff, staff, sameOrigin } from "@/lib/http";
import { isCatalogCMS } from "@/lib/mode";
import { afterWrite } from "@/lib/after-write";
export const POST = api(async (req) => {
  sameOrigin(req);
  const user = await staff(allStaff);
  const { action, payload } = z
    .object({
      action: z.string().max(80),
      payload: z.record(z.string(), z.unknown()),
    })
    .parse(await body(req));
  if (isCatalogCMS() && action === "settings.save" && payload.open === true) {
    return json({ error: "La recepción de pedidos todavía está desactivada." }, 409);
  }
  const data = await mutate(action, payload, user.role, user.id);
  afterWrite(!isCatalogCMS());
  return json(data ?? { ok: true });
});
