import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
const envFile = new URL("../.env.local", import.meta.url);
try {
  await access(envFile);
  console.log("Ya existe .env.local. Se conserva la configuración actual.");
} catch {
  const secret = () => randomBytes(24).toString("base64url");
  await writeFile(
    envFile,
    [
      "COMMERCE_MODE=sandbox",
      "APP_URL=http://127.0.0.1:3217",
      "SANDBOX_OWNER_EMAIL=owner@pablo.test",
      `SANDBOX_OWNER_PASSWORD=${secret()}`,
      "SANDBOX_KITCHEN_EMAIL=kitchen@pablo.test",
      `SANDBOX_KITCHEN_PASSWORD=${secret()}`,
      `SANDBOX_SESSION_SECRET=${secret()}`,
      `CRON_SECRET=${secret()}`,
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Sandbox preparado. Las credenciales de administración y cocina están en .env.local.",
  );
}
