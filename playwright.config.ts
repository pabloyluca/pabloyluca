import { defineConfig } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const baseURL = "http://127.0.0.1:3218";
const chrome =
  process.env.PLAYWRIGHT_CHANNEL ??
  (existsSync("/Applications/Google Chrome.app") ? "chrome" : undefined);
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  expect: { timeout: 12000 },
  reporter: "list",
  use: {
    baseURL,
    channel: chrome,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3218",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      COMMERCE_MODE: "sandbox",
      APP_URL: baseURL,
      PABLO_DATA_DIR: "memory://",
      PABLO_UPLOAD_DIR: mkdtempSync(join(tmpdir(), "pl-e2e-uploads-")),
    },
  },
});
