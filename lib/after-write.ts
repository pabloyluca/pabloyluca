import { after } from "next/server";
import { signal } from "./local-events";
import { deliverNotifications } from "./integrations/notifications";
export function afterWrite(mail = false) {
  signal("public", "staff", "kitchen");
  if (mail)
    after(async () => {
      try {
        await deliverNotifications();
      } catch {
        console.error("[notificaciones] Reintento pendiente");
      }
    });
}
