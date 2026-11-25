"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CookingPot,
  ExternalLink,
  House,
  LogOut,
  Menu as MenuIcon,
  Package,
  Pizza,
  Settings,
  ShoppingBag,
  Store,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { Live } from "@/components/Live";
import type { AdminData } from "@/lib/contracts";
import {
  activeStatuses,
  addDays,
  DateFilters,
  dayKey,
  Empty,
  formatNum,
  recipeEstimate,
  knownSum,
  localStamp,
  money,
  orderNo,
  Panel,
  periodSales,
  sum,
  titles,
  useOps,
  type Range,
} from "./shared";
import { Catalog, StoreConfig } from "./Catalog";
import { Recipes, Inventory, Finance } from "./Resources";

const sections = [
  {
    id: "overview",
    name: "Overview",
    title: "Pulso del Negocio",
    subtitle: "Ventas, costos, inventario y rentabilidad de tu pizzería.",
    icon: House,
  },
  {
    id: "orders",
    name: "Pedidos",
    title: "Pedidos",
    subtitle: "Consulta cada pedido y su estado de entrega.",
    icon: ClipboardList,
  },
  {
    id: "kitchen",
    name: "Cocina (KDS)",
    title: "Cocina",
    subtitle: "",
    icon: CookingPot,
  },
  {
    id: "cms",
    name: "Tienda / CMS",
    title: "Menú (Pizzas)",
    subtitle:
      "Administra las fotos, ingredientes, precios y disponibilidad de tu menú.",
    icon: Store,
  },
  {
    id: "recipes",
    name: "Recetas y costos",
    title: "Recetas y costos",
    subtitle:
      "Ajusta las porciones y conoce cuánto cuesta preparar cada pizza.",
    icon: ChefHat,
  },
  {
    id: "inventory",
    name: "Inventario",
    title: "Inventario y producción",
    subtitle: "Controla los insumos, movimientos y lotes de masa.",
    icon: Package,
  },
  {
    id: "finance",
    name: "Finanzas",
    title: "Finanzas",
    subtitle: "Consulta ingresos, comisiones, costos y gastos de operación.",
    icon: CircleDollarSign,
  },
  {
    id: "reports",
    name: "Reportes",
    title: "Reportes",
    subtitle: "Consulta los resultados de tu pizzería por periodo y canal.",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    id: "settings",
    name: "Configuración",
    title: "Configuración",
    subtitle: "Ajusta los parámetros de venta, horno y notificaciones.",
    icon: Settings,
  },
];
function currentSection() {
  const pick = new URL(window.location.href).searchParams.get("section");
  return sections.some((s) => s.id === pick && s.id !== "kitchen")
    ? pick!
    : "overview";
}
export function Admin({ sandbox }: { sandbox: boolean }) {
  const { data, busy, issue, mutate, reload, online } =
    useOps<AdminData>("/api/admin");
  const [section, setSection] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const [range, setRange] = useState<Range>(() => ({
    from: dayKey(),
    to: dayKey(),
    channel: "",
  }));
  useEffect(() => {
    const go = () => {
      setSection(currentSection());
      setMobile(false);
    };
    go();
    window.addEventListener("popstate", go);
    return () => window.removeEventListener("popstate", go);
  }, []);
  const go = (id: string) => {
    window.history.pushState(null, "", "/admin?section=" + id);
    setSection(id);
    setMobile(false);
  };
  const current = sections.find((s) => s.id === section)!;
  return (
    <div className={"op-app" + (collapsed ? " op-collapsed" : "")}>
      <Live audience="staff" />
      {mobile && (
        <button
          className="op-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"op-sidebar" + (mobile ? " opened" : "")}>
        <div className="op-sidebrand">
          <a href="/" aria-label="Pablo & Luca · Tienda">
            <img src="/media/logo-claro.webp" alt="Pablo & Luca" />
          </a>
          <button
            aria-label="Cerrar navegación"
            className="op-mobile-close op-icon"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <nav aria-label="Centro de mando">
          {sections.map(({ id, name, icon: Icon }) => (
            <a
              key={id}
              href={id === "kitchen" ? "/kitchen" : "/admin?section=" + id}
              className={section === id ? "selected" : ""}
              aria-current={section === id ? "page" : undefined}
              title={name}
              onClick={(e) => {
                if (id !== "kitchen" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  go(id);
                }
              }}
            >
              <Icon size={20} />
              <span>{name}</span>
              {id === "orders" &&
                !!data?.orders.filter((o) => o.status === "confirmed")
                  .length && (
                  <b>
                    {data.orders.filter((o) => o.status === "confirmed").length}
                  </b>
                )}
            </a>
          ))}
        </nav>
        <img
          className="op-landscape"
          src="/media/admin-landscape.webp"
          alt=""
        />
        <div className="op-sidefoot">
          <a href="/" title="Ver tienda">
            <ExternalLink size={17} />
            <span>Ver tienda</span>
          </a>
          <form method="post" action="/api/auth/logout">
            <button title="Cerrar sesión">
              <LogOut size={17} />
              <span>Cerrar sesión</span>
            </button>
          </form>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="op-collapse"
            title={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span>Contraer menú</span>
          </button>
        </div>
      </aside>
      <main className="op-main">
        <header className="op-top">
          <button
            className="op-mobile-nav op-icon"
            aria-label="Abrir navegación"
            onClick={() => setMobile(true)}
          >
            <MenuIcon />
          </button>
          <div>
            <small>
              {section === "cms" ? "Tienda / CMS" : "ERP / Operación"}
            </small>
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
          </div>
          <img
            className="op-header-art"
            src="/media/admin-panorama.webp"
            alt=""
          />
          {data && (
            <button
              disabled={busy || !online}
              className={"op-kitchenswitch " + (data.settings.open ? "on" : "")}
              onClick={() =>
                void mutate("settings.save", { open: !data.settings.open })
              }
            >
              <i />
              {data.settings.open ? "Cocina abierta" : "Cocina cerrada"}
            </button>
          )}
        </header>
        <div className="op-content">
          {sandbox && (
            <p className="op-sandbox">
              Sandbox local · inventario y operaciones de prueba
            </p>
          )}
          {(!online || issue) && (
            <div className="op-error" role="alert">
              {!online
                ? "Sin conexión. Reconecta para guardar cambios."
                : issue}{" "}
              <button onClick={() => void reload()}>Actualizar</button>
            </div>
          )}
          {!data ? (
            <p className="op-empty" role="status">
              Cargando centro de mando…
            </p>
          ) : (
            <fieldset className="op-mainfield" disabled={busy || !online}>
              {section === "overview" && (
                <>
                  <DateFilters range={range} onChange={setRange} />
                  <Overview data={data} range={range} go={go} />
                </>
              )}
              {section === "orders" && <Orders data={data} />}
              {section === "cms" && (
                <Catalog data={data} mutate={mutate} busy={busy} />
              )}
              {section === "recipes" && <Recipes data={data} mutate={mutate} />}
              {section === "inventory" && (
                <Inventory data={data} mutate={mutate} />
              )}
              {(section === "finance" || section === "reports") && (
                <Finance
                  data={data}
                  range={range}
                  onRange={setRange}
                  mutate={mutate}
                  reports={section === "reports"}
                />
              )}
              {section === "settings" && (
                <StoreConfig
                  key="all"
                  data={data}
                  mutate={mutate}
                  section="all"
                />
              )}
            </fieldset>
          )}
        </div>
      </main>
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  foot,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  foot?: string;
}) {
  return (
    <div className="op-metric">
      <i>
        <Icon />
      </i>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {foot && <em>{foot}</em>}
      </div>
    </div>
  );
}
function Overview({
  data,
  range,
  go,
}: {
  data: AdminData;
  range: Range;
  go: (id: string) => void;
}) {
  const sales = periodSales(data, range),
    gross = sum(sales, "gross"),
    net = gross - sum(sales, "refund") - sum(sales, "discount"),
    cost = knownSum(sales, "cost"),
    fee = knownSum(sales, "fee");
  const opex = data.expenses
    .filter(
      (e) =>
        !["inventory", "equipment"].includes(e.category) &&
        dayKey(e.date) >= range.from &&
        dayKey(e.date) <= range.to,
    )
    .reduce((n, e) => n + e.amount, 0);
  const profit = cost == null || fee == null ? null : net - cost - fee - opex;
  const numberDays = Math.max(
      1,
      Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) +
        1,
    ),
    size = Math.ceil(numberDays / 7);
  const buckets = Array.from({ length: Math.min(7, numberDays) }, (_, i) => ({
    start: addDays(range.from, i * size),
    end: addDays(range.from, (i + 1) * size - 1),
  }))
    .filter((b) => b.start <= range.to)
    .map((b) => ({
      ...b,
      total: sum(
        sales.filter(
          (s) => dayKey(s.date) >= b.start && dayKey(s.date) <= b.end,
        ),
        "gross",
      ),
    }));
  const peak = Math.max(1, ...buckets.map((b) => b.total));
  const ranked = new Map<string, number>();
  for (const sale of sales)
    for (const p of sale.productSales)
      ranked.set(p.name, (ranked.get(p.name) ?? 0) + p.quantity);
  const channels = data.channels
    .map((c) => ({
      ...c,
      amount: sum(
        sales.filter((s) => s.channel === c.id),
        "gross",
      ),
    }))
    .filter((c) => c.amount > 0);
  const readyDough = data.dough
    .filter((d) => d.status === "ready" && new Date(d.expiresAt) > new Date())
    .reduce((n, d) => n + d.remaining - (d.held ?? 0), 0);
  const product =
      data.products.find(
        (p) => !p.archived && data.recipes.some((r) => r.productId === p.id),
      ) ?? data.products.find((p) => !p.archived),
    recipe = data.recipes.find((r) => r.productId === product?.id);
  const critical = data.ingredients
    .filter((i) => i.stock <= i.minimum)
    .sort((a, b) => a.stock - b.stock);
  const ring =
    net > 0 && profit != null && cost != null && fee != null && profit >= 0
      ? Math.min(100, Math.round((profit / net) * 100))
      : null;
  return (
    <>
      <div className="op-metrics">
        <Metric label="Ventas" value={money(gross)} icon={ShoppingBag} />
        <Metric
          label="Pizzas vendidas"
          value={sum(sales, "units")}
          icon={Pizza}
        />
        <Metric
          label="Utilidad estimada"
          value={money(profit)}
          icon={ChartNoAxesColumnIncreasing}
          foot={profit == null ? "Costos o comisiones pendientes" : undefined}
        />
        <Metric
          label="Costo de producción"
          value={money(cost)}
          icon={CookingPot}
        />
        <Metric
          label="Pedidos activos"
          value={
            data.orders.filter((o) => activeStatuses.includes(o.status)).length
          }
          icon={ClipboardList}
        />
      </div>
      <div className="op-overview-grid">
        <Panel
          title="Ventas"
          action={<strong>{money(gross)}</strong>}
          className="op-sales"
        >
          <div className="op-bars" aria-label="Ventas por periodo">
            {buckets.map((b, i) => (
              <div key={b.start} title={b.start + " · " + money(b.total)}>
                <span>{money(b.total)}</span>
                <i
                  style={{
                    height: Math.max(2, (90 * b.total) / peak) + "px",
                    background:
                      i === buckets.length - 1 ? "var(--op-green)" : undefined,
                  }}
                />
                <small>
                  {b.start.slice(8)}/{b.start.slice(5, 7)}
                </small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Composición de ventas">
          <div className="op-composition">
            <div
              className="op-donut"
              style={{
                background:
                  ring == null
                    ? undefined
                    : "conic-gradient(var(--op-green) " +
                      ring +
                      "%, #b6d194 0)",
              }}
            >
              <b>
                {ring == null ? "—" : ring + "%"}
                <small>Utilidad</small>
              </b>
            </div>
            <ul>
              <li>
                <i />
                Utilidad
              </li>
              <li>
                <i />
                Costos y gastos
              </li>
            </ul>
          </div>
        </Panel>
        <Panel title="Canales de venta">
          {channels.length ? (
            channels.map((c) => (
              <div className="op-row" key={c.id}>
                <Store size={17} />
                <span>{c.name}</span>
                <strong>{money(c.amount)}</strong>
              </div>
            ))
          ) : (
            <Empty>Sin ventas en este periodo.</Empty>
          )}
        </Panel>
        <Panel
          title="Recetas y costos"
          action={
            <button
              aria-label="Abrir recetas"
              onClick={() => go("recipes")}
              className="op-icon"
            >
              <ArrowUpRight />
            </button>
          }
        >
          {product ? (
            <div className="op-feature">
              {product.image && (
                <img src={product.image} alt="" loading="lazy" />
              )}
              <div>
                <h3>{product.name}</h3>
                <small>
                  {recipe?.complete ? "Costo por pizza" : "Costo parcial"}
                </small>
                <strong>
                  {money(recipeEstimate(recipe, data.ingredients))}
                </strong>
                <small>Precio de venta · {money(product.price)}</small>
              </div>
            </div>
          ) : (
            <Empty>Agrega una pizza al menú.</Empty>
          )}
        </Panel>
        <Panel title="Productos más vendidos">
          {ranked.size ? (
            [...ranked]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, quantity], i) => (
                <div key={name} className="op-row">
                  <b>{i + 1}</b>
                  <span>{name}</span>
                  <strong>{quantity}</strong>
                </div>
              ))
          ) : (
            <Empty>Las pizzas vendidas aparecerán aquí.</Empty>
          )}
        </Panel>
        <Panel title="Inventario crítico">
          {critical.length ? (
            critical.slice(0, 5).map((i) => (
              <div key={i.id} className="op-row">
                <Package size={16} />
                <span>{i.name}</span>
                <strong>
                  {formatNum(i.stock)} {i.unit}
                </strong>
              </div>
            ))
          ) : (
            <Empty>Los insumos están por encima de su mínimo.</Empty>
          )}
        </Panel>
        <Panel title="Accesos rápidos" className="op-quick">
          <div>
            {(
              [
                { s: "recipes", t: "Recetas", i: BookOpen },
                { s: "inventory", t: "Inventario", i: Archive },
                { s: "finance", t: "Egresos", i: CircleDollarSign },
                { s: "orders", t: "Pedidos", i: ClipboardList },
              ] as const
            ).map(({ s, t, i: I }) => (
              <button key={s} onClick={() => go(s)}>
                <I />
                {t}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Producción de masa" className="op-dough-card">
          <div className="op-row">
            <Wheat />
            <span>Bolas listas</span>
            <strong>{readyDough}</strong>
          </div>
          <div className="op-row">
            <Activity />
            <span>Lotes fermentando</span>
            <strong>
              {data.dough.filter((d) => d.status === "fermenting").length}
            </strong>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Orders({ data }: { data: AdminData }) {
  const [filter, setFilter] = useState(""),
    [search, setSearch] = useState("");
  const orders = data.orders.filter(
    (o) =>
      (!filter || o.status === filter) &&
      [o.name, o.phone, orderNo(o.number)].some((x) =>
        x.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <Panel
      title="Pedidos de la tienda"
      action={
        <a className="op-secondary" href="/kitchen">
          <CookingPot size={16} /> Abrir cocina
        </a>
      }
    >
      <div className="op-tools">
        <input
          placeholder="Buscar por número o cliente"
          aria-label="Buscar pedidos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Estado"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(titles).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {orders.length ? (
        orders.map((o) => (
          <details className="op-order" key={o.id}>
            <summary>
              <strong>{orderNo(o.number)}</strong>
              <span>{o.name}</span>
              <small>{titles[o.status]}</small>
              <b>{money(o.total)}</b>
            </summary>
            <div>
              <p>
                {localStamp(o.createdAt)} ·{" "}
                {o.mode === "pickup" ? "Recolección" : "Entrega a domicilio"} ·{" "}
                {o.phone} · {o.email}
              </p>
              {o.address && (
                <p>
                  {o.address} {o.references}
                </p>
              )}
              {o.notes && <p>{o.notes}</p>}
              {o.units.map((u) => (
                <p key={u.id}>
                  <Pizza size={15} /> {u.name}{" "}
                  {u.removed.length ? "· Sin " + u.removed.join(", ") : ""}{" "}
                  {u.note && "· " + u.note}
                </p>
              ))}
            </div>
          </details>
        ))
      ) : (
        <Empty>No hay pedidos para esta selección.</Empty>
      )}
    </Panel>
  );
}
