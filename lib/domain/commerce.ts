import { storefrontChannels } from "../sales-channels";
import { discountAmount } from "../price";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db, type DB } from "../db";
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentUpdate,
  Tracking,
  Settings,
} from "../contracts";
import {
  arr,
  clean,
  doughSQL,
  id,
  list,
  lock,
  money,
  notify,
  publicSettings,
  products,
  promotions,
  recipes,
  requireState,
  settings,
  signal,
  stockSQL,
  ts,
  txt,
  zones,
} from "./common";
const line = z
  .object({
    productId: id,
    quantity: z.number().int().min(1).max(50),
    removed: z.array(clean(120)).max(40).default([]),
    note: txt(350).default(""),
  })
  .strict();
const orderInput = z
  .object({
    expectedTotal: money.optional(),
    items: z.array(line).min(1).max(50),
    name: clean(100),
    phone: z
      .string()
      .regex(/^\+?[\d ()-]{8,22}$/)
      .refine((v) => v.replace(/\D/g, "").length >= 8),
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    mode: z.enum(["pickup", "delivery"]),
    address: txt(350).optional(),
    postcode: txt(12).optional(),
    zoneId: id.optional(),
    references: txt(300).optional(),
    notes: txt(350).optional(),
    promoCode: txt(40).optional(),
  })
  .strict();
const fields = `id,token,number,total,subtotal,fee,discount,expires_at as "expiresAt",status`;
const project = (d: DB, idValue: string) =>
  d
    .query<CheckoutResult>(`select ${fields} from orders where id=$1`, [
      idValue,
    ])
    .then(list);
export async function getOrderForPayment(idValue: string) {
  return project(await db(), id.parse(idValue));
}
export async function getPendingByToken(token: string) {
  if (!/^[\w-]{40,80}$/.test(token)) return null;
  return list(
    await (
      await db()
    ).query<CheckoutResult>(`select ${fields} from orders where token=$1`, [
      token,
    ]),
  );
}
export async function tracking(token: string) {
  if (!/^[\w-]{40,80}$/.test(token)) return null;
  return list(
    await (
      await db()
    ).query<Tracking>(
      `select number,case when status='pending' and expires_at<=now() then 'cancelled' else status end as status,mode,payment_status as "paymentStatus",updated_at as "updatedAt" from orders where token=$1`,
      [token],
    ),
  );
}
export async function getMenu() {
  const d = await db();
  const s = await settings(d);
  return {
    commercial: storefrontChannels(await d.query<{id:string; presentation:object}>("select id,presentation from sales_channels")),
    settings: publicSettings(s),
    products: await products(d, true, s.limitDough),
    zones: (await zones(d)).filter((v) => v.enabled),
    promotions: (await promotions(d)).filter((v) => v.enabled),
  };
}
export async function expire(d: DB) {
  const expired = await d.query<{ id: string }>(
    `update orders set status='cancelled',payment_status='expired',updated_at=now() where status='pending' and expires_at<=now() returning id`,
  );
  if (expired.length) {
    await d.query(
      "update inventory_reservations set status='released' where status='held' and order_id=any($1::uuid[])",
      [arr(expired.map((x) => x.id))],
    );
    await signal(d, "public", "staff");
  }
  return expired.length;
}
export async function expireReservations() {
  return (await db()).tx(async (d) => {
    await lock(d);
    return expire(d);
  });
}
export async function checkout(
  raw: CheckoutInput,
  key: string,
  channel: "store" | "whatsapp" = "store",
): Promise<CheckoutResult> {
  const v = orderInput.parse(raw);
  requireState(
    channel === "store" || channel === "whatsapp",
    "Canal inválido.",
    422,
  );
  requireState(
    typeof key === "string" && /^[a-zA-Z0-9_-]{12,160}$/.test(key),
    "Clave de pedido inválida.",
    422,
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(channel === "store" ? v : { channel, order: v }))
    .digest("hex");
  return (await db()).tx(async (d) => {
    await lock(d);
    await expire(d);
    const existing = list(
      await d.query<CheckoutResult & { hash: string }>(
        `select ${fields},request_hash as hash from orders where request_key=$1`,
        [key],
      ),
    );
    if (existing) {
      requireState(
        existing.hash === hash,
        "La clave ya pertenece a otro carrito.",
      );
      const { hash: _, ...res } = existing;
      return res;
    }
    const s = await settings(d);
    requireState(s.open, "La cocina está cerrada.");
    requireState(s[v.mode], "La modalidad de entrega está desactivada.");
    const quantity = v.items.reduce((sum, x) => sum + x.quantity, 0);
    requireState(
      quantity <= 50,
      "El pedido supera el máximo de 50 pizzas.",
      422,
    );
    const busy = await d.query<{ n: number }>(
      `select coalesce(sum(i.quantity),0)::int n from order_items i join orders o on o.id=i.order_id where o.status in ('pending','confirmed','preparing','baking')`,
    );
    requireState(
      busy[0].n + quantity <= s.maxActiveUnits,
      "La cocina alcanzó su capacidad de pedidos.",
    );
    let fee = 0;
    if (v.mode === "delivery") {
      requireState(
        v.address && v.postcode && v.zoneId,
        "Completa la dirección y la zona.",
        422,
      );
      const zone = (await zones(d)).find(
        (z) =>
          z.id === v.zoneId && z.enabled && z.postcodes.includes(v.postcode!),
      );
      requireState(zone, "Este código postal no está cubierto.");
      fee = zone.fee;
    }
    const catalog = await products(d),
      costs = await recipes(d);
    const lines = v.items.map((x) => {
      const p = catalog.find((p) => p.id === x.productId);
      requireState(
        p && p.available && !p.archived,
        "Una pizza ya no está disponible.",
      );
      requireState(
        x.removed.every((i) => p.removable.includes(i)) &&
          new Set(x.removed).size === x.removed.length,
        "Personalización no permitida.",
        422,
      );
      return { x, p, c: costs.find((r) => r.productId === p.id) };
    });
    const subtotal = lines.reduce(
      (sum, { x, p }) => sum + x.quantity * p.price,
      0,
    );
    let discount = 0;
    if (v.promoCode?.trim()) {
      const promo = (await promotions(d)).find(
        (p) => p.enabled && p.code === v.promoCode!.trim().toUpperCase(),
      );
      requireState(promo, "La promoción ya no está disponible.");
      discount = discountAmount(subtotal, promo.percent);
    }
    const total = subtotal + fee - discount;
    requireState(
      v.expectedTotal === undefined || v.expectedTotal === total,
      "El total cambió. Revisa tu carrito antes de pagar.",
    );
    requireState(total > 0, "El total debe ser mayor que cero.", 422);
    const created = (
      await d.query<CheckoutResult>(
        `insert into orders(token,request_key,request_hash,status,mode,customer_name,phone,email,address,postcode,delivery_references,notes,subtotal,fee,discount,total,channel,expires_at)
    values($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now()+interval '15 minutes') returning ${fields}`,
        [
          randomBytes(32).toString("base64url"),
          key,
          hash,
          v.mode,
          v.name,
          v.phone,
          v.email,
          v.address ?? "",
          v.postcode ?? "",
          v.references ?? "",
          v.notes ?? "",
          subtotal,
          fee,
          discount,
          total,
          channel,
        ],
      )
    )[0];
    for (const { x, p, c } of lines) {
      const adjusted = (
        await d.query<{ cost: number | null; partial: number }>(
          `select case when $3::boolean and count(*)=count(i.unit_cost) then coalesce(round(sum(ri.base_quantity*i.unit_cost)),0)::int end cost, coalesce(round(sum(ri.base_quantity*i.unit_cost)),0)::int partial
      from recipe_items ri join ingredients i on i.id=ri.ingredient_id where ri.product_id=$1 and not exists(select 1 from product_ingredient_labels l where l.product_id=ri.product_id and l.ingredient_id=ri.ingredient_id and l.label=any($2::text[]))`,
          [p.id, arr(x.removed), c?.cost != null],
        )
      )[0];
      const row = await d.query<{ id: string }>(
        `insert into order_items(order_id,product_id,name,image,unit_price,unit_cost,partial_cost,quantity,removed,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10) returning id`,
        [
          created.id,
          p.id,
          p.name,
          p.image,
          p.price,
          adjusted.cost,
          adjusted.partial,
          x.quantity,
          arr(x.removed),
          x.note,
        ],
      );
      await d.query(
        "insert into order_item_units(item_id,ordinal) select $1,generate_series(1,$2::integer)",
        [row[0].id, x.quantity],
      );
    }
    // Dough flour was charged to the batch when it was mixed.
    const out = await d.query(
      `select 1 from order_items i join product_ingredient_labels l on l.product_id=i.product_id join (${stockSQL}) s on s.id=l.ingredient_id where i.order_id=$1 and l.label=any((select p.ingredients from products p where p.id=i.product_id)::text[]) and not(l.label=any(i.removed)) and s.free<=0 limit 1`,
      [created.id],
    );
    requireState(!out.length, "Un ingrediente de tu pizza está agotado.");
    const needs = await d.query<{ id: string; need: string; enough: boolean }>(
      `select ri.ingredient_id as id,sum(ri.base_quantity*i.quantity) as need,sum(ri.base_quantity*i.quantity)<=s.free as enough from order_items i join recipe_items ri on ri.product_id=i.product_id join (${stockSQL}) s on s.id=ri.ingredient_id where i.order_id=$1 and (not $2::boolean or ri.category<>'masa') and not exists(select 1 from product_ingredient_labels l where l.product_id=i.product_id and l.ingredient_id=ri.ingredient_id and l.label=any(i.removed)) group by ri.ingredient_id,s.free`,
      [created.id, s.limitDough],
    );
    for (const n of needs) {
      requireState(n.enough, "No hay insumos suficientes para este carrito.");
      await d.query(
        "insert into inventory_reservations(order_id,ingredient_id,quantity,status) values($1,$2,$3,'held')",
        [created.id, n.id, n.need],
      );
    }
    if (s.limitDough) {
      let remaining = quantity;
      const batches = await d.query<{ id: string; free: string }>(
        `select id,free from (${doughSQL}) b where free>=1 order by expires_at,id`,
      );
      for (const b of batches) {
        const take = Math.min(remaining, Number(b.free));
        await d.query(
          "insert into inventory_reservations(order_id,batch_id,quantity,status) values($1,$2,$3,'held')",
          [created.id, b.id, take],
        );
        remaining -= take;
        if (!remaining) break;
      }
      requireState(remaining === 0, "Ya no quedan suficientes bolas de masa.");
    }
    await signal(d, "public", "staff");
    return created;
  });
}
export async function orderNotify(
  d: DB,
  s: Settings,
  orderId: string,
  type: string,
  subject: string,
  internal = false,
  suffix = "",
) {
  const r = (
    await d.query<{
      email: string;
      number: number;
      token: string;
      total: number;
      mode: "pickup" | "delivery";
      products: string[];
    }>(
      `select email,number,token,total,mode,array(select quantity::text||' × '||name from order_items where order_id=o.id order by id) products from orders o where o.id=$1`,
      [orderId],
    )
  )[0];
  const { email, ...payload } = r;
  await notify(d, s, {
    key: [type, orderId, suffix].join("/"),
    type,
    to: internal ? s.notificationEmail : email,
    subject,
    orderId,
    payload,
  });
}
const eventSchema = z.object({
  eventId: clean(200),
  paymentId: clean(200),
  orderId: id,
  status: z.enum([
    "approved",
    "pending",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ]),
  amount: money,
  currency: z.string().length(3),
  refunded: money.optional(),
  fee: money.optional(),
  updatedAt: ts,
});
export async function applyPayment(raw: PaymentUpdate) {
  const v = eventSchema.parse(raw);
  requireState((v.refunded ?? 0) <= v.amount, "Reembolso inválido.", 422);
  return (await db()).tx(async (d) => {
    await lock(d);
    await expire(d);
    const o = list(
      await d.query<{
        id: string;
        total: number;
        status: string;
        paid_at: Date | null;
        payment_status: string;
        settled_payment_id: string | null;
      }>(
        `select id,total,status,paid_at,payment_status,settled_payment_id from orders where id=$1 for update`,
        [v.orderId],
      ),
    );
    requireState(o, "Pedido desconocido.", 404);
    const seen = await d.query(
      "insert into payment_events(id,payment_id,order_id,status) values($1,$2,$3,$4) on conflict do nothing returning id",
      [v.eventId, v.paymentId, o.id, v.status],
    );
    if (!seen.length) return { status: o.status, duplicate: true };
    const s = await settings(d);
    const previous = list(
      await d.query<{
        order_id: string;
        status: string;
        updated_at: string;
        refunded: number;
      }>(
        "select order_id,status,updated_at,refunded from payments where id=$1 for update",
        [v.paymentId],
      ),
    );
    if (previous) {
      requireState(
        previous.order_id === o.id,
        "La referencia del pago no coincide.",
      );
      if (
        new Date(previous.updated_at) > new Date(v.updatedAt) ||
        (["refunded", "charged_back"].includes(previous.status) &&
          !["refunded", "charged_back"].includes(v.status)) ||
        (previous.status === "approved" &&
          ["pending", "rejected", "cancelled"].includes(v.status))
      )
        return { status: o.status, stale: true };
    }
    const refunded = Math.max(
      previous?.refunded ?? 0,
      v.refunded ??
        (["refunded", "charged_back"].includes(v.status) ? v.amount : 0),
    );
    const otherPaid =
      o.settled_payment_id !== null && o.settled_payment_id !== v.paymentId;
    await d.query(
      `insert into payments(id,order_id,amount,currency,status,refunded,fee,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set status=excluded.status,refunded=excluded.refunded,fee=coalesce(excluded.fee,payments.fee),updated_at=excluded.updated_at`,
      [
        v.paymentId,
        o.id,
        v.amount,
        v.currency,
        v.status,
        refunded,
        v.fee ?? null,
        v.updatedAt,
      ],
    );
    if (
      v.amount !== o.total ||
      v.currency !== "MXN" ||
      (!o.paid_at && v.status === "approved" && refunded > 0) ||
      (otherPaid && v.status === "approved")
    ) {
      await orderNotify(
        d,
        s,
        o.id,
        "intervention",
        "Pago que requiere revisión",
        true,
        v.paymentId,
      );
      if (!o.paid_at) {
        await d.query(
          "update orders set status='review',payment_status='review',updated_at=now() where id=$1",
          [o.id],
        );
        await release(d, o.id);
      }
      await signal(d, "staff", "public");
      return { status: o.paid_at ? o.status : "review" };
    }
    if (otherPaid) return { status: o.status };
    if (v.status === "approved") {
      if (!o.paid_at) {
        const expiredBatch = list(
          await d.query(
            "select 1 from inventory_reservations r join dough_batches b on b.id=r.batch_id where r.order_id=$1 and (b.expires_at<=now() or b.status<>'ready')",
            [o.id],
          ),
        );
        if (o.status !== "pending" || expiredBatch) {
          await d.query(
            "update orders set status='review',payment_status='approved_review',updated_at=now() where id=$1",
            [o.id],
          );
          await release(d, o.id);
          await orderNotify(
            d,
            s,
            o.id,
            "intervention",
            "Pago recibido después de liberar la reserva",
            true,
            v.paymentId,
          );
          await signal(d, "staff", "public");
          return { status: "review" };
        }
        await d.query(
          "update ingredients i set stock=stock-r.quantity from inventory_reservations r where r.ingredient_id=i.id and r.order_id=$1 and r.status='held'",
          [o.id],
        );
        await d.query(
          "update dough_batches b set remaining=remaining-r.quantity::int from inventory_reservations r where r.batch_id=b.id and r.order_id=$1 and r.status='held'",
          [o.id],
        );
        await d.query(
          `insert into inventory_movements(ingredient_id,batch_id,quantity,type,reason,order_id,reservation_id) select ingredient_id,batch_id,-quantity,'consumption','Pedido pagado',order_id,id from inventory_reservations where order_id=$1 and status='held' on conflict(reservation_id) do nothing`,
          [o.id],
        );
        await d.query(
          "update inventory_reservations set status='consumed' where order_id=$1 and status='held'",
          [o.id],
        );
        await d.query(
          "update orders set status='confirmed',payment_status='approved',settled_payment_id=$2,paid_at=now(),updated_at=now() where id=$1",
          [o.id, v.paymentId],
        );
        await d.query(
          `insert into finance_sales(order_id,date,channel,gross,discount,refund,fee,cost,units,product_sales) select o.id,o.paid_at,o.channel,o.subtotal+o.fee,o.discount,$2,$3,case when count(i.id)=count(i.unit_cost) then sum(i.quantity*i.unit_cost)::integer end,sum(i.quantity)::integer,jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'amount',i.quantity*i.unit_price)) from orders o join order_items i on i.order_id=o.id where o.id=$1 group by o.id on conflict(order_id) do nothing`,
          [o.id, refunded, v.fee ?? null],
        );
        await orderNotify(
          d,
          s,
          o.id,
          "paid_internal",
          "Nuevo pedido pagado",
          true,
        );
        await orderNotify(
          d,
          s,
          o.id,
          "order_confirmed",
          "Tu pedido está confirmado",
        );
        await orderNotify(d, s, o.id, "payment_confirmed", "Recibimos tu pago");
        const low = await d.query<{ id: string; name: string }>(
          "select i.id,i.name from ingredients i join inventory_reservations r on r.ingredient_id=i.id where r.order_id=$1 and i.stock<=i.minimum",
          [o.id],
        );
        for (const i of low)
          await notify(d, s, {
            key: `low_stock/${i.id}/${o.id}`,
            type: "low_stock",
            to: s.notificationEmail,
            subject: "Inventario bajo",
            payload: { detail: i.name },
          });
      }
      await d.query(
        "update finance_sales set refund=greatest(refund,$2),fee=coalesce($3,fee) where order_id=$1",
        [o.id, refunded, v.fee ?? null],
      );
    } else if (v.status === "pending") {
      if (!o.paid_at && o.status === "pending")
        await d.query(
          "update orders set payment_status='pending',updated_at=now() where id=$1",
          [o.id],
        );
    } else {
      await release(d, o.id);
      const terminal = ["refunded", "charged_back"].includes(v.status);
      // Cooked food is never put back into usable stock automatically.
      await d.query(
        "update orders set status='cancelled',payment_status=$2,updated_at=now() where id=$1",
        [o.id, v.status],
      );
      await d.query(
        "update order_item_units u set status='ready',finished_at=now() from order_items i where i.id=u.item_id and i.order_id=$1 and u.status='baking'",
        [o.id],
      );
      if (terminal)
        await d.query(
          "update finance_sales set refund=greatest(refund,$2) where order_id=$1",
          [o.id, refunded],
        );
      await orderNotify(d, s, o.id, "cancelled", "Actualización de tu pedido");
      if (!terminal)
        await orderNotify(
          d,
          s,
          o.id,
          "payment_error",
          "Incidencia de pago",
          true,
          v.paymentId,
        );
    }
    await signal(d, "public", "staff", "kitchen");
    return { status: (await project(d, o.id))!.status };
  });
}
async function release(d: DB, orderId: string) {
  await d.query(
    "update inventory_reservations set status='released' where order_id=$1 and status='held'",
    [orderId],
  );
}
