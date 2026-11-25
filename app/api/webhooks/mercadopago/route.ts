import { api, json } from "@/lib/http";
import { applyPayment } from "@/lib/domain";
import { verifiedPayment } from "@/lib/integrations/mercadopago";
import { afterWrite } from "@/lib/after-write";
export const POST = api(async (req) => {
  const event = await verifiedPayment(req);
  if (event) {
    await applyPayment(event);
    afterWrite(true);
  }
  return json({ received: true });
});
