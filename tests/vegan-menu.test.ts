import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import {
  adminData,
  getMenu,
  mutate,
  checkout,
  applyPayment,
  kitchenData,
} from "../lib/domain";
import type { CartLine, CheckoutInput } from "../lib/contracts";

process.env.COMMERCE_MODE = "sandbox";
process.env.PABLO_DATA_DIR = "memory://";
after(async () => (await db()).close());
const manage = (action: string, payload: unknown) =>
  mutate(action, payload, "ADMIN", "qa");
const buy = (items: CartLine[], promoCode?: string) =>
  checkout(
    {
      name: "QA de cocina",
      phone: "9985550101",
      email: "qa@example.invalid",
      mode: "pickup",
      items,
      promoCode,
    } satisfies CheckoutInput,
    randomUUID(),
  );

test("Bosco, cambio de queso y Tonno conservan precios, existencias e historial por unidad", async () => {
  const ad = await adminData();
  const [mar, , , , salmone, tonno, bosco] = ad.products;
  const plant = ad.ingredients.find((i) => i.cheeseRole === "vegan")!;
  const mozzarella = ad.ingredients.find((i) => i.cheeseRole === "base")!;
  const tuna = ad.ingredients.find((i) => i.referencePrice === 12900)!;
  const recipeCost = async (id: string) =>
    (await adminData()).recipes.find((r) => r.productId === id)?.cost;
  assert.equal(ad.products.length, 7);
  assert.equal(bosco.dietVerified, true);
  assert.equal(bosco.price, 18900);
  assert.equal(await recipeCost(bosco.id), 6668);
  assert.equal(await recipeCost(tonno.id), 7958);
  assert.equal(tonno.price, 19900);
  assert.equal(plant.unitCost, 20);
  assert.equal(130 * (plant.unitCost! - mozzarella.unitCost!), 650);
  for (const channel of ad.channels.filter((c) =>
    ["uber", "didi", "rappi"].includes(c.id),
  )) {
    const price = channel.productPrices![bosco.id];
    assert.equal(price, 21900);
    assert.equal(price - (price * channel.commission!) / 100 - 6668, 8662);
  }
  await manage("settings.save", { open: true });
  const plain = { productId: mar.id, note: "", removed: [], quantity: 1 };
  const swap: CartLine = { ...plain, cheese: "vegan" };
  await assert.rejects(buy([{ ...swap, productId: salmone.id }]));
  await assert.rejects(buy([{ ...swap, productId: bosco.id }]));
  await assert.rejects(buy([{ ...swap, removed: ["Mozzarella"] }]));
  await manage("promotion.save", {
    code: "PIZZA10",
    percent: 10,
    enabled: true,
  });
  const order = await buy(
    [plain, swap, { ...plain, productId: bosco.id }],
    "PIZZA10",
  );
  assert.equal(order.total, 45180);
  await applyPayment({
    eventId: randomUUID(),
    paymentId: order.id,
    orderId: order.id,
    status: "approved",
    amount: order.total,
    currency: "MXN",
    updatedAt: new Date().toISOString(),
  });
  const after = await adminData();
  assert.equal(
    after.ingredients.find((i) => i.id === mozzarella.id)?.stock,
    mozzarella.stock - 130,
  );
  assert.equal(
    after.ingredients.find((i) => i.id === plant.id)?.stock,
    plant.stock - 260,
  );
  const units = (await kitchenData()).orders.find(
    (o) => o.id === order.id,
  )!.units;
  assert.deepEqual(units.map((u) => u.cheese ?? "base").sort(), [
    "base",
    "native",
    "swap",
  ]);
  assert.equal(units.find((u) => u.cheese === "swap")?.cheeseSupplement, 1500);
  assert.equal(units.find((u) => u.cheese === "native")?.cheeseSupplement, 0);
  await manage("ingredient.save", { ...tuna, purchasePrice: 12900 });
  assert.equal(await recipeCost(tonno.id), 8858);
  assert.equal(
    (await getMenu()).products.find((p) => p.id === tonno.id)?.price,
    19900,
  );
  await manage("settings.save", { veganSurcharge: 2500 });
  await manage("ingredient.save", { ...plant, stock: 0 });
  const menu = await getMenu();
  assert.equal(menu.products[0].standardAvailable, true);
  assert.equal(menu.products[0].veganAvailable, false);
  assert.equal(menu.products[6].available, false);
  await assert.rejects(buy([swap]));
  const snapshots = await (
    await db()
  ).query<{ unit_price: number; cheese_supplement: number }>(
    "select unit_price,cheese_supplement from order_items where order_id=$1 order by unit_price",
    [order.id],
  );
  assert.deepEqual(
    snapshots.map((s) => [s.unit_price, s.cheese_supplement]),
    [
      [14900, 0],
      [16400, 1500],
      [18900, 0],
    ],
  );
});
