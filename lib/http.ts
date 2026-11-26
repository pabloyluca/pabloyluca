import "server-only";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { isPublicCatalog } from "./mode";
import { getStaff } from "./auth";
import type { Role } from "./contracts";
import { checkRateLimit } from "./domain";

import { HttpError } from "./errors";
export { HttpError };
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export function api(fn: (req: Request) => Promise<Response>) {
  return async function (request: Request) {
    try {
      if (isPublicCatalog()) {
        const { pathname, searchParams } = new URL(request.url);
        if (request.method === "GET" && pathname === "/api/live" && (searchParams.get("topic") ?? "public") === "public") {
          return json({ mode: "static" });
        }
        if (request.method !== "GET" || pathname !== "/api/menu") {
          if (pathname === "/api/admin" || pathname === "/api/kitchen") {
            return json({ error: "Acceso restringido." }, 401);
          }
          return json({ error: "La tienda recibe pedidos cuando abre la cocina." }, 503);
        }
      }
      if (process.env.COMMERCE_MODE === "visual-preview") {
        const readonly = ["GET /api/menu", "GET /api/admin", "GET /api/kitchen", "GET /api/live", "POST /api/auth/login", "POST /api/auth/logout"];
        if (!readonly.includes(request.method + " " + new URL(request.url).pathname)) {
          return json({error:"SANDBOX visual de solo lectura. Las operaciones requieren la base de pruebas compartida."}, 503);
        }
      }
      return await fn(request);
    } catch (e) {
      if (e instanceof ZodError)
        return json({ error: "Revisa los datos del formulario." }, 400);
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (
        e instanceof Error &&
        "status" in e &&
        typeof e.status === "number" &&
        e.status >= 400 &&
        e.status < 500
      )
        return json({ error: e.message }, e.status);
      console.error("[operación]", e instanceof Error ? e.name : "Error");
      return json(
        {
          error:
            "No se pudo completar la operación. Actualiza e intenta de nuevo.",
        },
        500,
      );
    }
  };
}
export async function staff(roles: Role[]) {
  const s = await getStaff();
  if (!s) throw new HttpError(401, "Inicia sesión.");
  if (!roles.includes(s.role))
    throw new HttpError(403, "Tu rol no tiene acceso.");
  return s;
}
export const allStaff: Role[] = ["OWNER", "ADMIN", "KITCHEN"];
export const managers: Role[] = ["OWNER", "ADMIN"];
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    (origin &&
      origin !== new URL(req.url).origin &&
      origin !== process.env.APP_URL) ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "Origen inválido.");
}
export async function budget(
  req: Request,
  scope: string,
  limit: number,
  seconds: number,
) {
  const ip = process.env.VERCEL
    ? (
        req.headers.get("x-vercel-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown"
      ).split(",")[0]
    : "local";
  const digest = createHash("sha256")
    .update(scope + "/" + ip)
    .digest("hex");
  if (!(await checkRateLimit(digest, limit, seconds)))
    throw new HttpError(429, "Demasiados intentos. Intenta más tarde.");
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 65536)
    throw new HttpError(413, "Solicitud demasiado grande.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Faltan los datos.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new HttpError(413, "Solicitud demasiado grande.");
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Formato inválido.");
  }
}
