import { db } from "../db";
import type { Notification } from "../contracts";
import { notify, settings } from "./common";
export { DomainError } from "./common";
export {
  getMenu,
  checkout,
  applyPayment,
  tracking,
  getOrderForPayment,
  getPendingByToken,
  expireReservations,
} from "./commerce";
export { adminData, kitchenData, mutate, staffRole } from "./staff";

/** A limited maintenance pass also expires leases. A failed send never rolls back a paid order. */
export async function claimNotifications(limit = 20): Promise<Notification[]> {
  const d = await db();
  return d.tx(async (tx) => {
    await tx.query(
      "update notification_events set state='failed',last_error='Ventana de reintentos agotada' where state in ('pending','leased') and (attempts>=5 or (attempts>0 and created_at<now()-interval '23 hours')) and coalesce(lease_until,now())<=now()",
    );
    return tx.query<Notification>(
      `with todo as (select id from notification_events where ((state='pending' and available_at<=now()) or (state='leased' and lease_until<=now())) and attempts<5 order by available_at,id limit $1 for update skip locked)
   update notification_events n set state='leased',attempts=attempts+1,lease_until=now()+interval '5 minutes' from todo where n.id=todo.id returning n.id,n.type,n.recipient as "to",n.subject,n.order_id as "orderId",n.payload,n.attempts,n.created_at as "createdAt"`,
      [Math.min(100, Math.max(1, Math.floor(limit)))],
    );
  });
}
export async function finishNotification(
  id: string,
  error?: string,
  state?: "skipped",
) {
  await (
    await db()
  ).query(
    `update notification_events set state=case when $3::boolean then 'skipped' when $2::text is null then 'sent' when attempts>=5 or created_at<now()-interval '23 hours' then 'failed' else 'pending' end,available_at=now()+interval '1 minute'*power(3,least(attempts,5)),lease_until=null,last_error=$2 where id=$1 and state='leased'`,
    [id, error?.slice(0, 240) ?? null, state === "skipped"],
  );
}
export async function queueDailySummary(date?: string) {
  const d = await db();
  return d.tx(async (tx) => {
    const r = (
      await tx.query<{ day: string; amount: number; units: number }>(
        `with x as (select coalesce($1::date,(now() at time zone 'America/Cancun')::date-1) as period_day) select x.period_day::text as "day",coalesce(sum(s.gross-s.discount-s.refund),0)::int amount,coalesce(sum(s.units),0)::int units from x left join finance_sales s on s.date>=x.period_day::timestamp at time zone 'America/Cancun' and s.date<(x.period_day+1)::timestamp at time zone 'America/Cancun' group by x.period_day`,
        [date ?? null],
      )
    )[0];
    const s = await settings(tx);
    await notify(tx, s, {
      key: "daily_summary/" + r.day,
      type: "daily_summary",
      to: s.notificationEmail,
      subject: "Resumen de ventas · " + r.day,
      payload: {
        detail:
          r.units + " pizzas · Ventas netas MXN " + (r.amount / 100).toFixed(2),
      },
    });
    return r;
  });
}
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const d = await db();
  return d.tx(async (tx) => {
    await tx.query(
      "delete from rate_limits where expires_at<=now() and key in(select key from rate_limits where expires_at<=now() limit 40)",
    );
    const row = await tx.query<{ hits: number }>(
      `insert into rate_limits(key,hits,expires_at) values($1,1,now()+$2::int*interval '1 second') on conflict(key) do update set hits=case when rate_limits.expires_at<=now() then 1 else rate_limits.hits+1 end,expires_at=case when rate_limits.expires_at<=now() then excluded.expires_at else rate_limits.expires_at end returning hits`,
      [key, windowSeconds],
    );
    return row[0].hits <= limit;
  });
}
