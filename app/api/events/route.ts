import { api, staff, managers, allStaff, HttpError } from "@/lib/http";
import { events } from "@/lib/local-events";
import { isSandbox } from "@/lib/mode";
export const GET = api(async (req) => {
  if (!isSandbox()) throw new HttpError(404, "Ruta desconocida.");
  const topic = new URL(req.url).searchParams.get("topic") || "public";
  if (topic !== "public")
    await staff(topic === "kitchen" ? allStaff : managers);
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };
      const change = () => write("data: cambio\n\n");
      const heartbeat = setInterval(() => write(": conectado\n\n"), 25000);
      cleanup = () => {
        clearInterval(heartbeat);
        events().off(topic, change);
        req.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {}
      };
      events().on(topic, change);
      req.signal.addEventListener("abort", cleanup, { once: true });
      write("retry: 3000\nevent: ready\ndata: ok\n\n");
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
