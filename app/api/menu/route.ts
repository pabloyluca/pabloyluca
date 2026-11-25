import { isVisualPreview } from "@/lib/mode";
import { preview } from "@/lib/preview";
import { getMenu } from "@/lib/domain";
import { api, json } from "@/lib/http";
export const GET = api(async () => json(isVisualPreview() ? preview.menu : await getMenu()));
