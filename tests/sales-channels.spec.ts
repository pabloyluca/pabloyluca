import { expect, test } from "@playwright/test";
import {
  defaultDirect,
  defaultPlatform,
  platformIds,
} from "../lib/sales-channels";
import type { AdminData, Menu } from "../lib/contracts";

test("el CMS persiste y publica canales independientes de la cocina", async ({
  browser,
  page,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw Error("Se requiere el sandbox local.");
  const admin = await browser.newContext({ baseURL });
  const staff = await admin.newPage();
  await admin.request.post("/api/auth/login", {
    form: {
      email: process.env.SANDBOX_OWNER_EMAIL!,
      password: process.env.SANDBOX_OWNER_PASSWORD!,
    },
  });
  const before: AdminData = await (
    await admin.request.get("/api/admin")
  ).json();
  const platform = (id: string) => before.channels.find((c) => c.id === id);
  const original = {
    direct: { ...defaultDirect, ...platform("store")?.presentation },
    delivery: before.settings.delivery,
    platforms: platformIds.map((id) => ({
      id,
      card: { ...defaultPlatform(id), ...platform(id)?.presentation },
      prices: platform(id)?.productPrices ?? {},
    })),
  };
  const edit = (action: string, payload: object) =>
    admin.request.post("/api/ops", { data: { action, payload } });
  try {
    await staff.goto("/admin");
    await staff.getByRole("link", { name: "Tienda / CMS" }).click();
    const selectTab = () =>
      staff.getByRole("button", { name: "Canales de venta" }).click();
    await selectTab();
    const didi = staff
      .locator("section.op-panel")
      .filter({ has: staff.getByRole("heading", { name: "DiDi Food" }) });
    const uber = staff
      .locator("section.op-panel")
      .filter({ has: staff.getByRole("heading", { name: "Uber Eats" }) });
    await staff.getByLabel("Texto promocional").fill("Prueba de publicación");
    await staff.getByLabel("Ahorro anunciado (%)").fill("22");
    await didi.getByLabel("Mostrar tarjeta").uncheck();
    await uber
      .getByLabel("URL de la sucursal")
      .fill("https://example.test/sucursal-de-prueba");
    await uber.getByLabel("Aceptar pedidos en la plataforma").check();
    await uber.getByRole("button", { name: "Subir Uber Eats" }).click();
    await staff.getByRole("button", { name: "Guardar canales" }).click();
    await expect(staff.getByText("Canales guardados.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Prueba de publicación")).toBeVisible();
    await expect(page.locator("#direct-heading strong")).toHaveText("22%");
    await expect(page.locator(".pl-partner")).toHaveCount(2);
    await expect(
      page.locator(".pl-partner").first().getByRole("link"),
    ).toHaveAttribute("href", "https://example.test/sucursal-de-prueba");
    await page.locator(".pl-direct-action a").click();
    await expect(page.locator("#pl-menu-title")).toBeFocused();
    await staff.reload();
    await staff.getByRole("link", { name: "Tienda / CMS" }).click();
    await selectTab();
    await expect(staff.getByLabel("Texto promocional")).toHaveValue(
      "Prueba de publicación",
    );
    await expect(didi.getByLabel("Mostrar tarjeta")).not.toBeChecked();
    await uber.getByLabel("Aceptar pedidos en la plataforma").uncheck();
    await staff.getByLabel("Mostrar porcentaje").uncheck();
    await staff.getByRole("button", { name: "Guardar canales" }).click();
    await expect(staff.getByText("Canales guardados.")).toBeVisible();
    expect((await edit("settings.save", { open: true })).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator(".pl-direct-action a")).toHaveText(
      "Ordenar ahora",
    );
    await expect(page.locator(".pl-partner-uber")).toContainText(
      "Próximamente",
    );
    await expect(page.locator("#direct-heading strong")).toHaveCount(0);
    const menu: Menu = await (await page.request.get("/api/menu")).json();
    expect(menu.products.map((p) => p.price)).toEqual(
      before.products.filter((p) => !p.archived).map((p) => p.price),
    );
  } finally {
    await edit("channel.presentation", original);
    await edit("settings.save", { open: before.settings.open });
    await admin.close();
  }
});
