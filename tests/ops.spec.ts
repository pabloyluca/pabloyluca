import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { AdminData } from "../lib/contracts";

test("el CMS edita precios y el ERP recalcula costos de receta desde el insumo", async ({
  page,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw Error("La prueba requiere el sandbox local.");
  const login = await page.request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_OWNER_EMAIL!,
      password: process.env.SANDBOX_OWNER_PASSWORD!,
    },
    maxRedirects: 0,
  });
  expect(login.headers().location).toContain("/admin");
  const read = async (): Promise<AdminData> =>
    (await page.request.get("/api/admin")).json();
  const before = await read();
  const pepper = before.products.find((p) => p.name === "Pepperoni")!,
    cheese = before.ingredients.find((i) => i.name === "Mozzarella")!;
  const costBefore = before.recipes.find(
    (r) => r.productId === pepper.id,
  )!.partialCost;
  const write = async (action: string, payload: object) =>
    page.request.post("/api/ops", { data: { action, payload } });
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Pulso del Negocio" }),
    ).toBeVisible();
    await expect(
      page.getByText("Costo de producción", { exact: true }),
    ).toBeVisible();
    await mkdir("docs/qa", { recursive: true });
    await page.screenshot({ path: "docs/qa/erp-desktop.png" });
    await page.getByRole("link", { name: "Tienda / CMS" }).click();
    await page
      .getByRole("button", { name: "Editar Pepperoni", exact: true })
      .click();
    const editor = page.getByRole("dialog");
    await expect(
      editor.getByRole("heading", { name: "Editar pizza", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "docs/qa/cms-drawer-desktop.png" });
    await editor
      .getByLabel("Precio de venta (MXN)")
      .fill(String(pepper.price / 100 + 1));
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(editor).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await read()).products.find((p) => p.id === pepper.id)?.price,
      )
      .toBe(pepper.price + 100);
    await page.getByRole("link", { name: "Inventario", exact: true }).click();
    const resource = page.locator(".op-panel").filter({
      has: page.getByRole("heading", { name: "Mozzarella", exact: true }),
    });
    await resource
      .getByRole("button", { name: "Editar insumo", exact: true })
      .click();
    await editor
      .getByLabel("Precio de compra (MXN)")
      .fill(String((cheese.purchasePrice + 10000) / 100));
    await editor.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await read()).recipes.find((r) => r.productId === pepper.id)!
            .partialCost,
      )
      .toBeGreaterThan(costBefore);
    await page.getByRole("link", { name: "Reportes", exact: true }).click();
    const report = await page.request.get(
      (await page
        .getByRole("link", { name: "Exportar CSV" })
        .getAttribute("href")) || "",
    );
    expect(report.headers()["content-type"]).toContain("text/csv");
    expect(await report.text()).toContain("Costo de producción");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin?section=recipes");
    await expect(
      page.getByRole("button", { name: "Simulador de rentabilidad" }),
    ).toBeVisible();
    await page.screenshot({ path: "docs/qa/recipes-tablet.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin?section=cms");
    await expect(
      page.getByRole("button", { name: "Nueva pizza" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "docs/qa/cms-mobile.png" });
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await page.getByRole("link", { name: "Configuración" }).click();
    await expect(
      page.getByRole("heading", { name: "Horno y capacidad" }),
    ).toBeVisible();
    await page.goto("/kitchen");
    await expect(page.getByRole("heading", { name: /Nuevos/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: "docs/qa/kds-desktop.png" });
  } finally {
    await write("product.save", pepper);
    await write("ingredient.save", cheese);
  }
});

test("al vencer el reloj, la pizza conserva su estado hasta la confirmación del operador", async ({
  page,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw Error("La prueba requiere el sandbox local.");
  const login = await page.request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_KITCHEN_EMAIL!,
      password: process.env.SANDBOX_KITCHEN_PASSWORD!,
    },
    maxRedirects: 0,
  });
  expect(login.headers().location).toContain("/kitchen");
  const time = new Date("2026-11-25T18:00:00.000Z");
  await page.clock.install({ time });
  const calls: string[] = [];
  let ready = false;
  // Controla únicamente la hora y el snapshot operacional para comprobar el aviso de vencimiento.
  await page.route("**/api/kitchen", (route) =>
    route.fulfill({
      json: {
        settings: {
          open: true,
          ovenMinutes: 9,
          ovenCapacity: 1,
          temperature: 250,
        },
        orders: [
          {
            id: "ticket",
            number: 42,
            status: "baking",
            mode: "pickup",
            paymentStatus: "approved",
            paidAt: time.toISOString(),
            units: [
              {
                id: "unit",
                name: "Margherita",
                removed: [],
                note: "",
                status: ready ? "ready" : "baking",
                startedAt: new Date(time.getTime() - 8 * 60_000).toISOString(),
                endsAt: new Date(time.getTime() + 70_000).toISOString(),
              },
            ],
          },
        ],
      },
    }),
  );
  await page.route("**/api/ops", (route) => {
    const action = route.request().postDataJSON().action;
    calls.push(action);
    if (action === "unit.ready") ready = true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const root = document.documentElement;
      root.dataset.testToneCount = String(
        Number(root.dataset.testToneCount ?? 0) + 1,
      );
      return original.call(this);
    };
  });
  await page.goto("/kitchen");
  await page.getByRole("button", { name: "Habilitar sonido" }).click();
  const toneCount = () =>
    page.evaluate(() =>
      Number(document.documentElement.dataset.testToneCount ?? 0),
    );
  const initial = await toneCount();
  await page.clock.fastForward(16_000);
  await expect(page.locator(".kds-unit.last")).toBeVisible();
  await page.clock.fastForward(60_000);
  const unit = page.locator(".kds-unit.expired");
  await expect(unit.getByRole("timer")).toHaveText("00:00");
  await expect(unit.getByRole("status")).toContainText("Tiempo terminado");
  await expect.poll(toneCount).toBe(initial + 3);
  await page.clock.fastForward(30_000);
  expect(await toneCount()).toBe(initial + 3);
  expect(calls).toEqual([]);
  await unit.getByRole("button", { name: "Marcar lista" }).click();
  await expect(
    page.getByRole("button", { name: "Pedido listo" }),
  ).toBeVisible();
  expect(calls).toEqual(["unit.ready"]);
});
