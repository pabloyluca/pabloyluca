import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ javaScriptEnabled: false, userAgent: "Twitterbot/1.0" });

test("la portada entrega una tarjeta social única en el HTML inicial", async ({ page, request }) => {
  const origin = "https://www.pabloyluca.com/";
  const image = new URL("branding/og-pabloyluca.jpg", origin).href;
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const head = page.locator("head");
  const title = "Pablo & Luca | Pizza Artesanal en Cancún";
  const description = "Pizza artesanal de masa de fermentación lenta, ingredientes frescos y horneada al momento. Ordena directo o encuéntranos en Rappi. Cancún · Huayacán.";
  await expect(head.locator("title")).toHaveText(title);
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", origin);
  const tags = {
    description,
    robots: "noindex, nofollow",
    "og:title": title,
    "og:description": description,
    "og:image": image,
    "og:image:secure_url": image,
    "og:image:type": "image/jpeg",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:url": origin,
    "og:type": "website",
    "og:locale": "es_MX",
    "og:site_name": "Pablo & Luca",
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image,
  };
  for (const [key, content] of Object.entries(tags)) {
    const attribute = key.startsWith("og:") ? "property" : "name";
    const tag = head.locator(`meta[${attribute}="${key}"]`);
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveAttribute("content", content);
  }
  await expect(head.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Margherita/);
  const jpeg = await request.get(new URL(image).pathname, { maxRedirects: 0 });
  expect(jpeg.status()).toBe(200);
  expect(jpeg.headers()["content-type"]).toContain("image/jpeg");
  expect((await jpeg.body()).equals(await readFile("public/branding/og-pabloyluca.jpg"))).toBe(true);
});
