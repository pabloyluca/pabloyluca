import { isVisualPreview } from "@/lib/mode";
import { preview } from "@/lib/preview";
import { kitchenData } from "@/lib/domain";
import { allStaff, api, json, staff } from "@/lib/http";
export const GET = api(async () => {
  await staff(allStaff);
  return json(isVisualPreview() ? preview.kitchen : await kitchenData());
});
