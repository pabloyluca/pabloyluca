import { api, staff, managers } from "@/lib/http";
import { loadFile } from "@/lib/files";
export const GET = api(async (req) => {
  const key = new URL(req.url).pathname.split("/").pop() || "";
  if (key.startsWith("receipt-")) await staff(managers);
  return loadFile(key);
});
