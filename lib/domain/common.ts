import { z } from "zod";
import type { DB } from "../db";
import type {
  Settings,
  Product,
  Recipe,
  Zone,
  Promotion,
  Ingredient,
  Dough,
  FinanceSale,
  AdminOrder,
  KitchenOrder,
  Notification,
  Purchase,
  Expense,
  Movement,
  ChannelConfig,
} from "../contracts";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireState(
  value: unknown,
  message: string,
  status = 409,
): asserts value {
  if (!value) throw new DomainError(message, status);
}
export const id = z.string().uuid();
export const money = z.number().int().min(0).max(100000000);
export const pos = z.number().finite().positive().max(10000000);
export const txt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s),
      "Texto no válido",
    );
export const clean = (max: number) =>
  txt(max).refine(Boolean, "Campo obligatorio");
export const identifier = z.object({ id });
export const ts = z.string().datetime({ offset: true });
export const arr = (v: string[]) =>
  "{" +
  v
    .map((s) => '"' + s.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"')
    .join(",") +
  "}";
export const list = <T>(rows: T[]) => rows[0] ?? null;
export async function lock(d: DB) {
  await d.query(
    "select singleton from store_settings where singleton for update",
  );
}
export async function signal(d: DB, ...topics: string[]) {
  await d.query(
    "update store_signals set version=version+1 where topic=any($1::text[])",
    [arr(topics)],
  );
}
export async function settings(d: DB): Promise<Settings> {
  const r = await d.query<{ value: Settings }>(
    "select value from store_settings where singleton",
  );
  return r[0].value;
}
export const publicSettings = (s: Settings) => ({
  open: s.open,
  pickup: s.pickup,
  delivery: s.delivery,
  homeTitle: s.homeTitle,
  homeDescription: s.homeDescription,
  banner: s.banner,
  hours: s.hours,
  businessName: s.businessName,
});
export const ovenSettings = (s: Settings) => ({
  open: s.open,
  ovenMinutes: s.ovenMinutes,
  ovenCapacity: s.ovenCapacity,
  temperature: s.temperature,
});
export const baseUnit = (unit: string) =>
  (
    ({
      g: ["g", 1],
      kg: ["g", 1000],
      oz: ["g", 28.349523125],
      ml: ["ml", 1],
      L: ["ml", 1000],
      l: ["ml", 1000],
      fl_oz: ["ml", 29.5735295625],
      pz: ["pz", 1],
    }) as const
  )[unit as "g" | "kg" | "oz" | "ml" | "L" | "l" | "fl_oz" | "pz"];
export function convert(quantity: number, unit: string, base: string) {
  const factor = baseUnit(unit);
  requireState(
    factor && factor[0] === base,
    "Las unidades son incompatibles.",
    422,
  );
  const v = Math.round(quantity * factor[1] * 10000) / 10000;
  requireState(v > 0 && Number.isFinite(v), "Cantidad fuera de rango.", 422);
  return v;
}
export const stockSQL = `select i.id,i.stock-coalesce((select sum(r.quantity) from inventory_reservations r join orders o on o.id=r.order_id where r.ingredient_id=i.id and r.status='held' and o.expires_at>now()),0) as free from ingredients i`;
export const doughSQL = `select b.id,b.remaining-coalesce((select sum(r.quantity) from inventory_reservations r join orders o on o.id=r.order_id where r.batch_id=b.id and r.status='held' and o.expires_at>now()),0) as free,b.expires_at from dough_batches b where b.status='ready' and b.expires_at>now()`;
export async function products(d: DB, publicOnly = false, limitDough = false) {
  const available = publicOnly
    ? `p.available and not exists(select 1 from recipe_items ri join (${stockSQL}) s on s.id=ri.ingredient_id where ri.product_id=p.id and (not $1::boolean or ri.category<>'masa') group by s.id,s.free having s.free < sum(ri.base_quantity)) and not exists(select 1 from product_ingredient_labels l join (${stockSQL}) s on s.id=l.ingredient_id where l.product_id=p.id and l.label=any(p.ingredients) and s.free<=0) and (not $1::boolean or exists(select 1 from (${doughSQL}) b where free>=1))`
    : "p.available";
  return d.query<Product>(
    `select p.id,p.name,p.description,p.price,p.image,p.ingredients,p.removable,${available} as available,p.archived,p.position from products p ${publicOnly ? "where not archived" : ""} order by position,name`,
    publicOnly ? [limitDough] : [],
  );
}
export const zones = (d: DB) =>
  d.query<Zone>("select * from delivery_zones order by name");
export const promotions = (d: DB) =>
  d.query<Promotion>(
    "select id,code,percent::float8,enabled from promotions order by code",
  );
export const ingredients = (d: DB) =>
  d.query<Ingredient>(
    `select id,name,unit,stock::float8,minimum::float8,supplier,purchase_quantity::float8 as "purchaseQuantity",purchase_price as "purchasePrice",purchase_unit as "purchaseUnit",purchase_date::text as "purchaseDate",presentation,unit_cost::float8 as "unitCost" from ingredients order by name`,
  );
export const purchases = (d: DB) =>
  d.query<Purchase>(
    `select id,ingredient_id as "ingredientId",quantity::float8,unit,price,date::text,supplier from ingredient_purchases order by date desc,id desc limit 300`,
  );
export const recipes = (d: DB) =>
  d.query<Recipe>(`select r.product_id as "productId",r.complete,
 coalesce(jsonb_agg(jsonb_build_object('ingredientId',i.id,'quantity',x.quantity,'unit',x.unit,'category',x.category) order by i.name) filter(where i.id is not null),'[]') as items,
 case when r.complete and count(i.id)>0 and count(x.base_quantity)=count(i.unit_cost) then round(sum(x.base_quantity*i.unit_cost))::integer end as cost,
 coalesce(round(sum(x.base_quantity*i.unit_cost)),0)::integer as "partialCost"
 from recipes r left join recipe_items x on x.product_id=r.product_id left join ingredients i on x.ingredient_id=i.id group by r.product_id,r.complete`);
export const dough = (d: DB) =>
  d.query<Dough>(`select id,prepared_at as "preparedAt",flour::float8,hydration::float8,yeast::float8,salt::float8,ball_weight::float8 as "ballWeight",balls,remaining,
 (select coalesce(sum(r.quantity),0)::int from inventory_reservations r join orders o on o.id=r.order_id where r.batch_id=b.id and r.status='held' and o.expires_at>now()) held,
 (select coalesce(sum(r.quantity),0)::int from inventory_reservations r where r.batch_id=b.id and r.status='consumed') used,
 (select coalesce(-sum(m.quantity),0)::int from inventory_movements m where m.batch_id=b.id and m.type='waste') waste,
 ferment_start as "fermentStart",ferment_hours::float8 as "fermentHours",expires_at as "expiresAt",status from dough_batches b order by expires_at desc`);
export const sales = (d: DB) =>
  d.query<FinanceSale>(
    `select id,date,channel,gross,discount,refund,fee,cost,units,product_sales as "productSales" from finance_sales order by date desc`,
  );
export const expenses = (d: DB) =>
  d.query<Expense>(
    "select id,name,category,amount,date::text,receipt from expenses order by date desc",
  );
export const movements = (d: DB) =>
  d.query<Movement>(
    `select id,ingredient_id as "ingredientId",batch_id as "batchId",type,quantity::float8,date,reason from inventory_movements order by date desc limit 300`,
  );
export const channels = (d: DB) =>
  d.query<ChannelConfig>(
    "select id,name,commission::float8 from sales_channels order by name",
  );
export async function orders(d: DB, privateData: true): Promise<AdminOrder[]>;
export async function orders(
  d: DB,
  privateData: false,
): Promise<KitchenOrder[]>;
export async function orders(d: DB, privateData: boolean) {
  const extra = privateData
    ? `,o.total,o.customer_name as name,o.phone,o.email,o.address,o.delivery_references as "references",o.notes,o.created_at as "createdAt"`
    : "";
  return d.query<
    KitchenOrder | AdminOrder
  >(`select o.id,o.number,o.status,o.mode,o.payment_status as "paymentStatus",o.paid_at as "paidAt"${extra},
 coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',i.name,'image',i.image,'removed',i.removed,'note',i.note,'status',u.status,'startedAt',u.started_at,'endsAt',u.ends_at) order by i.id,u.ordinal) from order_items i join order_item_units u on u.item_id=i.id where i.order_id=o.id),'[]') as units
 from orders o ${privateData ? "" : "where o.paid_at is not null and o.status in ('confirmed','preparing','baking','ready','dispatched')"} order by o.created_at ${privateData ? "desc limit 300" : "asc"}`);
}
export async function notify(
  d: DB,
  s: Settings,
  opts: {
    key: string;
    type: string;
    to: string;
    subject: string;
    orderId?: string;
    payload: Notification["payload"];
  },
) {
  const state = s.notifications[opts.type] === false ? "skipped" : "pending";
  await d.query(
    `insert into notification_events(dedupe,type,recipient,subject,order_id,payload,state) values($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict(dedupe) do nothing`,
    [
      opts.key,
      opts.type,
      opts.to,
      opts.subject,
      opts.orderId ?? null,
      JSON.stringify(opts.payload),
      state,
    ],
  );
}
