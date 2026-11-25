import "server-only";
import { isSandbox } from "../mode";
import { drainOutbox, resendSender } from "./mail-worker";
export async function deliverNotifications() {
  if (isSandbox()) return drainOutbox(null);
  const key = process.env.RESEND_API_KEY,
    from = process.env.RESEND_FROM,
    origin = process.env.APP_URL;
  if (
    !key ||
    !from ||
    !origin ||
    process.env.ENABLE_TRANSACTIONAL_MAIL !== "true" ||
    /@(?:proton\.me|protonmail\.com)\b/i.test(from)
  )
    return { processed: 0, configured: false };
  return drainOutbox(
    resendSender({ key, from, origin: new URL(origin).origin }),
  );
}
