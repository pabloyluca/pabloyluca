import "server-only";
import type { PaymentUpdate } from "../contracts";
import { isSandbox } from "../mode";
import { db } from "../db";
import { HttpError } from "../errors";
import { readVerifiedPayment } from "./mp-protocol";
import { getOrderForPayment } from "../domain";
const endpoint = "https://api.mercadopago.com";
function configuration(payment = false) {
  const prod = process.env.MP_ENVIRONMENT === "production";
  if (!prod && process.env.MP_ENVIRONMENT !== "test")
    throw new HttpError(503, "El pago aún no está configurado.");
  const prefix = prod ? "MP_PROD_" : "MP_TEST_";
  const token = process.env[prefix + "ACCESS_TOKEN"],
    secret = process.env[prefix + "WEBHOOK_SECRET"],
    collector = process.env[prefix + "COLLECTOR_ID"];
  if (
    !token ||
    !secret ||
    !collector ||
    !process.env.APP_URL?.startsWith("https://") ||
    (payment && prod && process.env.ENABLE_REAL_PAYMENTS !== "true")
  )
    throw new HttpError(503, "Los cobros están pendientes de habilitación.");
  return {
    prod,
    token,
    secret,
    collector,
    origin: new URL(process.env.APP_URL).origin,
  };
}
export function checkPaymentSetup() {
  if (!isSandbox()) configuration(true);
}
export async function createPaymentPreference(orderId: string) {
  const order = await getOrderForPayment(orderId);
  if (!order) throw new HttpError(404, "Pedido desconocido.");
  if (order.status !== "pending") return "/seguimiento/" + order.token;
  if (Date.parse(order.expiresAt) <= Date.now())
    throw new HttpError(409, "La reserva venció. Vuelve al carrito.");
  if (isSandbox()) return "/sandbox/pago/" + order.token;
  const cfg = configuration(true),
    track = cfg.origin + "/seguimiento/" + order.token;
  return (await db()).tx(async (tx) => {
    await tx.query("select id from orders where id=$1 for update", [order.id]);
    const [saved] = await tx.query<{ checkout_url: string }>(
      "select checkout_url from payment_preferences where order_id=$1",
      [order.id],
    );
    if (saved) return saved.checkout_url;
    const response = await fetch(endpoint + "/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cfg.token,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        external_reference: order.id,
        items: [
          {
            id: order.id,
            title: "Pablo & Luca · Pedido #" + order.number,
            quantity: 1,
            unit_price: order.total / 100,
            currency_id: "MXN",
          },
        ],
        back_urls: { success: track, pending: track, failure: track },
        auto_return: "approved",
        notification_url: cfg.origin + "/api/webhooks/mercadopago",
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: order.expiresAt,
      }),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        "Mercado Pago no pudo abrir el checkout. Reintenta con el mismo carrito.",
      );
    const p = await response.json(),
      url = cfg.prod ? p.init_point : p.sandbox_init_point;
    if (
      typeof p.id !== "string" ||
      typeof url !== "string" ||
      !/^https:\/\/(?:[a-z0-9-]+\.)*mercadopago\.com(?:\.mx)?\//i.test(url)
    )
      throw new HttpError(502, "Enlace de pago inválido.");
    await tx.query(
      "insert into payment_preferences(order_id,provider_id,checkout_url) values($1,$2,$3)",
      [order.id, p.id, url],
    );
    return url;
  });
}
export async function verifiedPayment(
  req: Request,
): Promise<PaymentUpdate | null> {
  if (isSandbox()) throw new HttpError(404, "Ruta desconocida.");
  return readVerifiedPayment(req, configuration());
}
