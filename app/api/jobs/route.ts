import { createHash, timingSafeEqual } from "node:crypto";
import { api, json, HttpError } from "@/lib/http";
import { expireReservations, queueDailySummary } from "@/lib/domain";
import { deliverNotifications } from "@/lib/integrations/notifications";
import { signal } from "@/lib/local-events";
export const GET = api(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "Trabajador sin configurar.");
  const hash = (x: string) => createHash("sha256").update(x).digest();
  if (
    !timingSafeEqual(
      hash(req.headers.get("authorization") || ""),
      hash("Bearer " + secret),
    )
  )
    throw new HttpError(401, "Acceso denegado.");
  const expired = await expireReservations();
  await queueDailySummary();
  if (expired) signal("public", "staff");
  return json({ expired, ...(await deliverNotifications()) });
});
