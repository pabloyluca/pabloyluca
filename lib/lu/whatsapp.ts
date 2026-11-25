import "server-only";
// Fase posterior. The app exposes no delivery route and never calls Meta in V1.
export type ConversationWindow = {
  consentedAt: string | null;
  lastCustomerMessageAt: string | null;
};
export function prepareWhatsAppReply(
  to: string,
  text: string,
  window: ConversationWindow,
  now = Date.now(),
) {
  const consent = Date.parse(window.consentedAt || ""),
    last = Date.parse(window.lastCustomerMessageAt || "");
  if (
    !Number.isFinite(consent) ||
    consent > now ||
    !Number.isFinite(last) ||
    last > now ||
    now - last >= 24 * 3600000
  )
    throw new Error(
      "Se requiere consentimiento y una ventana abierta, o una plantilla autorizada.",
    );
  if (!/^\d{8,15}$/.test(to) || !text.trim() || text.length > 4096)
    throw new Error("Respuesta inválida.");
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  };
}
export interface WhatsAppTransport {
  send(
    payload: ReturnType<typeof prepareWhatsAppReply>,
  ): Promise<{ id: string }>;
}
export function cloudApiTransport(
  config: { graphVersion: string; phoneId: string; token: string },
  request: typeof fetch,
): WhatsAppTransport {
  if (!/^v\d+\.\d+$/.test(config.graphVersion) || !/^\d+$/.test(config.phoneId))
    throw new Error("Configuración de WhatsApp inválida.");
  return {
    async send(payload) {
      const r = await request(
        "https://graph.facebook.com/" +
          config.graphVersion +
          "/" +
          config.phoneId +
          "/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!r.ok) throw new Error("Meta no aceptó el mensaje.");
      const data = await r.json();
      const id = data.messages?.[0]?.id;
      if (typeof id !== "string")
        throw new Error("Meta devolvió una respuesta sin ID.");
      return { id };
    },
  };
}
