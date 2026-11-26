import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AdminData, Menu } from "../lib/contracts";

test("fotografía del CMS y pedido mixto de queso desde móvil hasta cocina", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw Error("Usar el sandbox local.");
  const owner = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 960 },
  });
  const kitchen = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
  });
  const admin = await owner.newPage();
  const chef = await kitchen.newPage();
  await owner.request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_OWNER_EMAIL!,
      password: process.env.SANDBOX_OWNER_PASSWORD!,
    },
    maxRedirects: 0,
  });
  await kitchen.request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_KITCHEN_EMAIL!,
      password: process.env.SANDBOX_KITCHEN_PASSWORD!,
    },
    maxRedirects: 0,
  });
  const data: AdminData = await (await owner.request.get("/api/admin")).json();
  const change = async (action: string, payload: object) => {
    const res = await owner.request.post("/api/ops", {
      data: { action, payload },
    });
    expect(res.ok(), await res.text()).toBe(true);
  };
  try {
    // Exercise the authenticated storage endpoint and product association for all seven photos.
    for (const p of data.products.filter((p) => !p.archived)) {
      const bytes = await readFile(join("public", p.image));
      const uploaded = await owner.request.post("/api/upload", {
        multipart: {
          kind: "product",
          file: {
            name: p.image.split("/").at(-1)!,
            mimeType: "image/webp",
            buffer: bytes,
          },
        },
      });
      expect(uploaded.status()).toBe(201);
      const { url } = await uploaded.json();
      await change("product.save", { ...p, image: url });
      const media = await page.request.get(url);
      expect((await media.body()).equals(bytes)).toBe(true);
    }
    await change("settings.save", { open: false, pickup: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".pl-product")).toHaveCount(7);
    await expect(page.getByText("VEGANA", { exact: true })).toBeVisible();
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.locator(".pl-product").last().scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        await Promise.all(
          [
            ...document.querySelectorAll<HTMLImageElement>(".pl-product img"),
          ].map((i) => i.decode()),
        );
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath("store-" + name + ".png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    await admin.goto("/admin");
    await admin.getByRole("link", { name: "Tienda / CMS" }).click();
    await admin
      .getByRole("button", { name: "Editar Bosco Vegana", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toBeVisible();
    await admin.screenshot({ path: test.info().outputPath("cms-bosco.png") });
    await admin
      .getByRole("dialog")
      .getByLabel("Precio de venta (MXN)")
      .fill("190");
    await admin.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    const menu: Menu = await (await page.request.get("/api/menu")).json();
    const bosco = menu.products.find((p) => p.slug === "bosco-vegana")!;
    expect(bosco.price).toBe(19000);
    await change("product.save", { ...bosco, price: 18900 });
    await admin
      .getByRole("link", { name: "Recetas y costos", exact: true })
      .click();
    const recipePanel = admin
      .locator(".op-panel")
      .filter({
        has: admin.getByRole("heading", { name: "Bosco Vegana", exact: true }),
      });
    await recipePanel.getByRole("button", { name: "Editar receta" }).click();
    await expect(
      admin.getByRole("dialog").getByRole("heading", { name: /Bosco Vegana/ }),
    ).toBeVisible();
    await admin.screenshot({
      path: test.info().outputPath("receta-bosco.png"),
    });
    await change("settings.save", { open: true });
    await page.reload();
    await chef.goto("/kitchen");
    for (const [name, vegan] of [
      ["Margherita", false],
      ["Margherita", true],
      ["Bosco Vegana", false],
    ] as const) {
      await page
        .getByRole("button", { name: "Personalizar " + name, exact: true })
        .click();
      const d = page.getByRole("dialog");
      if (vegan) await d.getByRole("radio", { name: /Queso vegano/ }).check();
      if (name === "Bosco Vegana")
        await expect(d.getByRole("radio")).toHaveCount(0);
      await d.getByRole("button", { name: /Agregar al carrito/ }).click();
    }
    await page.reload();
    await page.locator(".pl-float-cart").click();
    await expect(page.locator(".pl-cart-lines li")).toHaveCount(3);
    await expect(page.locator(".pl-total dd")).toContainText("$502");
    await page.screenshot({ path: test.info().outputPath("carrito.png") });
    await page.getByRole("button", { name: /Continuar a entrega/ }).click();
    await page.getByText(/Ver pizzas y personalizaciones/).click();
    await expect(page.locator(".pl-checkout-items img")).toHaveCount(3);
    await page.getByLabel("Nombre", { exact: true }).fill("Prueba de catálogo");
    await page.getByLabel("Teléfono", { exact: true }).fill("9985550101");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("qa@example.test");
    await page
      .getByRole("button", { name: "Continuar al pago de prueba" })
      .click();
    await page.getByRole("button", { name: "Aprobar pago de prueba" }).click();
    await expect(
      chef.getByText("QUESO VEGANO — NO USAR MOZZARELLA", { exact: true }),
    ).toBeVisible();
    await expect(chef.getByText("QUESO VEGANO", { exact: true })).toBeVisible();
    await chef.screenshot({
      path: test.info().outputPath("kds-quesos.png"),
      fullPage: true,
    });
  } finally {
    await change("settings.save", {
      open: data.settings.open,
      pickup: data.settings.pickup,
    });
    for (const p of data.products.filter((p) => !p.archived))
      await change("product.save", p);
    await owner.close();
    await kitchen.close();
  }
});
