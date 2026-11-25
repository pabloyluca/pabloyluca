import type { Notification } from "../contracts";
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailTemplate(n: Notification, origin: string) {
  const p = n.payload,
    brand = "Pablo & Luca";
  const total = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });
  const details = [
    p.number ? "Pedido #" + p.number : "",
    ...(p.products ?? []),
    p.total !== undefined
      ? "Total " + total.format(p.total / 100) + " MXN"
      : "",
    p.mode ? (p.mode === "pickup" ? "Recolección" : "Entrega a domicilio") : "",
    p.detail ?? "",
  ].filter(Boolean);
  const link = p.token
    ? origin + "/seguimiento/" + encodeURIComponent(p.token)
    : null;
  return {
    text: [brand, n.subject, ...details, link].filter(Boolean).join("\n"),
    html:
      '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><body style="background:#faf4e8;color:#173b29;font-family:Arial,sans-serif;padding:18px"><main style="max-width:520px;margin:auto;background:#fffdf7;padding:24px;border:1px solid #d7d0bc;border-radius:16px"><img src="' +
      esc(origin) +
      '/media/logo-original.webp" width="150" alt="Pablo &amp; Luca"><h1 style="font:28px Georgia,serif">' +
      esc(n.subject) +
      "</h1>" +
      details.map((d) => "<p>" + esc(d) + "</p>").join("") +
      (link
        ? '<p><a style="background:#123e29;color:white;padding:12px 16px;display:inline-block;border-radius:8px" href="' +
          esc(link) +
          '">Seguir mi pedido</a></p>'
        : "") +
      "</main></body></html>",
  };
}
