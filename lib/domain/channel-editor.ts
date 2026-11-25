import { z } from "zod";
import type { DB } from "../db";
import { platformIds } from "../sales-channels";
import { DomainError } from "./common";

const label = z.string().trim().min(1).max(160);
const direct = z
  .object({
    visible: z.boolean(),
    eyebrow: label,
    heading: label,
    percent: z.number().min(0).max(100),
    showPercent: z.boolean(),
    promo: label,
    coverage: label,
    cta: label,
    closed: label,
  })
  .strict();
const card = z
  .object({
    enabled: z.boolean(),
    visible: z.boolean(),
    url: z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(1500)]),
    description: label,
    cta: label,
    includesShipping: z.boolean(),
    legend: z.string().trim().max(160),
    position: z.number().int().min(0).max(2),
  })
  .strict();
const platform = z.enum(["rappi", "uber", "didi"]);
const prices = z.record(z.uuid(), z.number().int().min(1).max(100000000));
export async function saveChannelPresentation(db: DB, raw: unknown) {
  const v = z
    .object({
      direct,
      delivery: z.boolean(),
      platforms: z.array(z.object({ id: platform, card, prices })).length(3),
    })
    .parse(raw);
  if (
    new Set(v.platforms.map((p) => p.id)).size !== platformIds.length ||
    new Set(v.platforms.map((p) => p.card.position)).size !== platformIds.length
  )
    throw new DomainError("Revisa los canales y su orden.");
  const productIds = new Set(
    (await db.query<{ id: string }>("select id from products")).map(
      (p) => p.id,
    ),
  );
  for (const p of v.platforms) {
    if (Object.keys(p.prices).some((id) => !productIds.has(id)))
      throw new DomainError("Pizza desconocida.");
    if (p.card.url) {
      const url = new URL(p.card.url);
      if (url.username || url.password)
        throw new DomainError(
          "Usa un enlace HTTPS de sucursal sin credenciales.",
        );
    }
    await db.query(
      "update sales_channels set presentation=$2::jsonb,product_prices=$3::jsonb where id=$1",
      [p.id, JSON.stringify(p.card), JSON.stringify(p.prices)],
    );
  }
  await db.query(
    "update sales_channels set presentation=$1::jsonb where id='store'",
    [JSON.stringify(v.direct)],
  );
  await db.query(
    "update store_settings set value=jsonb_set(value,'{delivery}',to_jsonb($1::boolean)) where singleton",
    [v.delivery],
  );
}
