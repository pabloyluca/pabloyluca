import { createHmac, timingSafeEqual } from "node:crypto";
export function validSignature(input: {
  header: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}) {
  const { header, requestId, dataId, secret } = input;
  if (!header || !requestId || !dataId || !secret) return false;
  const fields = Object.fromEntries(
    header.split(",").map((pair) => pair.trim().split("=")),
  );
  if (
    !/^\d{10,13}$/.test(fields.ts || "") ||
    !/^[0-9a-f]{64}$/i.test(fields.v1 || "")
  )
    return false;
  const manifest =
    "id:" +
    dataId.toLowerCase() +
    ";request-id:" +
    requestId +
    ";ts:" +
    fields.ts +
    ";";
  const expected = createHmac("sha256", secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(fields.v1, "hex"));
}
