"use client";
import { useEffect, useState } from "react";
export function InstallShell() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const change = () => setOffline(!navigator.onLine);
    change();
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  return offline ? (
    <div
      role="alert"
      style={{
        position: "fixed",
        inset: "auto 0 0",
        background: "#892f25",
        color: "#fff",
        padding: 8,
        textAlign: "center",
        zIndex: 9900,
      }}
    >
      Sin conexión · Reconecta para actualizar pedidos
    </div>
  ) : null;
}
