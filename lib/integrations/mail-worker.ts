import type { Notification } from "../contracts";
import { claimNotifications, finishNotification } from "../domain";
import { emailTemplate } from "./email-template";

type Send = (notification: Notification) => Promise<void>;
export function resendSender(
  config: { key: string; from: string; origin: string },
  request: typeof fetch = fetch,
): Send {
  return async (n) => {
    const response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.key,
        "Content-Type": "application/json",
        "Idempotency-Key": "pl/" + n.id,
      },
      body: JSON.stringify({
        from: config.from,
        to: [n.to],
        subject: n.subject,
        ...emailTemplate(n, config.origin),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Resend HTTP " + response.status);
  };
}
export async function drainOutbox(send: Send | null) {
  const pending = await claimNotifications(10);
  let delivered = 0;
  for (const n of pending) {
    if (!send) {
      await finishNotification(n.id, undefined, "skipped");
      continue;
    }
    try {
      await send(n);
      await finishNotification(n.id);
      delivered++;
    } catch (e) {
      await finishNotification(
        n.id,
        e instanceof Error ? e.message.slice(0, 140) : "Error de transporte",
      );
    }
  }
  return { processed: pending.length, delivered, simulated: !send };
}
