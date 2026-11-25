import { adminData } from "@/lib/domain";
import { api, json, managers, staff } from "@/lib/http";
export const GET = api(async () => {
  await staff(managers);
  return json(await adminData());
});
