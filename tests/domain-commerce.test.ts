import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";
import {
  adminData,
  applyPayment,
  checkRateLimit,
  checkout,
  claimNotifications,
  expireReservations,
  finishNotification,
  getMenu,
  kitchenData,
  mutate,
  queueDailySummary,
  tracking,
} from "../lib/domain";
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentUpdate,
} from "../lib/contracts";
process.env.COMMERCE_MODE = "sandbox";
process.env.PABLO_DATA_DIR = "memory://";
const product = "00000000-0000-4000-8001-000000000002";
const pepper = "00000000-0000-4000-8002-000000000003";
const base: CheckoutInput = {
  name: "Cliente de prueba",
  email: "test@example.invalid",
  phone: "9985550000",
  mode: "pickup",
  items: [{ productId: product, quantity: 1, removed: [], note: "" }],
};
const pay = (
  o: CheckoutResult,
  status: PaymentUpdate["status"] = "approved",
  diff: Partial<PaymentUpdate> = {},
): PaymentUpdate => ({
  eventId: randomUUID(),
  paymentId: "sandbox-" + o.id,
  orderId: o.id,
  status,
  amount: o.total,
  currency: "MXN",
  updatedAt: new Date().toISOString(),
  ...diff,
});
const manage = (action: string, payload: unknown) =>
  mutate(action, payload, "ADMIN", "test");
before(async () => {
  await db();
});
after(async () => {
  await (await db()).close();
});
test("seed cerrado, precios de referencia y costos parciales", async () => {
  const m = await getMenu();
  assert.equal(m.products.length, 7);
  assert.equal(m.settings.open, false);
  assert.equal(m.products[1].price, 14900);
  const r = (await adminData()).recipes.find((r) => r.productId === product)!;
  assert.equal(r.partialCost, 2828);
  assert.equal(r.cost, null);
  await assert.rejects(checkout(base, randomUUID()), /cerrada/);
  await manage("settings.save", { open: true, ovenCapacity: 2 });
});
test("tres unidades, pago deduplicado, KDS, snapshots, entrega y correo desacoplado", async () => {
  const data = {
    ...base,
    items: [
      { ...base.items[0], quantity: 2 },
      { ...base.items[0], removed: ["Pepperoni"], note: "Sin cortar" },
    ],
  };
  const key = randomUUID(),
    order = await checkout(data, key);
  assert.equal(order.total, 44700);
  assert.equal(order.status, "pending");
  assert.equal((await checkout(data, key)).id, order.id);
  await assert.rejects(checkout(base, key), /otro carrito/);
  assert.equal((await kitchenData()).orders.length, 0);
  const event = pay(order);
  await applyPayment(event);
  await applyPayment(event);
  await applyPayment({ ...event, eventId: randomUUID() });
  const kitchen = await kitchenData(),
    o = kitchen.orders[0];
  assert.equal(o.units.length, 3);
  assert.equal(o.units.filter((x) => x.note === "Sin cortar").length, 1);
  assert.equal("email" in o, false);
  const ad = await adminData();
  assert.equal(ad.sales.length, 1);
  assert.equal(ad.sales[0].cost, null);
  assert.equal(ad.ingredients.find((x) => x.id === pepper)?.stock, 9900);
  const out = await claimNotifications();
  assert.equal(out.length, 3);
  await finishNotification(out[0].id, "Resend no disponible");
  assert.equal((await kitchenData()).orders.length, 1);
  await mutate("order.accept", { id: o.id }, "KITCHEN");
  const [a, b, c] = o.units;
  await mutate("unit.start", { id: a.id }, "KITCHEN");
  await mutate("unit.start", { id: b.id }, "KITCHEN");
  await assert.rejects(mutate("unit.start", { id: c.id }, "KITCHEN"), /lleno/);
  const before = (await kitchenData()).orders[0].units;
  await mutate("unit.extend", { id: a.id }, "KITCHEN");
  const afterExtend = (await kitchenData()).orders[0].units;
  assert.equal(
    new Date(afterExtend[0].endsAt!).valueOf() -
      new Date(before[0].endsAt!).valueOf(),
    60000,
  );
  assert.equal(afterExtend[1].endsAt, before[1].endsAt);
  await assert.rejects(
    mutate("order.ready", { id: o.id }, "KITCHEN"),
    /pendientes/,
  );
  await mutate("unit.ready", { id: a.id }, "KITCHEN");
  await mutate("unit.start", { id: c.id }, "KITCHEN");
  await (
    await db()
  ).query(
    "update order_item_units set ends_at=now()-interval '1 second' where id=$1",
    [c.id],
  );
  assert.equal(
    (await kitchenData()).orders[0].units.find((x) => x.id === c.id)?.status,
    "baking",
  );
  await mutate("unit.ready", { id: b.id }, "KITCHEN");
  await mutate("unit.ready", { id: c.id }, "KITCHEN");
  await mutate("order.ready", { id: o.id }, "KITCHEN");
  await mutate("order.pickup", { id: o.id }, "KITCHEN");
  assert.equal((await tracking(order.token))?.status, "picked_up");
  assert.equal(await tracking(String(order.number)), null);
  await assert.rejects(mutate("expense.create", {}, "KITCHEN"), /Permisos/);
  const finance = (await adminData()).sales[0];
  await applyPayment(pay(order, "approved", { paymentId: "segundo-cobro" }));
  await applyPayment(pay(order, "refunded", { paymentId: "segundo-cobro" }));
  assert.equal((await adminData()).sales[0].refund, 0);
  await applyPayment(pay(order, "approved", { refunded: 500 }));
  assert.equal((await adminData()).sales[0].refund, 500);
  await applyPayment(pay(order, "refunded"));
  assert.equal((await adminData()).sales[0].refund, finance.gross);
  assert.equal(
    (await adminData()).ingredients.find((x) => x.id === pepper)?.stock,
    9900,
  );
});
test("última unidad, pago tardío, cobro incompatible, rechazo y cierre", async () => {
  await manage("settings.save", { maxActiveUnits: 1 });
  const results = await Promise.allSettled([
    checkout(base, randomUUID()),
    checkout(base, randomUUID()),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const order = (
    results.find(
      (x) => x.status === "fulfilled",
    ) as PromiseFulfilledResult<CheckoutResult>
  ).value;
  await (
    await db()
  ).query(
    "update orders set expires_at=now()-interval '1 minute' where id=$1",
    [order.id],
  );
  assert.equal(await expireReservations(), 1);
  await applyPayment(pay(order));
  assert.equal((await tracking(order.token))?.status, "review");
  assert.equal((await kitchenData()).orders.length, 0);
  const mismatch = await checkout(base, randomUUID());
  await applyPayment(pay(mismatch, "approved", { currency: "USD" }));
  assert.equal((await tracking(mismatch.token))?.status, "review");
  const declined = await checkout(base, randomUUID());
  await applyPayment(pay(declined, "rejected"));
  assert.equal((await tracking(declined.token))?.status, "cancelled");
  await manage("settings.save", { open: false });
  await assert.rejects(checkout(base, randomUUID()), /cerrada/);
  await manage("settings.save", { open: true, maxActiveUnits: 12 });
});
test("costos recalculados; una venta conserva gramajes y precio históricos; agotado", async () => {
  const ad = await adminData(),
    r = ad.recipes.find((r) => r.productId === product)!;
  await assert.rejects(
    manage("recipe.save", { ...r, complete: true }),
    /masa, toppings y empaque/,
  );
  const caja = ad.ingredients.find((i) => i.name === "Cajas")!,
    salsa = ad.ingredients.find((i) => i.name === "Salsa")!,
    harina = ad.ingredients.find((i) => i.name === "Harina Selecta")!;
  await manage("purchase.create", {
    ingredientId: caja.id,
    quantity: 10,
    unit: "pz",
    price: 5000,
  });
  await manage("purchase.create", {
    ingredientId: salsa.id,
    quantity: 1000,
    unit: "ml",
    price: 1000,
  });
  const items = [
    ...r.items,
    { ingredientId: caja.id, quantity: 1, unit: "pz", category: "empaque" },
    { ingredientId: salsa.id, quantity: 20, unit: "ml", category: "salsa" },
    { ingredientId: harina.id, quantity: 100, unit: "g", category: "masa" },
  ];
  await manage("recipe.save", { ...r, items, complete: true });
  const o = await checkout(base, randomUUID());
  await applyPayment(pay(o));
  const sale = (await adminData()).sales.find((x) => x.cost === 3548)!;
  assert.ok(sale);
  const ingredient = (await adminData()).ingredients.find(
    (i) => i.id === pepper,
  )!;
  await manage("ingredient.save", { ...ingredient, purchasePrice: 79400 });
  assert.equal(
    (await adminData()).recipes.find((r) => r.productId === product)?.cost,
    4426,
  );
  const p = ad.products.find((p) => p.id === product)!;
  await manage("product.save", { ...p, price: 16000 });
  assert.equal(
    (await getMenu()).products.find((p) => p.id === product)?.price,
    16000,
  );
  const beforeConflict = (await adminData()).orders.length;
  await assert.rejects(
    checkout({ ...base, expectedTotal: 14900 }, randomUUID()),
    /total cambió/,
  );
  assert.equal((await adminData()).orders.length, beforeConflict);
  assert.equal(
    (await adminData()).sales.find((s) => s.id === sale.id)?.cost,
    3548,
  );
  assert.equal(
    (await adminData()).sales.find((s) => s.id === sale.id)?.gross,
    14900,
  );
  await manage("ingredient.save", {
    ...ingredient,
    purchasePrice: 79400,
    stock: 0,
  });
  assert.equal(
    (await getMenu()).products.find((p) => p.id === product)?.available,
    false,
  );
  await assert.rejects(checkout(base, randomUUID()), /agotado|insumos/);
  await assert.rejects(
    manage("purchase.create", {
      ingredientId: pepper,
      quantity: 1,
      unit: "ml",
      price: 100,
    }),
    /incompatibles/,
  );
  await manage("purchase.create", {
    ingredientId: pepper,
    quantity: 1,
    unit: "kg",
    price: 22000,
  });
  assert.equal(
    (await adminData()).ingredients.find((i) => i.id === pepper)?.stock,
    1000,
  );
});
test("rutas de entrega, promoción verificada, ventas de canal e idempotencia del seed", async () => {
  const zone = await manage("zone.save", {
    name: "Prueba",
    enabled: true,
    postcodes: ["77560"],
    fee: 3000,
  });
  await manage("settings.save", { delivery: true });
  await manage("promotion.save", {
    code: "HORNO10",
    percent: 10,
    enabled: true,
  });
  const input: CheckoutInput = {
    ...base,
    mode: "delivery",
    address: "Calle de prueba",
    postcode: "77560",
    zoneId: zone.id as string,
    promoCode: "horno10",
  };
  await assert.rejects(
    checkout({ ...input, postcode: "99999" }, randomUUID()),
    /cubierto/,
  );
  const luKey = randomUUID();
  const o = await checkout(input, luKey, "whatsapp");
  await assert.rejects(checkout(input, luKey, "store"), /otro carrito/);
  assert.equal(o.total, 17400);
  await applyPayment(pay(o));
  await manage("order.accept", { id: o.id });
  const u = (await kitchenData()).orders.find((x) => x.id === o.id)!.units[0];
  await manage("unit.start", { id: u.id });
  await manage("unit.ready", { id: u.id });
  await manage("order.ready", { id: o.id });
  await manage("order.dispatch", { id: o.id });
  await manage("order.deliver", { id: o.id });
  assert.equal((await tracking(o.token))?.status, "delivered");
  assert.ok(
    (await adminData()).sales.some(
      (s) => s.channel === "whatsapp" && s.gross === 19000,
    ),
  );
  await manage("sale.create", {
    date: "2026-11-25",
    channel: "rappi",
    gross: 10000,
    discount: 0,
    units: 1,
  });
  assert.equal(
    (await adminData()).sales.find((x) => x.channel === "rappi")?.fee,
    3000,
  );
  await queueDailySummary("2026-11-25");
  await queueDailySummary("2026-11-25");
  assert.equal(
    (
      await (
        await db()
      ).query("select id from notification_events where type='daily_summary'")
    ).length,
    1,
  );
  assert.ok(await checkRateLimit("test", 1, 60));
  assert.equal(await checkRateLimit("test", 1, 60), false);
  await manage("recipe.save", {
    productId: product,
    complete: false,
    items: [],
  });
  const seed = await readFile("supabase/seed.sql", "utf8");
  await (await db()).query(seed);
  assert.equal(
    (await adminData()).recipes.find((r) => r.productId === product)?.items
      .length,
    0,
  );
});
test("dos compradores simultáneos reservan una sola última bola; ningún pago tardío la recupera", async () => {
  const d = await db();
  await d.query("update dough_batches set remaining=1 where status='ready'");
  const req = await Promise.allSettled([
    checkout(base, randomUUID()),
    checkout(base, randomUUID()),
  ]);
  assert.equal(req.filter((x) => x.status === "fulfilled").length, 1);
  assert.match(
    String(
      (req.find((x) => x.status === "rejected") as PromiseRejectedResult)
        .reason,
    ),
    /masa/,
  );
  const o = (
    req.find(
      (x) => x.status === "fulfilled",
    ) as PromiseFulfilledResult<CheckoutResult>
  ).value;
  assert.equal((await adminData()).dough[0].held, 1);
  assert.equal(
    (await getMenu()).products.every((p) => !p.available),
    true,
  );
  await d.query(
    "update orders set expires_at=now()-interval '1 minute' where id=$1",
    [o.id],
  );
  const replacement = await checkout(base, randomUUID());
  const late = pay(o);
  await applyPayment(late);
  await applyPayment({ ...late, eventId: randomUUID() });
  assert.equal((await tracking(o.token))?.status, "review");
  await applyPayment(pay(replacement));
  assert.equal((await adminData()).dough[0].remaining, 0);
  assert.equal((await adminData()).dough[0].held, 0);
  assert.equal((await adminData()).dough[0].used! > 0, true);
});
test("horno configura un solo espacio; duplicación y archivo respetan ventas históricas; compra de harina produce un lote", async () => {
  const d = await db();
  const catalog = (await adminData()).products;
  const copy = await manage("product.duplicate", { id: product });
  assert.ok(copy.id);
  await manage("product.up", { id: copy.id });
  await manage("product.archive", { id: copy.id });
  assert.equal(
    (await getMenu()).products.some((p) => p.id === copy.id),
    false,
  );
  const now = new Date(),
    end = new Date(now.valueOf() + 2 * 86400000);
  const batch = await manage("dough.save", {
    preparedAt: now.toISOString(),
    flour: 500,
    hydration: 65,
    yeast: 3,
    salt: 10,
    ballWeight: 250,
    balls: 3,
    fermentStart: now.toISOString(),
    fermentHours: 24,
    expiresAt: end.toISOString(),
    status: "fermenting",
  });
  await manage("dough.status", { id: batch.id, status: "ready" });
  let ad = await adminData();
  assert.equal(ad.dough.find((b) => b.id === batch.id)?.remaining, 3);
  await manage("dough.status", { id: batch.id, status: "waste" });
  ad = await adminData();
  assert.equal(ad.dough.find((b) => b.id === batch.id)?.waste, 3);
  assert.ok(
    (
      await d.query(
        "select 1 from audit_logs where actor='test' and action='dough.status' limit 1",
      )
    ).length,
  );
});
