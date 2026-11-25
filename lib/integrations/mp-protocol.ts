import { HttpError } from "../errors";
import type { PaymentUpdate } from "../contracts";
import { validSignature } from "./signature";
const endpoint = "https://api.mercadopago.com";
function cents(v: unknown) {
  if (
    (typeof v !== "number" && typeof v !== "string") ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(v))
  )
    throw new HttpError(422, "Importe inválido.");
  const [whole, fraction = ""] = String(v).split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result))
    throw new HttpError(422, "Importe inválido.");
  return result;
}
export async function readVerifiedPayment(
  req: Request,
  cfg: { secret: string; collector: string; token: string; prod: boolean },
  request: typeof fetch = fetch,
): Promise<PaymentUpdate | null> {
  const url = new URL(req.url),
    id = url.searchParams.get("data.id");
  if (
    !id ||
    !/^\d{1,30}$/.test(id) ||
    !validSignature({
      header: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
      dataId: id,
      secret: cfg.secret,
    })
  )
    throw new HttpError(401, "Firma inválida.");
  if (
    url.searchParams.get("type") &&
    url.searchParams.get("type") !== "payment"
  )
    return null;
  const response = await request(endpoint + "/v1/payments/" + id, {
    headers: { Authorization: "Bearer " + cfg.token },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new HttpError(503, "No se pudo consultar el pago.");
  const p = await response.json();
  if (
    String(p.id) !== id ||
    String(p.collector_id) !== cfg.collector ||
    p.live_mode !== cfg.prod
  )
    throw new HttpError(422, "Pago ajeno al comercio o entorno.");
  if (!/^[0-9a-f-]{36}$/i.test(p.external_reference || ""))
    throw new HttpError(422, "Referencia no válida.");
  const map: Record<string, PaymentUpdate["status"]> = {
    approved: "approved",
    authorized: "pending",
    in_process: "pending",
    pending: "pending",
    in_mediation: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "charged_back",
  };
  const status = map[p.status];
  if (!status) return null;
  const updatedAt = new Date(p.date_last_updated).toISOString(),
    refunded = ["refunded", "charged_back"].includes(status)
      ? cents(p.transaction_amount)
      : cents(p.transaction_amount_refunded ?? 0);
  return {
    eventId: ["mp", id, updatedAt, status, refunded].join("/"),
    paymentId: id,
    orderId: p.external_reference,
    status,
    amount: cents(p.transaction_amount),
    currency: p.currency_id,
    refunded,
    updatedAt,
    fee: Array.isArray(p.fee_details)
      ? p.fee_details
          .filter((f: { fee_payer: string }) => f.fee_payer === "collector")
          .reduce(
            (sum: number, f: { amount: number }) => sum + cents(f.amount),
            0,
          )
      : undefined,
  };
}
