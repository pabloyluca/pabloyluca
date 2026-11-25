import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("autorización, archivos, configuración de instalación y reportes", async ({
  browser,
  request,
  baseURL,
}) => {
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect((await request.get("/api/kitchen")).status()).toBe(401);
  expect((await request.get("/api/jobs")).status()).toBe(401);
  expect((await request.get("/api/track/1")).status()).toBe(404);
  expect(
    (await request.get("/instalar/kitchen")).headers()["content-type"],
  ).toContain("manifest");
  expect(
    (await (await request.get("/instalar/kitchen")).json()).start_url,
  ).toBe("/kitchen");
  const ctx = await browser.newContext({ baseURL });
  try {
    const owner = ctx.request;
    await owner.post("/api/auth/login", {
      form: {
        email: process.env.SANDBOX_OWNER_EMAIL!,
        password: process.env.SANDBOX_OWNER_PASSWORD!,
      },
      maxRedirects: 0,
    });
    const res = await owner.post("/api/upload", {
      multipart: {
        kind: "receipt",
        file: {
          name: "qa.png",
          mimeType: "image/png",
          buffer: await readFile("public/icon-192.png"),
        },
      },
    });
    expect(res.status()).toBe(201);
    const { url } = await res.json();
    expect((await owner.get(url)).status()).toBe(200);
    expect((await request.get(url)).status()).toBe(401);
    const csv = await owner.get("/api/reports");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("Costo de producción");
    await owner.post("/api/auth/logout", { maxRedirects: 0 });
    expect((await owner.get("/api/admin")).status()).toBe(401);
    await owner.post("/api/auth/login", {
      form: {
        email: process.env.SANDBOX_KITCHEN_EMAIL!,
        password: process.env.SANDBOX_KITCHEN_PASSWORD!,
      },
      maxRedirects: 0,
    });
    for (const endpoint of ["/api/reports", url, "/api/admin"])
      expect((await owner.get(endpoint)).status()).toBe(403);
  } finally {
    await ctx.close();
  }
});
