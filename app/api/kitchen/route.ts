import { kitchenData } from "@/lib/domain";
import { allStaff, api, json, staff } from "@/lib/http";
export const GET = api(async () => {
  await staff(allStaff);
  return json(await kitchenData());
});
