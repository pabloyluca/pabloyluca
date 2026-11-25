"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  Check,
  ChefHat,
  Clock3,
  Expand,
  Flame,
  Inbox,
  LogOut,
  PackageCheck,
  Pizza,
  ShoppingBag,
  Truck,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { Live } from "@/components/Live";
import type { KitchenData, KitchenOrder, Unit } from "@/lib/contracts";
import { orderNo, useOps, type Mutate } from "./shared";

const columns = [
  { id: "new", title: "Nuevos", icon: Inbox },
  { id: "prep", title: "Preparando", icon: ChefHat },
  { id: "oven", title: "En el horno", icon: Flame },
  { id: "ready", title: "Listos", icon: Check },
] as const;
function lane(order: KitchenOrder) {
  if (order.status === "confirmed") return "new";
  if (order.status === "preparing") return "prep";
  if (order.status === "baking") return "oven";
  return "ready";
}
const clock = (s: number) =>
  String(Math.floor(s / 60)).padStart(2, "0") +
  ":" +
  String(Math.floor(s % 60)).padStart(2, "0");
function play(ctx: AudioContext, alarm: boolean) {
  if (ctx.state !== "running") return;
  const tones = alarm ? [880, 1175, 880] : [523, 784];
  tones.forEach((frequency, i) => {
    const start = ctx.currentTime + i * 0.22;
    const wave = ctx.createOscillator(),
      gain = ctx.createGain();
    wave.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    wave.connect(gain);
    gain.connect(ctx.destination);
    wave.start(start);
    wave.stop(start + 0.21);
  });
}
export function Kitchen({ sandbox, visualPreview }: { sandbox: boolean; visualPreview: boolean }) {
  const { data, issue, busy, online, live, mutate, reload } =
    useOps<KitchenData>("/api/kitchen");
  const [now, setNow] = useState(Date.now),
    [sound, setSound] = useState(false),
    [wake, setWake] = useState(false),
    [toolsOpen, setToolsOpen] = useState(false),
    [deviceIssue, setDeviceIssue] = useState("");
  const ctx = useRef<AudioContext | null>(null),
    previous = useRef<Set<string> | null>(null),
    alarms = useRef(new Set<string>());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      void ctx.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.orders.map((o) => o.id));
    if (
      sound &&
      ctx.current &&
      previous.current &&
      data.orders.some(
        (o) => o.status === "confirmed" && !previous.current!.has(o.id),
      )
    )
      play(ctx.current, false);
    previous.current = ids;
  }, [data, sound]);
  useEffect(() => {
    if (!data || !sound || !ctx.current) return;
    const current = new Set<string>();
    let newExpired = false;
    for (const o of data.orders)
      for (const u of o.units) {
        if (u.status !== "baking" || !u.endsAt) continue;
        const until = Date.parse(u.endsAt);
        if (until <= now) {
          const key = u.id + ":" + u.endsAt;
          current.add(key);
          if (!alarms.current.has(key)) newExpired = true;
        }
      }
    if (newExpired) play(ctx.current, true);
    alarms.current = current;
  }, [now, data, sound]);
  useEffect(() => {
    if (!wake) return;
    let lock: WakeLockSentinel | undefined,
      disposed = false;
    const request = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        const value = await navigator.wakeLock.request("screen");
        if (disposed) await value.release();
        else lock = value;
      } catch {
        if (!disposed) {
          setWake(false);
          setDeviceIssue(
            "El dispositivo no permitió mantener la pantalla activa.",
          );
        }
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [wake]);
  async function toggleSound() {
    try {
      if (sound) {
        setSound(false);
        return;
      }
      ctx.current ??= new AudioContext();
      await ctx.current.resume();
      play(ctx.current, false);
      setSound(true);
      setDeviceIssue("");
    } catch {
      setDeviceIssue("El navegador no permitió activar el audio.");
    }
  }
  const orders =
    data?.orders.filter((o) =>
      ["confirmed", "preparing", "baking", "ready", "dispatched"].includes(
        o.status,
      ),
    ) ?? [];
  const baking = orders
    .flatMap((o) => o.units)
    .filter((u) => u.status === "baking").length;
  const expired = orders
    .flatMap((o) => o.units)
    .filter(
      (u) => u.status === "baking" && u.endsAt && Date.parse(u.endsAt) <= now,
    ).length;
  return (
    <main className="kds">
      <Live audience="kitchen" />
      <header className="kds-head">
        <img src="/media/logo-claro.webp" alt="Pablo & Luca" />
        <div className="kds-title">
          <h1>
            Cocina <span>(KDS)</span>
          </h1>
          <p>
            <i className={online && live && !issue ? "" : "off"} />
            {visualPreview ? "Vista de solo lectura" : !online
              ? "Sin conexión"
              : issue || live === false
                ? "Conexión por verificar"
                : live === null
                  ? "Conectando…"
                  : "Pedidos en tiempo real"}
          </p>
          {sandbox && (
            <small className="kds-sandbox">Sandbox · cocina de prueba</small>
          )}
        </div>
        <div className="kds-oven">
          <Flame />
          <span>
            Horno 1<strong>{data?.settings.temperature ?? "—"} °C</strong>
          </span>
        </div>
        <div className="kds-oven">
          <Clock3 />
          <span>
            Tiempo por pizza
            <strong>
              {data ? clock(data.settings.ovenMinutes * 60) : "—"}
            </strong>
          </span>
        </div>
        <button
          className="kds-btn"
          aria-pressed={sound}
          onClick={() => void toggleSound()}
        >
          {sound ? <Volume2 /> : <VolumeX />}
          <span>{sound ? "Sonido activo" : "Habilitar sonido"}</span>
        </button>
      </header>
      {(!online || live === false || issue || deviceIssue) && (
        <div role="alert" className="kds-warning">
          <WifiOff size={20} />
          {!online
            ? "Sin conexión. Los tiempos son estimados hasta reconectar."
            : issue ||
              deviceIssue ||
              "Canal en tiempo real desconectado. Reconectando…"}
          <button
            onClick={() => {
              setDeviceIssue("");
              void reload();
            }}
          >
            Revisar conexión
          </button>
        </div>
      )}
      {!data ? (
        <div className="kds-loading" role="status">
          Cargando pedidos de cocina…
        </div>
      ) : (
        <div className="kds-board">
          {columns.map(({ id, title, icon: Icon }) => {
            const queue = orders.filter((o) => lane(o) === id);
            return (
              <section className={"kds-column " + id} key={id}>
                <h2>
                  <Icon /> {title}{" "}
                  <span>({id === "oven" ? baking : queue.length})</span>
                </h2>
                {queue.length ? (
                  queue.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      mutate={mutate}
                      disabled={busy || !online || !!issue}
                      capacityFree={baking < data.settings.ovenCapacity}
                    />
                  ))
                ) : (
                  <div className="kds-empty">
                    <Icon size={36} />
                    <p>
                      {id === "new"
                        ? "Los pedidos pagados aparecerán aquí."
                        : id === "prep"
                          ? "Los pedidos aceptados pasan a preparación."
                          : id === "oven"
                            ? "Aquí verás los tiempos de cada pizza."
                            : "Aquí aparecerán las pizzas listas para entregar."}
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <footer className="kds-foot">
        <div>
          <ShoppingBag />
          <span>
            Pedidos activos <b>{orders.length}</b>
          </span>
        </div>
        <div>
          <Pizza />
          <span>
            Pizzas en cola{" "}
            <b>
              {
                orders
                  .flatMap((o) => o.units)
                  .filter((u) => u.status === "queued").length
              }
            </b>
          </span>
        </div>
        <div>
          <Flame />
          <span>
            Espacios ocupados{" "}
            <b>
              {baking} / {data?.settings.ovenCapacity ?? "—"}
            </b>
          </span>
        </div>
        <button
          className={expired ? "alarm" : ""}
          onClick={() => setToolsOpen(!toolsOpen)}
          aria-expanded={toolsOpen}
        >
          <Bell />
          {expired
            ? expired + " temporizador(es) vencido(s)"
            : "Pantalla y alertas"}
        </button>
      </footer>
      {toolsOpen && (
        <div className="kds-controls">
          <button
            className="kds-btn"
            aria-pressed={wake}
            onClick={() => {
              if (!("wakeLock" in navigator)) {
                setDeviceIssue("Este navegador no admite bloqueo de pantalla.");
                return;
              }
              setWake(!wake);
            }}
          >
            <AlarmClock />
            {wake ? "Mantener activa · sí" : "Mantener pantalla activa"}
          </button>
          <button
            className="kds-btn"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setDeviceIssue(
                  "Pantalla completa no disponible en este navegador.",
                );
              }
            }}
          >
            <Expand /> Pantalla completa
          </button>
          <form method="post" action="/api/auth/logout">
            <button className="kds-btn">
              <LogOut /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
function OrderCard({
  order,
  now,
  mutate,
  disabled,
  capacityFree,
}: {
  order: KitchenOrder;
  now: number;
  mutate: Mutate;
  disabled: boolean;
  capacityFree: boolean;
}) {
  const ready =
    order.units.length > 0 && order.units.every((u) => u.status === "ready");
  const verb = (action: string) =>
    void mutate("order." + action, { id: order.id });
  const elapsed = Math.max(
    0,
    Math.floor((now - Date.parse(order.paidAt)) / 60000),
  );
  return (
    <article className="kds-order">
      <div className="kds-order-head">
        <h3>{orderNo(order.number)}</h3>
        <time>{elapsed ? elapsed + " min" : "Ahora"}</time>
      </div>
      <p className="kds-order-meta">
        {order.units.length} {order.units.length === 1 ? "pizza" : "pizzas"} ·
        Pago confirmado
      </p>
      <small className="kds-mode">
        {order.mode === "delivery" ? (
          <Truck size={14} />
        ) : (
          <ShoppingBag size={14} />
        )}{" "}
        {order.mode === "delivery" ? "Entrega a domicilio" : "Recolección"}
      </small>
      {order.units.map((u, i) => (
        <UnitCard
          key={u.id}
          unit={u}
          index={i}
          now={now}
          allowStart={["preparing", "baking"].includes(order.status)}
          capacityFree={capacityFree}
          disabled={disabled}
          mutate={mutate}
        />
      ))}
      <div className="kds-order-buttons">
        {order.status === "confirmed" && (
          <button disabled={disabled} onClick={() => verb("accept")}>
            <ChefHat /> Aceptar y preparar
          </button>
        )}
        {ready && ["preparing", "baking"].includes(order.status) && (
          <button disabled={disabled} onClick={() => verb("ready")}>
            <Check /> Pedido listo
          </button>
        )}
        {order.status === "ready" && (
          <button
            disabled={disabled}
            onClick={() =>
              verb(order.mode === "delivery" ? "dispatch" : "pickup")
            }
          >
            <PackageCheck />
            {order.mode === "delivery" ? "Despachar" : "Marcar recogido"}
          </button>
        )}
        {order.status === "dispatched" && (
          <button disabled={disabled} onClick={() => verb("deliver")}>
            <Check /> Marcar entregado
          </button>
        )}
      </div>
    </article>
  );
}
function UnitCard({
  unit: u,
  index,
  now,
  allowStart,
  capacityFree,
  disabled,
  mutate,
}: {
  unit: Unit;
  index: number;
  now: number;
  allowStart: boolean;
  capacityFree: boolean;
  disabled: boolean;
  mutate: Mutate;
}) {
  const rest = u.endsAt
    ? Math.max(0, Math.ceil((Date.parse(u.endsAt) - now) / 1000))
    : 0;
  const duration =
    u.endsAt && u.startedAt
      ? Math.max(1, (Date.parse(u.endsAt) - Date.parse(u.startedAt)) / 1000)
      : 1;
  const action = (op: string) => void mutate("unit." + op, { id: u.id });
  return (
    <div
      className={
        "kds-unit " +
        (u.status === "baking"
          ? rest === 0
            ? "expired"
            : rest <= 60
              ? "last"
              : "baking"
          : u.status)
      }
    >
      <div className="kds-unit-name">
        {u.image ? (
          <img src={u.image} alt="" />
        ) : (
          <Pizza className="kds-pizza" />
        )}
        <div>
          <strong>{u.name}</strong>
          {u.removed.length > 0 && <small>Sin {u.removed.join(", ")}</small>}
          {u.note && <small className="kds-note">{u.note}</small>}
        </div>
        {u.status === "ready" && <Check className="kds-ready" />}
      </div>
      {allowStart && u.status === "queued" && (
        <button
          className="kds-start"
          disabled={disabled || !capacityFree}
          onClick={() => action("start")}
          aria-label={"Iniciar horneado de " + u.name + " " + (index + 1)}
        >
          <Flame size={17} />
          {capacityFree ? "Iniciar horneado" : "En cola · horno ocupado"}
        </button>
      )}
      {u.status === "baking" && (
        <div className="kds-timer">
          <strong
            role="timer"
            aria-label={"Tiempo de " + u.name + " " + (index + 1)}
          >
            {clock(rest)}
          </strong>
          <progress
            max={100}
            value={Math.min(100, (rest / duration) * 100)}
            aria-label="Tiempo restante"
          />
          {!rest && (
            <small role="status">Tiempo terminado · confirma la pizza</small>
          )}
          <div>
            <button disabled={disabled} onClick={() => action("extend")}>
              +1 min
            </button>
            <button disabled={disabled} onClick={() => action("ready")}>
              <Check size={15} /> Marcar lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
