import "server-only";
import type { Notification } from "../contracts";
import { claimNotifications, finishNotification } from "../domain";
import { db } from "../db";
import { isSandbox } from "../mode";
import { emailTemplate } from "./email-template";
export async function deliverNotifications() {
  const sandbox = isSandbox(),
    key = process.env.RESEND_API_KEY,
    from = process.env.RESEND_FROM;
  if (
    !sandbox &&
    (!key ||
      !from ||
      process.env.ENABLE_TRANSACTIONAL_MAIL !== "true" ||
      /@(?:proton\.me|protonmail\.com)\b/i.test(from))
  )
    return { processed: 0, configured: false };
  const pending = await claimNotifications(10);
  let delivered = 0;
  for (const n of pending) {
    if (sandbox) {
      await finishNotification(n.id, undefined, "skipped");
      continue;
    }
    try {
      if (
        Date.now() - Date.parse(n.createdAt) > 23.5 * 3600000 &&
        n.attempts > 1
      ) {
        await (
          await db()
        ).query(
          "update notification_events set state='failed',last_error='Revisar antes de reenviar: venció la ventana de idempotencia' where id=$1",
          [n.id],
        );
        continue;
      }
      const template = emailTemplate(n, new URL(process.env.APP_URL!).origin);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "Idempotency-Key": "pl/" + n.id,
        },
        body: JSON.stringify({
          from,
          to: [n.to],
          subject: n.subject,
          ...template,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("Resend HTTP " + response.status);
      await finishNotification(n.id);
      delivered++;
    } catch (e) {
      await finishNotification(
        n.id,
        e instanceof Error ? e.message.slice(0, 140) : "Error de transporte",
      );
    }
  }
  return { processed: pending.length, delivered, simulated: sandbox };
}
