import { z } from "zod";
import { createOrder, createPaymentPreference } from "@/lib/lu/tools";
import { api, json, body, budget, sameOrigin } from "@/lib/http";
import { afterWrite } from "@/lib/after-write";
export const POST = api(async (req) => {
  sameOrigin(req);
  await budget(req, "checkout", 40, 600);
  const key = z.string().uuid().parse(req.headers.get("idempotency-key"));
  const input = await body(req);
  const order = await createOrder(input, key, "store");
  afterWrite();
  return json(
    { ...order, paymentUrl: await createPaymentPreference(order.id) },
    201,
  );
});
