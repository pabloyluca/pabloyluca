import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { usesLocalData } from "./mode";
import { HttpError } from "./http";
const types: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};
function storage() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ).storage;
}
const folder = () =>
  path.resolve(process.env.PABLO_UPLOAD_DIR || ".sandbox/uploads");
export async function saveUpload(file: File, kind: string) {
  if (
    !["product", "receipt"].includes(kind) ||
    !file.size ||
    file.size > 4194304
  )
    throw new HttpError(400, "Adjunta un archivo de hasta 4 MB.");
  const b = Buffer.from(await file.arrayBuffer());
  const ext = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : b[0] === 255 && b[1] === 216 && b[2] === 255
      ? "jpg"
      : b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : b.toString("ascii", 0, 5) === "%PDF-"
          ? "pdf"
          : null;
  if (!ext || (ext === "pdf" && kind !== "receipt"))
    throw new HttpError(415, "Utiliza JPG, PNG, WebP o PDF para comprobantes.");
  const key = kind + "-" + randomUUID() + "." + ext;
  if (usesLocalData()) {
    await mkdir(folder(), { recursive: true });
    await writeFile(path.join(folder(), key), b, { flag: "wx", mode: 0o600 });
    return "/api/files/" + key;
  }
  const bucket = storage().from(
    kind === "product" ? "pl-products" : "pl-receipts",
  );
  const { error } = await bucket.upload(key, b, {
    contentType: types[ext],
    upsert: false,
  });
  if (error) throw new HttpError(503, "No fue posible guardar el archivo.");
  return kind === "product"
    ? bucket.getPublicUrl(key).data.publicUrl
    : "/api/files/" + key;
}
export async function loadFile(key: string) {
  if (!/^(product|receipt)-[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/.test(key))
    throw new HttpError(404, "Archivo desconocido.");
  const mime = types[key.split(".").pop()!];
  let data: Uint8Array;
  if (usesLocalData()) {
    try {
      data = await readFile(path.join(folder(), key));
    } catch {
      throw new HttpError(404, "Archivo desconocido.");
    }
  } else {
    const bucket = storage().from(
      key.startsWith("product-") ? "pl-products" : "pl-receipts",
    );
    const result = await bucket.download(key);
    if (result.error) throw new HttpError(404, "Archivo desconocido.");
    data = new Uint8Array(await result.data.arrayBuffer());
  }
  return new Response(new Uint8Array(data).buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": key.startsWith("receipt-")
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
      "Content-Disposition":
        mime === "application/pdf" ? "attachment" : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
