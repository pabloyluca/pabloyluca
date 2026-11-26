import { saveChannelPresentation } from "./channel-editor";
import { discountAmount } from "../price";
import { z } from "zod";
import { isCatalogCMS } from "../mode";
import { db, type DB } from "../db";
import type { AdminData, KitchenData, Role, Settings } from "../contracts";
import {
  arr,
  baseUnit,
  channels,
  clean,
  convert,
  DomainError,
  dough,
  expenses,
  id,
  identifier,
  ingredients,
  list,
  lock,
  money,
  movements,
  notify,
  orders,
  ovenSettings,
  pos,
  products,
  promotions,
  purchases,
  recipes,
  requireState,
  sales,
  settings,
  signal,
  ts,
  txt,
  zones,
} from "./common";
import { expire, orderNotify } from "./commerce";

// Scope PostgreSQL row policies to the staff identity already verified by Supabase Auth.
async function asStaff<T>(actor: string | undefined, read: (d: DB) => Promise<T>) {
  const store = await db();
  if (!isCatalogCMS()) return read(store);
  return store.tx(async tx => {
    await tx.query("select set_config('pl.staff_id', $1, true)", [id.parse(actor)]);
    return read(tx);
  });
}

export async function staffRole(userId: string): Promise<Role | null> {
  const r = await asStaff(userId, d => d.query<{role: Role}>(
    "select role from profiles where id=$1", [id.parse(userId)]
  ));
  return r[0]?.role ?? null;
}

export async function adminData(actor?: string): Promise<AdminData> {
  return asStaff(actor, readAdmin);
}

async function readAdmin(d: DB): Promise<AdminData> {
  return {
    purchases: await purchases(d),
    settings: await settings(d),
    products: await products(d),
    zones: await zones(d),
    promotions: await promotions(d),
    orders: await orders(d, true),
    ingredients: await ingredients(d),
    recipes: await recipes(d),
    dough: await dough(d),
    expenses: await expenses(d),
    sales: await sales(d),
    channels: await channels(d),
    movements: await movements(d),
  };
}
export async function kitchenData(actor?: string): Promise<KitchenData> {
  return asStaff(actor, async d => ({
    orders: await orders(d, false),
    settings: ovenSettings(await settings(d)),
  }));
}

const integer = (min: number, max: number) =>
  z.number().int().min(min).max(max);
const website = txt(1800).refine(
  (v) => v === "" || /^\/(?!\/)[\w./%-]+$/.test(v) || /^https:\/\//i.test(v),
  "URL no válida",
);
const settingSchema = z
  .object({
    open: z.boolean(),
    pickup: z.boolean(),
    delivery: z.boolean(),
    ovenMinutes: integer(1, 120),
    ovenCapacity: integer(1, 100),
    temperature: integer(30, 600),
    maxActiveUnits: integer(1, 1000),
    limitDough: z.boolean(),
    veganSurcharge: money,
    homeTitle: clean(120),
    homeDescription: txt(650),
    banner: txt(500),
    hours: txt(500),
    businessName: clean(120),
    notificationEmail: z.string().email().max(250),
    notifications: z.record(z.string().max(64), z.boolean()),
  })
  .partial()
  .strict();
const productSchema = z
  .object({
    id: id.optional(),
    name: clean(100),
    description: txt(800),
    price: money,
    image: website,
    ingredients: z.array(clean(100)).max(80),
    removable: z.array(clean(100)).max(80),
    available: z.boolean(),
    archived: z.boolean().default(false),
    position: integer(0, 10000).optional(),
    cheeseMode: z.enum(["none", "swap", "native"]).optional(),
    dietClass: z.enum(["plant", "option", "vegan"]).optional(),
    dietVerified: z.boolean().optional(),
  })
  .strip();
const quantity = z.number().finite().nonnegative().max(10000000);
const unit = z.enum(["g", "kg", "oz", "ml", "L", "l", "fl_oz", "pz"]);
const dates = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const kitchenActions = new Set([
  "order.accept",
  "order.ready",
  "order.dispatch",
  "order.deliver",
  "order.pickup",
  "unit.start",
  "unit.extend",
  "unit.ready",
]);
async function kds(d: DB, action: string, key: string, s: Settings) {
  if (action.startsWith("unit.")) {
    const u = list(
      await d.query<{
        id: string;
        status: string;
        order_id: string;
        order_status: string;
      }>(
        `select u.id,u.status,o.id as order_id,o.status as order_status from order_item_units u join order_items i on i.id=u.item_id join orders o on o.id=i.order_id where u.id=$1`,
        [key],
      ),
    );
    requireState(u, "Unidad inexistente.", 404);
    requireState(
      ["preparing", "baking"].includes(u.order_status),
      "Acepta el pedido antes de manejar el horno.",
    );
    if (action === "unit.start") {
      requireState(u.status === "queued", "Esta pizza ya se inició.");
      const oven = (
        await d.query<{ id: string; seconds: number; space: boolean }>(
          `select v.id,v.seconds,v.capacity>(select count(*) from order_item_units x where x.oven_id=v.id and x.status='baking') space from ovens v where v.id='primary' for update`,
        )
      )[0];
      requireState(oven.space, "El horno está lleno. La pizza sigue en cola.");
      await d.query(
        "update order_item_units set status='baking',oven_id=$2,started_at=now(),ends_at=now()+$3::int*interval '1 second' where id=$1",
        [u.id, oven.id, oven.seconds],
      );
      await d.query(
        "update orders set status='baking',updated_at=now() where id=$1",
        [u.order_id],
      );
    } else {
      requireState(u.status === "baking", "Esta pizza no está en el horno.");
      if (action === "unit.extend")
        await d.query(
          "update order_item_units set ends_at=greatest(ends_at,now())+interval '1 minute' where id=$1",
          [u.id],
        );
      else
        await d.query(
          "update order_item_units set status='ready',finished_at=now() where id=$1",
          [u.id],
        );
    }
    return;
  }
  const o = list(
    await d.query<{ status: string; mode: string; paid_at: string | null }>(
      "select status,mode,paid_at from orders where id=$1",
      [key],
    ),
  );
  requireState(o?.paid_at, "Pedido de cocina inexistente.", 404);
  const transition: Record<string, [string[], string]> = {
    "order.accept": [["confirmed"], "preparing"],
    "order.ready": [["preparing", "baking"], "ready"],
    "order.dispatch": [["ready"], "dispatched"],
    "order.deliver": [["dispatched"], "delivered"],
    "order.pickup": [["ready"], "picked_up"],
  };
  const [from, to] = transition[action];
  requireState(from.includes(o.status), "El pedido ya cambió de estado.");
  if (action === "order.ready") {
    const pending = await d.query(
      "select u.id from order_item_units u join order_items i on i.id=u.item_id where i.order_id=$1 and u.status<>'ready' limit 1",
      [key],
    );
    requireState(!pending.length, "Todavía hay pizzas pendientes.");
  }
  if (action === "order.dispatch" || action === "order.deliver")
    requireState(o.mode === "delivery", "Este pedido es para recolección.");
  if (action === "order.pickup")
    requireState(o.mode === "pickup", "Este pedido es a domicilio.");
  await d.query("update orders set status=$2,updated_at=now() where id=$1", [
    key,
    to,
  ]);
  if (to === "ready" || to === "dispatched")
    await orderNotify(
      d,
      s,
      key,
      to,
      to === "ready" ? "Tu pizza está lista" : "Tu pedido va en camino",
    );
}
const held = (d: DB, id: string) =>
  d
    .query<{
      n: number;
    }>(
      "select coalesce(sum(quantity),0)::float8 n from inventory_reservations where ingredient_id=$1 and status='held'",
      [id],
    )
    .then((r) => r[0].n);
async function catalog(d: DB, action: string, raw: unknown) {
  if (action === "product.save") {
    const v = productSchema.parse(raw);
    requireState(
      v.removable.every((x) => v.ingredients.includes(x)),
      "Los ingredientes removibles deben figurar en la receta.",
      422,
    );
    let ingredientsChanged = false;
    if (v.id) {
      const current = list(
        await d.query<{ ingredients: string[] }>(
          "select ingredients from products where id=$1",
          [v.id],
        ),
      );
      requireState(current, "Producto desconocido.", 404);
      if (
        JSON.stringify([...current.ingredients].sort()) !==
        JSON.stringify([...v.ingredients].sort())
      ) {
        ingredientsChanged = true;
        await d.query("update recipes set complete=false where product_id=$1", [
          v.id,
        ]);
      }
    }
    const p = (
      await d.query<{ id: string }>(
        `insert into products(id,name,description,price,image,ingredients,removable,available,archived,position)
  values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6::text[],$7::text[],$8,$9,coalesce($10::int,(select coalesce(max(position),0)+1 from products))) on conflict(id) do update set name=excluded.name,description=excluded.description,price=excluded.price,image=excluded.image,ingredients=excluded.ingredients,removable=excluded.removable,available=excluded.available,archived=excluded.archived,position=excluded.position returning id`,
        [
          v.id ?? null,
          v.name,
          v.description,
          v.price,
          v.image,
          arr(v.ingredients),
          arr(v.removable),
          v.available,
          v.archived,
          v.position ?? null,
        ],
      )
    )[0];
    await d.query(
      "insert into recipes(product_id) values($1) on conflict do nothing",
      [p.id],
    );
    await d.query(
      "insert into product_ingredient_labels select p.id,i.id,t.label from products p cross join lateral unnest(p.ingredients) t(label) join ingredients i on lower(i.name)=lower(t.label) where p.id=$1 on conflict do nothing",
      [p.id],
    );
    await d.query(
      `update products set cheese_mode=coalesce($2,cheese_mode),diet_class=coalesce($3,diet_class),diet_verified=case when $5 then false else coalesce($4,diet_verified) end where id=$1`,
      [
        p.id,
        v.cheeseMode ?? null,
        v.dietClass ?? null,
        v.dietVerified ?? null,
        ingredientsChanged,
      ],
    );
    return p;
  }
  if (action.startsWith("product.")) {
    const { id: key } = identifier.parse(raw);
    const a = list(
      await d.query<{ id: string; position: number }>(
        "select id,position from products where id=$1",
        [key],
      ),
    );
    requireState(a, "Producto desconocido.", 404);
    if (action === "product.archive")
      await d.query(
        "update products set archived=true,available=false where id=$1",
        [key],
      );
    else if (action === "product.duplicate") {
      const p = (
        await d.query<{ id: string }>(
          `insert into products(name,description,price,image,ingredients,removable,available,cheese_mode,diet_class,category,size_cm,position) select name||' (copia)',description,price,image,ingredients,removable,false,cheese_mode,diet_class,category,size_cm,(select max(position)+1 from products) from products where id=$1 returning id`,
          [key],
        )
      )[0];
      await d.query(
        "insert into recipes(product_id,complete,cost_pending) select $2,complete,cost_pending from recipes where product_id=$1",
        [key, p.id],
      );
      await d.query(
        "insert into recipe_items select $2,ingredient_id,quantity,unit,base_quantity,category from recipe_items where product_id=$1",
        [key, p.id],
      );
      await d.query(
        "insert into product_ingredient_labels select $2,ingredient_id,label from product_ingredient_labels where product_id=$1",
        [key, p.id],
      );
      return p;
    } else if (action === "product.up" || action === "product.down") {
      const sorted = await d.query<{ id: string }>(
        "select id from products where not archived order by position,name",
      );
      const ix = sorted.findIndex((p) => p.id === key),
        dst = ix + (action === "product.up" ? -1 : 1);
      if (ix >= 0 && dst >= 0 && dst < sorted.length) {
        [sorted[ix], sorted[dst]] = [sorted[dst], sorted[ix]];
        await d.query(
          "update products p set position=x.n::int from unnest($1::uuid[]) with ordinality x(id,n) where p.id=x.id",
          [arr(sorted.map((x) => x.id))],
        );
      }
    } else throw new DomainError("Acción desconocida.", 404);
    return { id: key };
  }
  if (action === "zone.save") {
    const v = z
      .object({
        id: id.optional(),
        name: clean(120),
        fee: money,
        postcodes: z
          .array(z.string().regex(/^\d{5}$/))
          .min(1)
          .max(250),
        enabled: z.boolean(),
      })
      .parse(raw);
    return (
      await d.query(
        "insert into delivery_zones values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4::text[],$5) on conflict(id) do update set name=excluded.name,fee=excluded.fee,postcodes=excluded.postcodes,enabled=excluded.enabled returning id",
        [v.id ?? null, v.name, v.fee, arr(v.postcodes), v.enabled],
      )
    )[0];
  }
  const v = z
    .object({
      id: id.optional(),
      code: z
        .string()
        .trim()
        .regex(/^[\w-]{1,40}$/),
      percent: z.number().min(0).max(100),
      enabled: z.boolean(),
    })
    .parse(raw);
  return (
    await d.query(
      "insert into promotions values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4) on conflict(id) do update set code=excluded.code,percent=excluded.percent,enabled=excluded.enabled returning id",
      [v.id ?? null, v.code.toUpperCase(), v.percent, v.enabled],
    )
  )[0];
}
async function inventory(d: DB, action: string, raw: unknown, s: Settings) {
  if (action === "recipe.save") {
    const v = z
      .object({
        productId: id,
        costPending: z.boolean().optional(),
        complete: z.boolean(),
        items: z
          .array(
            z.object({
              ingredientId: id,
              quantity: pos,
              unit,
              category: z.enum([
                "masa",
                "salsa",
                "toppings",
                "empaque",
                "otros",
              ]),
            }),
          )
          .max(100),
      })
      .parse(raw);
    requireState(
      !v.complete ||
        ["masa", "toppings", "empaque"].every((category) =>
          v.items.some((item) => item.category === category),
        ),
      "Antes de confirmar el costo completo, registra masa, toppings y empaque.",
    );
    const all = await ingredients(d);
    await d.query(
      `update products set diet_verified=false where id=$1 and exists(
      select ingredient_id from recipe_items where product_id=$1
      except select unnest($2::uuid[])
    ) or (id=$1 and exists(select unnest($2::uuid[]) except select ingredient_id from recipe_items where product_id=$1))`,
      [v.productId, arr(v.items.map((item) => item.ingredientId))],
    );
    await d.query(
      "insert into recipes(product_id,complete) values($1,$2) on conflict(product_id) do update set complete=excluded.complete",
      [v.productId, v.complete],
    );
    if (v.costPending !== undefined)
      await d.query("update recipes set cost_pending=$2 where product_id=$1", [
        v.productId,
        v.costPending,
      ]);
    await d.query("delete from recipe_items where product_id=$1", [
      v.productId,
    ]);
    for (const row of v.items) {
      const i = all.find((x) => x.id === row.ingredientId);
      requireState(i, "Insumo desconocido.");
      requireState(
        !v.complete || i.unitCost !== null,
        "Falta el costo de un insumo.",
      );
      await d.query(
        "insert into recipe_items(product_id,ingredient_id,quantity,unit,category,base_quantity) values($1,$2,$3,$4,$5,$6)",
        [
          v.productId,
          i.id,
          row.quantity,
          row.unit,
          row.category,
          convert(row.quantity, row.unit, i.unit),
        ],
      );
    }
    return { id: v.productId };
  }
  if (action === "ingredient.save") {
    const v = z
      .object({
        id: id.optional(),
        name: clean(120),
        unit: z.enum(["g", "ml", "pz"]),
        stock: quantity.optional(),
        minimum: quantity,
        supplier: txt(180).optional(),
        purchaseQuantity: quantity.optional(),
        purchasePrice: money.optional(),
        purchaseDate: dates.nullish(),
        purchaseUnit: unit.optional(),
        presentation: txt(180).optional(),
        unitCost: z.number().nullable().optional(),
      })
      .parse(raw);
    const before = v.id
      ? (await ingredients(d)).find((i) => i.id === v.id)
      : null;
    requireState(!v.id || before, "Insumo desconocido.", 404);
    requireState(
      !before || v.unit === before.unit,
      "La unidad base de un insumo registrado es fija.",
    );
    const stock = v.stock ?? before?.stock ?? 0;
    requireState(
      !before || stock >= (await held(d, before.id)),
      "Hay inventario reservado para pedidos.",
    );
    const qty = v.purchaseQuantity ?? before?.purchaseQuantity ?? 0,
      price = v.purchasePrice ?? before?.purchasePrice ?? 0,
      pu = v.purchaseUnit ?? before?.purchaseUnit ?? v.unit;
    requireState(baseUnit(pu)?.[0] === v.unit, "Unidades incompatibles.");
    const base = qty ? convert(qty, pu, v.unit) : 0;
    const r = (
      await d.query<{ id: string }>(
        `insert into ingredients(id,name,unit,stock,minimum,supplier,purchase_quantity,purchase_price,purchase_date,purchase_unit,presentation,unit_cost) values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$8::int::numeric/nullif($12::numeric,0)) on conflict(id) do update set name=excluded.name,stock=excluded.stock,minimum=excluded.minimum,supplier=excluded.supplier,purchase_quantity=excluded.purchase_quantity,purchase_price=excluded.purchase_price,purchase_date=excluded.purchase_date,purchase_unit=excluded.purchase_unit,presentation=excluded.presentation,unit_cost=excluded.unit_cost returning id`,
        [
          v.id ?? null,
          v.name,
          v.unit,
          stock,
          v.minimum,
          v.supplier ?? "",
          qty,
          price,
          v.purchaseDate ?? before?.purchaseDate ?? null,
          pu,
          v.presentation ?? "",
          base,
        ],
      )
    )[0];
    if (stock !== (before?.stock ?? 0))
      await d.query(
        "insert into inventory_movements(ingredient_id,quantity,type,reason) values($1,$2,'adjustment','Actualización de existencias')",
        [r.id, stock - (before?.stock ?? 0)],
      );
    if (
      base &&
      (qty !== before?.purchaseQuantity ||
        price !== before?.purchasePrice ||
        pu !== before?.purchaseUnit)
    )
      await d.query(
        "insert into ingredient_purchases(ingredient_id,quantity,unit,base_quantity,price,supplier,date) values($1,$2,$3,$4,$5,$6,coalesce($7::date,current_date))",
        [r.id, qty, pu, base, price, v.supplier ?? "", v.purchaseDate ?? null],
      );
    return r;
  }
  if (action === "purchase.create") {
    const v = z
      .object({
        ingredientId: id,
        quantity: pos,
        unit,
        price: money,
        supplier: txt(180).optional(),
        date: dates.optional(),
      })
      .parse(raw);
    const i = (await ingredients(d)).find((x) => x.id === v.ingredientId);
    requireState(i, "Insumo desconocido.", 404);
    const base = convert(v.quantity, v.unit, i.unit),
      supplier = v.supplier ?? i.supplier;
    const r = (
      await d.query<{ id: string }>(
        "insert into ingredient_purchases(ingredient_id,quantity,unit,base_quantity,price,supplier,date) values($1,$2,$3,$4,$5,$6,coalesce($7::date,current_date)) returning id",
        [i.id, v.quantity, v.unit, base, v.price, supplier, v.date ?? null],
      )
    )[0];
    await d.query(
      "update ingredients set stock=stock+$2,purchase_quantity=$3,purchase_price=$4,purchase_unit=$5,unit_cost=$4::integer::numeric/$2::numeric,supplier=$6,purchase_date=coalesce($7::date,current_date) where id=$1",
      [i.id, base, v.quantity, v.price, v.unit, supplier, v.date ?? null],
    );
    await d.query(
      "insert into inventory_movements(ingredient_id,quantity,type,reason) values($1,$2,'purchase',$3)",
      [i.id, base, "Compra " + r.id],
    );
    if (v.price)
      await d.query(
        "insert into expenses(name,category,amount,date) values($1,'inventory',$2,coalesce($3::date,current_date))",
        ["Compra de " + i.name, v.price, v.date ?? null],
      );
    return r;
  }
  const v = z
    .object({
      ingredientId: id,
      quantity: z
        .number()
        .finite()
        .min(-10000000)
        .max(10000000)
        .refine((n) => n !== 0),
      type: z.enum([
        "purchase",
        "consumption",
        "waste",
        "adjustment",
        "production",
        "reversal",
      ]),
      reason: clean(250),
    })
    .parse(raw);
  const i = (await ingredients(d)).find((x) => x.id === v.ingredientId);
  requireState(i, "Insumo desconocido.", 404);
  const delta = ["consumption", "waste"].includes(v.type)
    ? -Math.abs(v.quantity)
    : v.quantity;
  requireState(
    i.stock + delta >= (await held(d, i.id)),
    "Existencias insuficientes o reservadas.",
  );
  await d.query("update ingredients set stock=stock+$2 where id=$1", [
    i.id,
    delta,
  ]);
  const r = (
    await d.query<{ id: string }>(
      "insert into inventory_movements(ingredient_id,quantity,type,reason) values($1,$2,$3,$4) returning id",
      [i.id, delta, v.type, v.reason],
    )
  )[0];
  if (i.stock + delta <= i.minimum)
    await notify(d, s, {
      key: "low_stock/" + r.id,
      type: "low_stock",
      to: s.notificationEmail,
      subject: "Inventario bajo",
      payload: { detail: i.name },
    });
  return r;
}
async function production(d: DB, action: string, raw: unknown) {
  const status = z.enum(["preparing", "fermenting", "ready", "waste"]);
  if (action === "dough.status") {
    const v = z.object({ id, status }).parse(raw);
    const b = list(
      await d.query<{ remaining: number; status: string }>(
        "select remaining,status from dough_batches where id=$1",
        [v.id],
      ),
    );
    requireState(b, "Lote desconocido.", 404);
    if (b.status === v.status) return { id: v.id };
    requireState(b.status !== "waste", "El lote ya está en merma.");
    const allocated = list(
      await d.query(
        "select id from inventory_reservations where batch_id=$1 and status='held' limit 1",
        [v.id],
      ),
    );
    requireState(!allocated, "Este lote tiene bolas reservadas.");
    if (v.status === "waste" && b.remaining)
      await d.query(
        "insert into inventory_movements(batch_id,quantity,type,reason) values($1,$2,'waste','Merma del lote')",
        [v.id, -b.remaining],
      );
    await d.query(
      "update dough_batches set status=$2,remaining=case when $2='waste' then 0 else remaining end where id=$1",
      [v.id, v.status],
    );
    return { id: v.id };
  }
  const v = z
    .object({
      id: id.optional(),
      preparedAt: ts,
      flour: pos,
      hydration: z.number().min(0).max(150),
      yeast: quantity,
      salt: quantity,
      ballWeight: pos,
      balls: integer(1, 10000),
      fermentStart: ts,
      fermentHours: quantity,
      expiresAt: ts,
      status,
    })
    .parse(raw);
  requireState(
    !v.id,
    "Cambia el estado de los lotes registrados mediante la acción de estado.",
  );
  requireState(
    new Date(v.expiresAt) > new Date(v.preparedAt),
    "La caducidad debe ser posterior a la preparación.",
  );
  requireState(v.status !== "waste", "Registra primero la producción.");
  const flour = (await ingredients(d)).find(
    (i) => i.id === "00000000-0000-4000-8002-000000000001",
  );
  requireState(
    flour && flour.stock - v.flour >= (await held(d, flour.id)),
    "No hay suficiente harina disponible.",
  );
  const r = (
    await d.query<{ id: string }>(
      `insert into dough_batches(prepared_at,flour,hydration,yeast,salt,ball_weight,balls,remaining,ferment_start,ferment_hours,expires_at,status) values($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11) returning id`,
      [
        v.preparedAt,
        v.flour,
        v.hydration,
        v.yeast,
        v.salt,
        v.ballWeight,
        v.balls,
        v.fermentStart,
        v.fermentHours,
        v.expiresAt,
        v.status,
      ],
    )
  )[0];
  await d.query("update ingredients set stock=stock-$2 where id=$1", [
    flour.id,
    v.flour,
  ]);
  await d.query(
    "insert into inventory_movements(ingredient_id,quantity,type,reason) values($1,$2,'production',$3)",
    [flour.id, -v.flour, "Harina para lote " + r.id],
  );
  await d.query(
    "insert into inventory_movements(batch_id,quantity,type,reason) values($1,$2,'production','Lote de masa')",
    [r.id, v.balls],
  );
  return r;
}
async function financial(d: DB, action: string, raw: unknown) {
  const channel = z.enum([
    "store",
    "whatsapp",
    "uber",
    "rappi",
    "didi",
    "other",
  ]);
  if (action === "channel.save") {
    const v = z
      .object({
        id: channel,
        commission: z.number().min(0).max(100).nullable(),
      })
      .parse(raw);
    await d.query("update sales_channels set commission=$2 where id=$1", [
      v.id,
      v.commission,
    ]);
    return { id: v.id };
  }
  if (action === "expense.create") {
    const v = z
      .object({
        name: clean(150),
        category: clean(50),
        amount: money.refine((n) => n > 0),
        date: dates,
        receipt: txt(1800).default(""),
      })
      .parse(raw);
    return (
      await d.query(
        "insert into expenses(name,category,amount,date,receipt) values($1,$2,$3,$4,$5) returning id",
        [v.name, v.category, v.amount, v.date, v.receipt],
      )
    )[0];
  }
  const v = z
    .object({
      date: z.union([dates, ts]),
      channel,
      gross: money,
      discount: money.default(0),
      fee: money.nullish(),
      cost: money.nullish(),
      units: integer(0, 10000),
    })
    .parse(raw);
  requireState(v.gross >= v.discount, "El descuento supera el ingreso.");
  const ch = (await channels(d)).find((c) => c.id === v.channel)!;
  const fee =
    v.fee ??
    (ch.commission === null
      ? null
      : discountAmount(v.gross - v.discount, ch.commission));
  return (
    await d.query(
      `insert into finance_sales(date,channel,gross,discount,fee,cost,units,product_sales) values(case when length($1::text)=10 then $1::date::timestamp at time zone 'America/Cancun' else $1::timestamptz end,$2,$3,$4,$5,$6,$7,'[]') returning id`,
      [v.date, v.channel, v.gross, v.discount, fee, v.cost ?? null, v.units],
    )
  )[0];
}
export async function mutate(
  action: string,
  payload: unknown,
  role: Role,
  actor = role as string,
) {
  requireState(
    ["OWNER", "ADMIN", "KITCHEN"].includes(role),
    "Acceso denegado.",
    403,
  );
  requireState(
    role !== "KITCHEN" || kitchenActions.has(action),
    "Permisos insuficientes.",
    403,
  );
  return (await db()).tx(async (d) => {
    if (isCatalogCMS()) {
      requireState(["ADMIN","OWNER"].includes(role), "Permisos insuficientes.", 403);
      const editable = action.startsWith("product.") || ["settings.save","channel.presentation","channel.save","zone.save","promotion.save","recipe.save","ingredient.save"].includes(action);
      requireState(editable,"Esta operación requiere habilitar la cocina.",409);
      await d.query("select set_config('pl.staff_id', $1, true)",[id.parse(actor)]);
    }
    await lock(d);
    if (!isCatalogCMS()) await expire(d);
    const s = await settings(d);
    let result: { id?: unknown } | undefined;
    if (kitchenActions.has(action)) {
      const { id: key } = identifier.parse(payload);
      await kds(d, action, key, s);
      result = { id: key };
    } else if (action === "channel.presentation") {
      await saveChannelPresentation(d, payload);
    } else if (action === "settings.save") {
      const v = settingSchema.parse(payload),
        updated = {
          ...s,
          ...v,
          notifications: { ...s.notifications, ...v.notifications },
        };
      await d.query(
        "update store_settings set value=$1::jsonb where singleton",
        [JSON.stringify(updated)],
      );
      await d.query(
        "update ovens set capacity=$1,temperature=$2,seconds=$3 where id='primary'",
        [updated.ovenCapacity, updated.temperature, updated.ovenMinutes * 60],
      );
    } else if (
      action.startsWith("product.") ||
      ["promotion.save", "zone.save"].includes(action)
    )
      result = await catalog(d, action, payload);
    else if (
      [
        "ingredient.save",
        "movement.create",
        "purchase.create",
        "recipe.save",
      ].includes(action)
    )
      result = await inventory(d, action, payload, s);
    else if (["dough.save", "dough.status"].includes(action))
      result = await production(d, action, payload);
    else if (["channel.save", "sale.create", "expense.create"].includes(action))
      result = await financial(d, action, payload);
    else throw new DomainError("Acción desconocida.", 404);
    await d.query(
      "insert into audit_logs(actor,action,entity) values($1,$2,$3)",
      [actor, action, result?.id ?? null],
    );
    await signal(
      d,
      "staff",
      ...(["channel.save", "sale.create", "expense.create"].includes(action)
        ? []
        : ["public"]),
      ...(kitchenActions.has(action) || action === "settings.save"
        ? ["kitchen"]
        : []),
    );
    return { ok: true, ...result };
  });
}
