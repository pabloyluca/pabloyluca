import { storefrontMenu } from "@/lib/storefront-menu";
import { api, json } from "@/lib/http";

export const GET = api(async () => json(await storefrontMenu()));
