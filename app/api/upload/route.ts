import { api, staff, managers, sameOrigin, json, HttpError } from "@/lib/http";
import { saveUpload } from "@/lib/files";
export const POST = api(async (req) => {
  sameOrigin(req);
  await staff(managers);
  if (Number(req.headers.get("content-length")) > 4300000)
    throw new HttpError(413, "El archivo excede 4 MB.");
  const form = await req.formData(),
    file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Adjunta un archivo.");
  return json({ url: await saveUpload(file, String(form.get("kind"))) }, 201);
});
