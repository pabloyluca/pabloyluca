import { discountAmount } from "@/lib/price";
import type { CartLine, Menu, OrderStatus } from "@/lib/contracts";

export const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const statusNames: Record<OrderStatus, string> = {
  pending: "Pendiente de pago",
  confirmed: "Pedido confirmado",
  preparing: "Preparando",
  baking: "En el horno",
  ready: "Listo",
  dispatched: "En camino",
  delivered: "Entregado",
  picked_up: "Recogido",
  cancelled: "Cancelado",
  review: "En revisión",
};

export const CART_KEY = "pablo-luca.cart.v1";
export function restoreCart(): CartLine[] {
  try {
    const json: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(json)) return [];
    return json.filter((item): item is CartLine =>
      Boolean(
        item &&
        typeof item.productId === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 50 &&
        Array.isArray(item.removed) &&
        item.removed.every((name: unknown) => typeof name === "string") &&
        typeof item.note === "string",
      ),
    );
  } catch {
    return [];
  }
}

export function cartQuote(
  menu: Menu,
  cart: CartLine[],
  promo: string,
  fee: number,
) {
  const subtotal = cart.reduce(
    (sum, line) =>
      sum +
      (menu.products.find((item) => item.id === line.productId)?.price ?? 0) *
        line.quantity,
    0,
  );
  const promotion = menu.promotions.find(
    (p) => p.enabled && p.code.toUpperCase() === promo.trim().toUpperCase(),
  );
  const discount = discountAmount(subtotal, promotion?.percent ?? 0);
  return { subtotal, discount, total: subtotal - discount + fee, promotion };
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const result = await fetch(path, { cache: "no-store", ...init });
  const data = await result.json().catch(() => ({}));
  if (!result.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "No pudimos completar la solicitud. Intenta de nuevo.",
    );
  return data;
}
