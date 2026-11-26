// Server-side tools shared with the store. Never accept a price, role or payment result from a conversation.
import "server-only";
import { z } from "zod";
import { discountAmount } from "../price";
import { getMenu, checkout, tracking } from "../domain";
import type { CartLine, CheckoutInput } from "../contracts";
import { db } from "../db";
import { HttpError } from "../http";
import {
  checkPaymentSetup,
  createPaymentPreference,
} from "../integrations/mercadopago";
export { getMenu, tracking as getOrderStatus };
export async function getKitchenStatus() {
  const { settings } = await getMenu();
  return {
    open: settings.open,
    pickup: settings.pickup,
    delivery: settings.delivery,
    hours: settings.hours,
  };
}
export async function getProductAvailability(id: string) {
  const { products } = await getMenu();
  return products.find((p) => p.id === id)?.available ?? false;
}
export async function validateDeliveryZone(postcode: string) {
  const { zones, settings } = await getMenu();
  return settings.delivery
    ? zones.filter((z) => z.enabled && z.postcodes.includes(postcode))
    : [];
}
export async function calculateCart(
  items: CartLine[],
  zoneId?: string,
  promoCode?: string,
) {
  const { products, zones, promotions, settings } = await getMenu();
  let subtotal = 0;
  for (const line of items) {
    const p = products.find((v) => v.id === line.productId);
    if (
      !p?.available ||
      (line.cheese ? !p.veganAvailable : p.standardAvailable === false) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 50 ||
      line.removed.some((x) => !p.removable.includes(x))
    )
      throw new HttpError(409, "Revisa el carrito y la disponibilidad.");
    subtotal +=
      (p.price + (line.cheese ? (settings.veganSurcharge ?? 0) : 0)) *
      line.quantity;
  }
  const zone = zoneId ? zones.find((z) => z.id === zoneId && z.enabled) : null;
  if (zoneId && !zone)
    throw new HttpError(409, "Zona de entrega no disponible.");
  const promo = promoCode
    ? promotions.find(
        (p) => p.code === promoCode.trim().toUpperCase() && p.enabled,
      )
    : null;
  if (promoCode && !promo)
    throw new HttpError(409, "La promoción ya no está disponible.");
  const discount = discountAmount(subtotal, promo?.percent ?? 0),
    fee = zone?.fee ?? 0;
  return { subtotal, fee, discount, total: subtotal + fee - discount };
}
export async function createOrder(
  input: CheckoutInput,
  idempotencyKey: string,
  channel: "store" | "whatsapp" = "whatsapp",
) {
  checkPaymentSetup();
  return checkout(input, idempotencyKey, channel);
}
// The preference service resolves the immutable order total from its internal ID.
export { createPaymentPreference };
export async function requestHumanSupport(contact: string, reason: string) {
  const v = z
    .object({
      contact: z.string().trim().min(4).max(254),
      reason: z.string().trim().min(1).max(500),
    })
    .parse({ contact, reason });
  const [r] = await (
    await db()
  ).query<{ id: string }>(
    "insert into support_requests(contact,reason) values($1,$2) returning id",
    [v.contact, v.reason],
  );
  return r;
}
