"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderStatus, Tracking } from "@/lib/contracts";
import { ArrowLeft, Check, ChefHat, Clock3, MapPin, Truck } from "lucide-react";
import { Live } from "@/components/Live";
import { CART_KEY, requestJson, statusNames } from "./utils";

export function TrackingView({ token }: { token: string }) {
  const [order, setOrder] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const version = useRef(0);
  const refresh = useCallback(() => {
    const current = ++version.current;
    requestJson<Tracking>("/api/track/" + encodeURIComponent(token))
      .then((result) => {
        if (current !== version.current) return;
        setOrder(result);
        setError("");
        if (result.paymentStatus === "approved") {
          try {
            const purchase = JSON.parse(
              sessionStorage.getItem("pl:submitted-cart") || "null",
            );
            if (purchase?.token === token) {
              if (localStorage.getItem(CART_KEY) === purchase.cart)
                localStorage.removeItem(CART_KEY);
              sessionStorage.removeItem("pl:submitted-cart");
              sessionStorage.removeItem("pl:pending-checkout");
            }
          } catch {
            /* Tracking works without browser storage. */
          }
        }
      })
      .catch((e) => {
        if (current === version.current)
          setError(
            e instanceof Error ? e.message : "No encontramos el pedido.",
          );
      });
  }, [token]);
  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    const restored = () => setOnline(true);
    const lost = () => setOnline(false);
    window.addEventListener("online", restored);
    window.addEventListener("offline", lost);
    window.addEventListener("pl:change", refresh);
    return () => {
      window.removeEventListener("online", restored);
      window.removeEventListener("offline", lost);
      window.removeEventListener("pl:change", refresh);
    };
  }, [refresh]);
  const steps: OrderStatus[] = [
    "confirmed",
    "preparing",
    "baking",
    "ready",
    ...(order?.mode === "delivery"
      ? (["dispatched", "delivered"] as OrderStatus[])
      : (["picked_up"] as OrderStatus[])),
  ];
  const current = order ? steps.indexOf(order.status) : -1;
  return (
    <main className="pl-store pl-track">
      <Live audience="public" />
      <header>
        <a href="/">
          <img src="/media/logo-transparente.webp" alt="Pablo & Luca" />
        </a>
      </header>
      <section className="pl-track-card">
        <a className="pl-back" href="/">
          <ArrowLeft size={16} />
          Volver al menú
        </a>
        <h1>Tu pedido</h1>
        {!online && (
          <p className="pl-note">
            Sin conexión. El estado se actualizará cuando vuelvas a conectarte.
          </p>
        )}
        {error && (
          <p className="pl-danger" role="alert">
            {error}
          </p>
        )}
        {!order && !error && <p role="status">Consultando el pedido…</p>}
        {order && (
          <>
            <div className="pl-track-id">
              <span>Pedido #{String(order.number).padStart(4, "0")}</span>
              <strong>{statusNames[order.status]}</strong>
            </div>
            <p className="pl-track-mode">
              {order.mode === "pickup" ? (
                <MapPin size={18} />
              ) : (
                <Truck size={18} />
              )}{" "}
              {order.mode === "pickup"
                ? "Recolección en cocina"
                : "Entrega a domicilio"}
            </p>
            {order.status === "pending" && (
              <p className="pl-note">
                <Clock3 size={16} />{" "}
                {order.paymentStatus === "rejected"
                  ? "El proveedor rechazó el pago."
                  : "En espera de confirmación del proveedor de pago."}
              </p>
            )}
            {order.status === "review" || order.status === "cancelled" ? (
              <p className="pl-note">
                {order.status === "review"
                  ? "La cocina está revisando una incidencia con el pedido."
                  : "El pedido ha sido cancelado."}
              </p>
            ) : (
              <ol className="pl-track-steps">
                {steps.map((step, i) => (
                  <li
                    key={step}
                    className={i <= current ? "done" : ""}
                    aria-current={i === current ? "step" : undefined}
                  >
                    <i>
                      {i < current ? (
                        <Check size={16} />
                      ) : i === current ? (
                        <ChefHat size={16} />
                      ) : null}
                    </i>
                    {statusNames[step]}
                  </li>
                ))}
              </ol>
            )}
            <small>
              Última actualización ·{" "}
              {new Intl.DateTimeFormat("es-MX", {
                timeZone: "America/Cancun",
                hour: "2-digit",
                minute: "2-digit",
                month: "short",
                day: "numeric",
              }).format(new Date(order.updatedAt))}
            </small>
          </>
        )}
        <button
          className="pl-primary pl-wide"
          type="button"
          disabled={!online}
          onClick={refresh}
        >
          Actualizar estado
        </button>
      </section>
    </main>
  );
}
