"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type { AdminData, FinanceSale, OrderStatus } from "@/lib/contracts";

export const money = (value: number | null) =>
  value == null
    ? "Pendiente"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: value % 100 ? 2 : 0,
        minimumFractionDigits: value % 100 ? 2 : 0,
      }).format(value / 100);
export const formatNum = (value: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value);
export const orderNo = (value: number) => "#" + String(value).padStart(4, "0");
export const titles: Record<OrderStatus, string> = {
  pending: "Pendiente de pago",
  confirmed: "Confirmado",
  preparing: "Preparando",
  baking: "En el horno",
  ready: "Listo",
  dispatched: "En camino",
  delivered: "Entregado",
  picked_up: "Recogido",
  cancelled: "Cancelado",
  review: "Requiere revisión",
};
export const activeStatuses: OrderStatus[] = [
  "confirmed",
  "preparing",
  "baking",
  "ready",
  "dispatched",
];
const dateMx = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Cancun",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (date: string | Date = new Date()) =>
  typeof date === "string" && /^\d{4}-\d\d-\d\d$/.test(date)
    ? date
    : dateMx.format(typeof date === "string" ? new Date(date) : date);
export const localStamp = (date: string) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Cancun",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const amount = (value: FormDataEntryValue | null) =>
  Math.round(Number(value) * 100);
export const strings = (value: string) => [
  ...new Set(
    value
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];

export type Mutate = (action: string, payload: object) => Promise<boolean>;
export function useOps<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [live, setLive] = useState<boolean | null>(null);
  const active = useRef(false);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const version = ++seq.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok)
        throw Error(
          response.status === 401
            ? "La sesión expiró. Vuelve a iniciar sesión."
            : "No se pudo actualizar la información.",
        );
      const result: T = await response.json();
      if (version === seq.current) {
        setData(result);
        setIssue("");
      }
      return true;
    } catch (error) {
      if (version === seq.current)
        setIssue(
          error instanceof Error ? error.message : "Conexión interrumpida.",
        );
      return false;
    }
  }, [endpoint]);
  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void reload();
    };
    updateOnline();
    const refresh = () => {
      void reload();
    };
    const connection = (event: Event) =>
      setLive((event as CustomEvent<{ connected: boolean }>).detail.connected);
    window.addEventListener("pl:connection", connection);
    window.addEventListener("pl:change", refresh);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      seq.current++;
      window.removeEventListener("pl:connection", connection);
      window.removeEventListener("pl:change", refresh);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [reload]);
  const mutate: Mutate = async (action, payload) => {
    if (active.current || !navigator.onLine) return false;
    active.current = true;
    setBusy(true);
    setIssue("");
    try {
      const response = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(
          typeof error.error === "string"
            ? error.error
            : "No se pudo guardar el cambio.",
        );
      }
      await reload();
      return true;
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "No se pudo conectar.");
      return false;
    } finally {
      active.current = false;
      setBusy(false);
    }
  };
  return { data, issue, busy, online, live, reload, mutate, setIssue };
}
export async function upload(file: File, kind: "product" | "receipt") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const result = await res.json();
  if (!res.ok || typeof result.url !== "string")
    throw Error(
      typeof result.error === "string"
        ? result.error
        : "No se pudo subir el archivo.",
    );
  return result.url as string;
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"op-field" + (wide ? " wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"op-panel " + className}>
      <div className="op-panel-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="op-empty">{children}</p>;
}
export function Save({
  busy,
  label = "Guardar cambios",
}: {
  busy?: boolean;
  label?: string;
}) {
  return (
    <button className="op-primary" type="submit" disabled={busy}>
      {busy ? (
        <LoaderCircle size={17} className="op-spin" />
      ) : (
        <Check size={17} />
      )}{" "}
      {label}
    </button>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      className="op-drawer"
      aria-label={title}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="op-drawer-title">
        <h2>{title}</h2>
        <button
          className="op-icon"
          aria-label="Cerrar editor"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export type Range = { from: string; to: string; channel: string };
export function periodSales(data: AdminData, range: Range) {
  return data.sales.filter(
    (s) =>
      dayKey(s.date) >= range.from &&
      dayKey(s.date) <= range.to &&
      (!range.channel || s.channel === range.channel),
  );
}
export const sum = (
  sales: FinanceSale[],
  field: "gross" | "discount" | "refund" | "fee" | "cost" | "units",
) => sales.reduce((v, s) => v + (s[field] ?? 0), 0);
export const knownSum = (sales: FinanceSale[], field: "fee" | "cost") =>
  sales.some((s) => s[field] == null) ? null : sum(sales, field);
export function DateFilters({
  range,
  onChange,
  channels,
}: {
  range: Range;
  onChange: (range: Range) => void;
  channels?: AdminData["channels"];
}) {
  const today = dayKey();
  const [custom, setCustom] = useState(false);
  return (
    <div className="op-filters">
      {[1, 7, 28, 90].map((days) => (
        <button
          type="button"
          key={days}
          className={
            !custom &&
            range.from === addDays(today, 1 - days) &&
            range.to === today
              ? "selected"
              : ""
          }
          onClick={() => {
            setCustom(false);
            onChange({ ...range, from: addDays(today, 1 - days), to: today });
          }}
        >
          {days === 1 ? "Hoy" : days + " días"}
        </button>
      ))}
      <button
        className={custom ? "selected" : ""}
        onClick={() => setCustom(!custom)}
      >
        Rango personalizado
      </button>
      {custom && (
        <>
          <Field label="Desde">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) =>
                e.target.value && onChange({ ...range, from: e.target.value })
              }
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) =>
                e.target.value && onChange({ ...range, to: e.target.value })
              }
            />
          </Field>
        </>
      )}
      {channels && (
        <select
          aria-label="Canal de venta"
          value={range.channel}
          onChange={(e) => onChange({ ...range, channel: e.target.value })}
        >
          <option value="">Todos los canales</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
