import { getMenu } from "@/lib/domain";
import { api, json } from "@/lib/http";
export const GET = api(async () => json(await getMenu()));
