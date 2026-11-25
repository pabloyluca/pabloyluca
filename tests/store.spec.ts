import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { AdminData, KitchenData, Menu } from "../lib/contracts";

test("un pago sandbox crea tres unidades y conserva sus cronómetros y personalización", async ({
  browser,
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw Error(
      "El recorrido de cobro requiere la instancia sandbox local de QA.",
    );
  await page.goto("/");
  await expect(page.getByText("Sandbox · pedidos de prueba")).toBeVisible();
  const owner = await request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_OWNER_EMAIL!,
      password: process.env.SANDBOX_OWNER_PASSWORD!,
    },
    maxRedirects: 0,
  });
  expect(owner.headers().location).toContain("/admin");
  const initial = (await (await request.get("/api/admin")).json()) as AdminData;
  const settings = initial.settings;
  const configure = (payload: object) =>
    request.post("/api/ops", { data: { action: "settings.save", payload } });
  const kitchen = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 840 },
  });
  try {
    expect(
      (await configure({ open: true, pickup: true, ovenCapacity: 3 })).ok(),
    ).toBeTruthy();
    await expect(
      page.getByText("Estamos horneando", { exact: true }),
    ).toBeVisible();
    const chef = await kitchen.newPage();
    const staff = await kitchen.request.post("/api/auth/login", {
      form: {
        email: process.env.SANDBOX_KITCHEN_EMAIL!,
        password: process.env.SANDBOX_KITCHEN_PASSWORD!,
      },
      maxRedirects: 0,
    });
    expect(staff.headers().location).toContain("/kitchen");
    expect((await kitchen.request.get("/api/admin")).status()).toBe(403);
    await kitchen.addInitScript(() => {
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        document.documentElement.dataset.testOscillators = String(
          Number(document.documentElement.dataset.testOscillators ?? 0) + 1,
        );
        return original.call(this);
      };
    });
    await chef.goto("/kitchen");
    await expect(chef.getByRole("heading", { name: /Nuevos/ })).toBeVisible();
    await chef.getByRole("button", { name: "Habilitar sonido" }).click();
    await expect(
      chef.getByRole("button", { name: "Sonido activo" }),
    ).toBeVisible();
    const tonesBefore = Number(
      await chef.locator("html").getAttribute("data-test-oscillators"),
    );
    await page
      .getByRole("button", { name: "Personalizar Pepperoni", exact: true })
      .click();
    let sheet = page.getByRole("dialog");
    await sheet
      .getByRole("button", { name: "Añadir una Pepperoni", exact: true })
      .click();
    await sheet.getByRole("button", { name: /Agregar al carrito/ }).click();
    await page
      .getByRole("button", { name: "Personalizar Tonno", exact: true })
      .click();
    sheet = page.getByRole("dialog");
    await sheet.getByLabel("Tomates cherry", { exact: true }).check();
    await sheet
      .getByLabel("Instrucciones especiales")
      .fill("Cortar en ocho rebanadas");
    await sheet.getByRole("button", { name: /Agregar al carrito/ }).click();
    await page.reload();
    await page
      .getByRole("button", { name: "Carrito (3)", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Sin Tomates cherry"),
    ).toBeVisible();
    // Replay an older catalog snapshot in the client while the server keeps its current price.
    await page.route("**/api/menu", async (route) => {
      const response = await route.fetch();
      const oldMenu = (await response.json()) as Menu;
      const stalePizza = oldMenu.products.find((p) => p.name === "Tonno")!;
      stalePizza.price -= 100;
      await route.fulfill({ response, json: oldMenu });
    });
    await page.evaluate(() => window.dispatchEvent(new Event("pl:change")));
    await expect(page.locator(".pl-total dd")).toContainText("$496");
    await page.unroute("**/api/menu");
    await page.getByRole("button", { name: /Continuar a entrega/ }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Prueba Cocina");
    await page.getByLabel("Teléfono", { exact: true }).fill("9985550101");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("prueba@example.test");
    await page
      .getByRole("button", { name: "Continuar al pago de prueba" })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "El total cambió",
    );
    await expect(page.locator(".pl-total dd")).toContainText("$497");
    await page
      .getByRole("button", { name: "Continuar al pago de prueba" })
      .click();
    await expect(page).toHaveURL(/\/sandbox\/pago\//);
    const token = new URL(page.url()).pathname.split("/").at(-1)!;
    const pending = await (await request.get("/api/track/" + token)).json();
    expect(pending.status).toBe("pending");
    expect(pending.mode).toBe("pickup");
    const number = "#" + String(pending.number).padStart(4, "0");
    const order = chef.locator("article.kds-order").filter({
      has: chef.getByRole("heading", { name: number, exact: true }),
    });
    await expect(order).toHaveCount(0);
    await page.getByRole("button", { name: "Aprobar pago de prueba" }).click();
    await expect(page).toHaveURL(/\/seguimiento\//);
    await expect(order.getByText("Sin Tomates cherry")).toBeVisible();
    await expect(order.getByText("Cortar en ocho rebanadas")).toBeVisible();
    await expect
      .poll(async () =>
        Number(
          await chef.locator("html").getAttribute("data-test-oscillators"),
        ),
      )
      .toBeGreaterThan(tonesBefore);
    await order.getByRole("button", { name: "Aceptar y preparar" }).click();
    for (let i = 1; i <= 3; i++) {
      await order
        .getByRole("button", { name: /Iniciar horneado de/ })
        .first()
        .click();
      await expect(order.getByRole("timer")).toHaveCount(i);
    }
    const readUnits = async () => {
      const data = (await (
        await kitchen.request.get("/api/kitchen")
      ).json()) as KitchenData;
      return data.orders.find((o) => o.number === pending.number)!.units;
    };
    const before = await readUnits();
    expect(new Set(before.map((u) => u.id)).size).toBe(3);
    expect(new Set(before.map((u) => u.startedAt)).size).toBe(3);
    await chef.reload();
    await expect(order.getByRole("timer")).toHaveCount(3);
    expect((await readUnits()).map((u) => u.endsAt)).toEqual(
      before.map((u) => u.endsAt),
    );
    await order
      .getByRole("button", { name: "+1 min", exact: true })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          Date.parse((await readUnits())[0].endsAt!) -
          Date.parse(before[0].endsAt!),
      )
      .toBe(60000);
    expect((await readUnits()).slice(1).map((u) => u.endsAt)).toEqual(
      before.slice(1).map((u) => u.endsAt),
    );
    await chef.screenshot({
      path: test.info().outputPath("kds-active.png"),
      fullPage: true,
      animations: "disabled",
    });
    await kitchen.setOffline(true);
    await expect(chef.getByRole("main").getByRole("alert")).toContainText(
      "Sin conexión",
    );
    await expect(
      order.getByRole("button", { name: "Marcar lista" }).first(),
    ).toBeDisabled();
    await kitchen.setOffline(false);
    for (let i = 2; i >= 0; i--) {
      await order.getByRole("button", { name: "Marcar lista" }).first().click();
      await expect(order.getByRole("timer")).toHaveCount(i);
    }
    await order
      .getByRole("button", { name: "Pedido listo", exact: true })
      .click();
    await expect(page.locator(".pl-track-id strong")).toHaveText("Listo");
    await order.getByRole("button", { name: "Marcar recogido" }).click();
    await expect(page.locator(".pl-track-id strong")).toHaveText("Recogido");
    const finalAdmin = (await (
      await request.get("/api/admin")
    ).json()) as AdminData;
    expect(finalAdmin.sales.length).toBe(initial.sales.length + 1);
    expect(
      finalAdmin.sales.find((s) => s.units === 3 && s.gross === 49700),
    ).toBeTruthy();
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Carrito (0)", exact: true }),
    ).toBeVisible();
  } finally {
    await kitchen.close();
    await configure({
      open: settings.open,
      pickup: settings.pickup,
      ovenCapacity: settings.ovenCapacity,
    });
  }
});

test("móvil conserva la personalización, permite editar y muestra la cobertura configurada", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Nuestro Menú" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images]
        .filter(
          (img) =>
            img.loading !== "lazy" ||
            img.getBoundingClientRect().top < innerHeight,
        )
        .map((img) => img.decode()),
    );
  });
  const transfer = await page.evaluate(() => {
    const entries = [
      ...performance.getEntriesByType("navigation"),
      ...performance.getEntriesByType("resource"),
    ] as PerformanceResourceTiming[];
    const bytes = entries.reduce((sum, r) => sum + r.transferSize, 0);
    return {
      width: innerWidth,
      requests: entries.length,
      transferBytes: bytes,
      imageBytes: entries
        .filter((r) => r.initiatorType === "img")
        .reduce((sum, r) => sum + r.transferSize, 0),
    };
  });
  const file = test.info().outputPath("mobile-first-load.json");
  await writeFile(file, JSON.stringify(transfer, null, 2));
  await test.info().attach("mobile-first-load.json", {
    path: file,
    contentType: "application/json",
  });
  console.log("Carga de tienda móvil compilada", JSON.stringify(transfer));
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zona de entrega" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Zona de entrega" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Personalizar Margherita", exact: true })
    .click();
  await page.getByLabel("Tomate", { exact: true }).check();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.locator(".pl-float-cart").click();
  await page.getByRole("button", { name: "Editar Margherita" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Añadir una Margherita" })
    .click();
  await page.getByRole("button", { name: /Guardar cambios/ }).click();
  await expect(page.getByText("2 × Margherita")).toBeVisible();
  await page.getByRole("button", { name: "Eliminar Margherita" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu carrito está vacío" }),
  ).toBeVisible();
});

test("un pago rechazado conserva la selección y libera el intento para repetirlo", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByText("Sandbox · pedidos de prueba")).toBeVisible();
  await request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_OWNER_EMAIL!,
      password: process.env.SANDBOX_OWNER_PASSWORD!,
    },
    maxRedirects: 0,
  });
  const staff = (await (await request.get("/api/admin")).json()) as AdminData;
  const configure = (open: boolean) =>
    request.post("/api/ops", {
      data: { action: "settings.save", payload: { open, pickup: true } },
    });
  try {
    expect((await configure(true)).ok()).toBeTruthy();
    const menu = (await (await request.get("/api/menu")).json()) as Menu;
    const item = menu.products.find((p) => p.available)!;
    const cart = [{ productId: item.id, quantity: 1, removed: [], note: "" }];
    const key = crypto.randomUUID();
    const response = await page.request.post("/api/checkout", {
      data: {
        name: "Pago rechazado",
        phone: "9985550102",
        email: "rechazo@example.test",
        mode: "pickup",
        expectedTotal: item.price,
        items: cart,
      },
      headers: { "Idempotency-Key": key },
    });
    expect(response.status()).toBe(201);
    const order = await response.json();
    await page.evaluate(
      ({ cart, token, key }) => {
        const serial = JSON.stringify(cart);
        localStorage.setItem("pablo-luca.cart.v1", serial);
        sessionStorage.setItem(
          "pl:submitted-cart",
          JSON.stringify({ token, cart: serial }),
        );
        sessionStorage.setItem("pl:pending-checkout", JSON.stringify({ key }));
      },
      { cart, token: order.token, key },
    );
    await page.goto(order.paymentUrl);
    await page.getByRole("button", { name: "Simular rechazo" }).click();
    await expect(page.getByText(/El proveedor rechazó el pago/)).toBeVisible();
    expect(
      await page.evaluate(() => sessionStorage.getItem("pl:pending-checkout")),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("pablo-luca.cart.v1")!),
      ),
    ).toEqual(cart);
    await page.getByRole("link", { name: "Volver al menú" }).click();
    await expect(
      page.getByRole("button", { name: "Carrito (1)", exact: true }),
    ).toBeVisible();
  } finally {
    await request.post("/api/ops", {
      data: {
        action: "settings.save",
        payload: { open: staff.settings.open, pickup: staff.settings.pickup },
      },
    });
  }
});
