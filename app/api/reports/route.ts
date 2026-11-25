import { api, staff, managers } from "@/lib/http";
import { adminData } from "@/lib/domain";
const day = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const GET = api(async (req) => {
  await staff(managers);
  const query = new URL(req.url).searchParams,
    from = query.get("from"),
    to = query.get("to"),
    channel = query.get("channel");
  const { sales, expenses } = await adminData();
  const match = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const money = (n: number | null) => (n === null ? "" : (n / 100).toFixed(2));
  const rows = [
    [
      "Tipo",
      "Fecha Cancún",
      "Canal o categoría",
      "Referencia",
      "Importe MXN",
      "Descuento",
      "Reembolso",
      "Comisión",
      "Costo de producción",
      "Pizzas",
    ],
  ];
  for (const s of sales) {
    const date = day(s.date);
    if (match(date) && (!channel || channel === "all" || channel === s.channel))
      rows.push([
        "Venta",
        date,
        s.channel,
        s.id,
        money(s.gross),
        money(s.discount),
        money(s.refund),
        money(s.fee),
        money(s.cost),
        String(s.units),
      ]);
  }
  if (!channel || channel === "all")
    for (const e of expenses)
      if (match(e.date))
        rows.push([
          "Egreso",
          e.date,
          e.category,
          e.name,
          money(e.amount),
          "",
          "",
          "",
          "",
          "",
        ]);
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            (/^[=+@\-\t\r]/.test(v) ? "'" : "") +
            v.replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pablo-luca-finanzas.csv"',
      "Cache-Control": "private, no-store",
    },
  });
});
