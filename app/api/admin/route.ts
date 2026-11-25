import { isVisualPreview } from "@/lib/mode";
import { preview } from "@/lib/preview";
import { adminData } from "@/lib/domain";
import { api, json, managers, staff } from "@/lib/http";
export const GET = api(async () => {
  await staff(managers);
  return json(isVisualPreview() ? preview.admin : await adminData());
});
