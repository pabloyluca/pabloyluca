import { tracking } from "@/lib/domain";
import { api, json, HttpError } from "@/lib/http";
export const GET = api(async (req) => {
  const token = new URL(req.url).pathname.split("/").pop() || "";
  if (!/^[\w-]{20,128}$/.test(token))
    throw new HttpError(404, "Pedido desconocido.");
  const result = await tracking(token);
  if (!result) throw new HttpError(404, "Pedido desconocido.");
  return json(result);
});
