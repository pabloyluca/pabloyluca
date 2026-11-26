import { z } from "zod";
import { api, body, budget, json, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { activateStaff } from "@/lib/auth";
import { isCatalogCMS } from "@/lib/mode";
export const POST = api(async req => {
  if (!isCatalogCMS()) throw new HttpError(404,"Ruta desconocida.");
  sameOrigin(req);
  await budget(req,"activar",12,900);
  const input = z.object({
    password:z.string().min(12).max(72), invitation:z.string().min(12).max(256).nullable(),
    access:z.string().max(12000).nullable(), refresh:z.string().max(2048).nullable()
  }).parse(await body(req));
  await activateStaff(input);
  return json({ok:true});
});
