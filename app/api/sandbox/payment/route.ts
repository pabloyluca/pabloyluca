import { api, HttpError, sameOrigin } from "@/lib/http";
import { isSandbox } from "@/lib/mode";
import { applyPayment, getPendingByToken } from "@/lib/domain";
import { afterWrite } from "@/lib/after-write";
export const POST = api(async (req) => {
  if (!isSandbox()) throw new HttpError(404, "Ruta desconocida.");
  sameOrigin(req);
  const values = await req.formData(),
    token = String(values.get("token")),
    status = values.get("result");
  if (status !== "approved" && status !== "rejected")
    throw new HttpError(400, "Simulación inválida.");
  const order = await getPendingByToken(token);
  if (!order) throw new HttpError(404, "Pedido desconocido.");
  await applyPayment({
    eventId: "sandbox/" + order.id + "/" + status,
    paymentId: "sandbox-" + order.id,
    orderId: order.id,
    status,
    amount: order.total,
    fee: 0,
    currency: "MXN",
    updatedAt: new Date().toISOString(),
  });
  afterWrite(true);
  return Response.redirect(new URL("/seguimiento/" + token, req.url), 303);
});
