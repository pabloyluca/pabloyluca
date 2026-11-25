import { z } from "zod";
import { mutate } from "@/lib/domain";
import { api, body, json, allStaff, staff, sameOrigin } from "@/lib/http";
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
  const data = await mutate(action, payload, user.role, user.id);
  afterWrite(true);
  return json(data ?? { ok: true });
});
