import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validSignature } from "../lib/integrations/signature";
import { readVerifiedPayment } from "../lib/integrations/mp-protocol";
import { emailTemplate } from "../lib/integrations/email-template";
import { discountAmount } from "../lib/price";
import { isSandbox } from "../lib/mode";
const secret = "test-webhook-secret",
  ts = "1795644000",
  requestId = "qa-delivery";
const signature = (id: string) =>
  createHmac("sha256", secret)
    .update("id:" + id + ";request-id:" + requestId + ";ts:" + ts + ";")
    .digest("hex");
const header = "ts=" + ts + ",v1=" + signature("123");
const request = new Request(
  "https://test.invalid/api/webhooks/mercadopago?type=payment&data.id=123",
  {
    headers: { "x-signature": header, "x-request-id": requestId },
    method: "POST",
    body: JSON.stringify({ status: "approved", amount: 1 }),
  },
);
const cfg = { secret, collector: "456", token: "fixture", prod: false };
const base = {
  id: 123,
  collector_id: 456,
  live_mode: false,
  external_reference: "00000000-0000-4000-8000-000000000001",
  status: "pending",
  date_last_updated: "2026-11-25T15:00:00Z",
  transaction_amount: 149.99,
  currency_id: "MXN",
  fee_details: [{ fee_payer: "collector", amount: 3.99 }],
};
test("HMAC vincula ID y entrega con la clave del comercio", () => {
  assert.ok(validSignature({ header, requestId, dataId: "123", secret }));
  assert.equal(
    validSignature({ header, requestId, dataId: "124", secret }),
    false,
  );
  assert.equal(
    validSignature({ header, requestId: "otro", dataId: "123", secret }),
    false,
  );
});
test("el webhook consulta al proveedor y reconoce una liquidación parcial sin confiar en el cuerpo", async () => {
  const fetcher = (async (url, init) => {
    assert.equal(url, "https://api.mercadopago.com/v1/payments/123");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer fixture",
    );
    return Response.json({
      ...base,
      status: "approved",
      transaction_amount_refunded: 19.98,
    });
  }) as typeof fetch;
  const result = await readVerifiedPayment(request, cfg, fetcher);
  assert.equal(result?.amount, 14999);
  assert.equal(result?.fee, 399);
  assert.equal(result?.refunded, 1998);
  const pending = await readVerifiedPayment(request, cfg, async () =>
    Response.json(base),
  );
  assert.equal(pending?.status, "pending");
});
test("se valida el titular, el entorno y el importe de una reversión completa", async () => {
  for (const change of [{ collector_id: 789 }, { live_mode: true }])
    await assert.rejects(
      readVerifiedPayment(request, cfg, async () =>
        Response.json({ ...base, ...change }),
      ),
      /ajeno/,
    );
  const r = await readVerifiedPayment(request, cfg, async () =>
    Response.json({ ...base, status: "charged_back" }),
  );
  assert.equal(r?.refunded, 14999);
});
test("plantilla responsiva escapa notas y contiene el enlace privado", () => {
  const template = emailTemplate(
    {
      id: "id",
      to: "qa@example.test",
      type: "paid",
      orderId: "id",
      createdAt: "",
      attempts: 1,
      subject: "Pedido confirmado",
      payload: {
        number: 13,
        token: "token-de-prueba",
        products: ["1 × Tonno <em>"],
        mode: "pickup",
        total: 19900,
      },
    },
    "https://test.invalid",
  );
  assert.match(template.html, /&lt;em&gt;/);
  assert.match(template.html, /seguimiento\/token-de-prueba/);
  assert.match(template.text, /199.00/);
});
test("descuento por puntos base redondea una vez", () => {
  assert.equal(discountAmount(10005, 10), 1001);
  assert.equal(discountAmount(19999, 7.25), 1450);
});
test("un despliegue no puede activar la base local", () => {
  const env = { ...process.env };
  try {
    process.env.VERCEL = "1";
    process.env.COMMERCE_MODE = "sandbox";
    assert.throws(isSandbox);
  } finally {
    delete process.env.VERCEL;
    Object.assign(process.env, env);
  }
});

test("un aviso firmado y consultado confirma una sola venta; el correo fallido se reintenta sin detener cocina", async () => {
  process.env.COMMERCE_MODE = "sandbox";
  process.env.PABLO_DATA_DIR = "memory://";
  const { db } = await import("../lib/db");
  const { getMenu, mutate, checkout, applyPayment, kitchenData, adminData } =
    await import("../lib/domain");
  const { drainOutbox, resendSender } =
    await import("../lib/integrations/mail-worker");
  try {
    await mutate("settings.save", { open: true }, "OWNER");
    const [pizza] = (await getMenu()).products;
    const order = await checkout(
      {
        items: [
          { productId: pizza.id, quantity: 1, removed: [], note: "Prueba" },
        ],
        mode: "pickup",
        name: "Prueba",
        email: "cliente@example.invalid",
        phone: "9980000000",
      },
      crypto.randomUUID(),
    );
    const payment = await readVerifiedPayment(request, cfg, async () =>
      Response.json({
        ...base,
        status: "approved",
        external_reference: order.id,
        transaction_amount: order.total / 100,
      }),
    );
    assert.ok(payment);
    await applyPayment(payment);
    await applyPayment(payment);
    const mail = {
      key: "fixture",
      from: "Pablo & Luca <avisos@example.invalid>",
      origin: "https://test.invalid",
    };
    const firstKeys: string[] = [],
      retryKeys: string[] = [];
    await drainOutbox(
      resendSender(mail, async (_url, init) => {
        firstKeys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        return new Response(null, { status: 503 });
      }),
    );
    assert.equal((await kitchenData()).orders.length, 1);
    assert.equal((await adminData()).sales.length, 1);
    assert.equal(firstKeys.length, 3);
    const d = await db();
    assert.equal(
      (
        await d.query<{ n: number }>(
          "select count(*)::int n from notification_events where state='pending' and attempts=1",
        )
      )[0].n,
      3,
    );
    assert.equal(
      (await drainOutbox(async () => assert.fail("espera antes de reintentar")))
        .processed,
      0,
    );
    await d.query("update notification_events set available_at=now()");
    const result = await drainOutbox(
      resendSender(mail, async (url, init) => {
        assert.equal(url, "https://api.resend.com/emails");
        const headers = new Headers(init?.headers);
        retryKeys.push(headers.get("Idempotency-Key")!);
        assert.match(JSON.parse(String(init?.body)).html, /Pablo/);
        return Response.json({ id: "fixture" });
      }),
    );
    assert.equal(result.delivered, 3);
    assert.deepEqual(firstKeys.sort(), retryKeys.sort());
    assert.equal((await drainOutbox(null)).processed, 0);
  } finally {
    await (await db()).close();
  }
});
