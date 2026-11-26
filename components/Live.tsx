"use client";
import { useEffect } from "react";
export function Live({
  audience,
}: {
  audience: "public" | "staff" | "kitchen";
}) {
  useEffect(() => {
    let active = true,
      close = () => {},
      retry: ReturnType<typeof setTimeout> | undefined;
    const notify = () => window.dispatchEvent(new Event("pl:change"));
    const status = (connected: boolean) =>
      window.dispatchEvent(
        new CustomEvent("pl:connection", { detail: { connected } }),
      );
    const connect = async () => {
      clearTimeout(retry);
      close();
      close = () => {};
      try {
        const response = await fetch("/api/live?topic=" + audience, {
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const cfg = await response.json();
        if (!active || cfg.mode === "visual" || cfg.mode === "static") return;
        if (cfg.mode === "local") {
          const es = new EventSource("/api/events?topic=" + audience);
          es.addEventListener("ready", () => {
            status(true);
            notify();
          });
          es.onmessage = notify;
          es.onerror = () => status(false);
          close = () => es.close();
          return;
        }
        const { createClient } = await import("@supabase/supabase-js");
        if (!active) return;
        const sb = createClient(cfg.url, cfg.key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        if (cfg.token) await sb.realtime.setAuth(cfg.token);
        if (!active) return;
        const channel = sb
          .channel("pl-signals-" + audience)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: cfg.schema === "pl_preview" ? "pl_preview" : "public",
              table: "store_signals",
              filter: "topic=eq." + audience,
            },
            notify,
          );
        close = () => {
          void sb.removeChannel(channel);
        };
        channel.subscribe((s) => {
          if (!active) return;
          if (s === "SUBSCRIBED") {
            status(true);
            notify();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            status(false);
            clearTimeout(retry);
            retry = setTimeout(connect, 6000);
          }
        });
        if (cfg.token) {
          const exp = JSON.parse(
            atob(cfg.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          ).exp;
          retry = setTimeout(
            connect,
            Math.max(15000, exp * 1000 - Date.now() - 60000),
          );
        }
      } catch {
        if (active) {
          status(false);
          retry = setTimeout(connect, 6000);
        }
      }
    };
    const focus = () => {
      if (document.visibilityState === "visible") notify();
    };
    const offline = () => status(false);
    void connect();
    window.addEventListener("online", notify);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", focus);
    return () => {
      active = false;
      clearTimeout(retry);
      close();
      window.removeEventListener("online", notify);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [audience]);
  return null;
}
export default Live;
