"use client";
import { useState, type FormEvent } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  Grid2X2,
  ImagePlus,
  List,
  Pencil,
  Pizza,
  Plus,
  Search,
} from "lucide-react";
import type { AdminData, Product, Settings, Zone } from "@/lib/contracts";
import {
  amount,
  Drawer,
  Empty,
  Field,
  money,
  Panel,
  Save,
  strings,
  upload,
  type Mutate,
} from "./shared";

import { SalesChannelEditor } from "./SalesChannelEditor";

type Props = { data: AdminData; mutate: Mutate };
const tabs = [
  "Pizzas",
  "Promociones",
  "Banners / Home",
  "Horarios",
  "Zonas de entrega",
  "Canales de venta",
] as const;
const notificationNames: Record<string, string> = {
  paid_internal: "Nuevo pedido pagado",
  order_confirmed: "Pedido confirmado",
  payment_confirmed: "Pago confirmado",
  ready: "Pedido listo",
  dispatched: "Pedido despachado",
  cancelled: "Cancelaciones",
  intervention: "Intervención del equipo",
  low_stock: "Inventario bajo",
  daily_summary: "Resumen diario",
  payment_error: "Error de pago",
};
export function Catalog({ data, mutate, busy }: Props & { busy: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Pizzas"),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<Product | "new" | null>(null),
    [list, setList] = useState(false),
    [archived, setArchived] = useState(false);
  const products = data.products
    .filter(
      (p) =>
        p.archived === archived &&
        p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => a.position - b.position);
  return (
    <>
      <div className="op-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={t === tab ? "selected" : ""}
          >
            {t}
            {t === "Pizzas"
              ? " (" + data.products.filter((p) => !p.archived).length + ")"
              : ""}
          </button>
        ))}
      </div>
      {tab === "Pizzas" ? (
        <>
          <div className="op-tools">
            <label className="op-search">
              <Search size={17} />
              <input
                aria-label="Buscar pizza"
                placeholder="Buscar pizza…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="op-check">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />{" "}
              Archivadas
            </label>
            <div className="op-segments">
              <button
                aria-label="Ver cuadrícula"
                aria-pressed={!list}
                onClick={() => setList(false)}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                aria-label="Ver lista"
                aria-pressed={list}
                onClick={() => setList(true)}
              >
                <List size={18} />
              </button>
            </div>
            <button className="op-primary" onClick={() => setEditor("new")}>
              <Plus size={18} /> Nueva pizza
            </button>
          </div>
          <div className={"op-products" + (list ? " op-list" : "")}>
            {products.map((p) => (
              <article key={p.id} className="op-product">
                <div className="op-product-photo">
                  {p.image ? (
                    <img alt="" src={p.image} loading="lazy" />
                  ) : (
                    <Pizza size={44} />
                  )}
                  <span
                    className={
                      "op-tag " + (!p.available || p.archived ? "paused" : "")
                    }
                  >
                    <i />
                    {p.archived
                      ? "Archivada"
                      : p.available
                        ? "Disponible"
                        : "Agotada"}
                  </span>
                </div>
                <div className="op-product-copy">
                  <h3>
                    {p.name}
                    <b>{money(p.price)}</b>
                  </h3>
                  <p>{p.description}</p>
                </div>
                <div className="op-product-actions">
                  <button
                    onClick={() => setEditor(p)}
                    aria-label={"Editar " + p.name}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                  <button
                    title="Duplicar"
                    aria-label={"Duplicar " + p.name}
                    onClick={() =>
                      void mutate("product.duplicate", { id: p.id })
                    }
                  >
                    <Copy size={15} />
                  </button>
                  {!archived && (
                    <>
                      <button
                        title="Subir"
                        aria-label={"Subir " + p.name}
                        onClick={() => void mutate("product.up", { id: p.id })}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        title="Bajar"
                        aria-label={"Bajar " + p.name}
                        onClick={() =>
                          void mutate("product.down", { id: p.id })
                        }
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        title="Archivar"
                        aria-label={"Archivar " + p.name}
                        onClick={() => setEditor(p)}
                      >
                        <Archive size={15} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!products.length && <Empty>Sin pizzas en esta selección.</Empty>}
          {editor && (
            <ProductEditor
              value={editor === "new" ? null : editor}
              defaultPosition={data.products.length + 1}
              mutate={mutate}
              onClose={() => setEditor(null)}
              busy={busy}
            />
          )}
        </>
      ) : tab === "Canales de venta" ? (
        <SalesChannelEditor data={data} mutate={mutate} busy={busy} />
      ) : (
        <StoreConfig key={tab} data={data} mutate={mutate} section={tab} />
      )}
    </>
  );
}

function ProductEditor({
  value,
  defaultPosition,
  mutate,
  onClose,
  busy,
}: {
  value: Product | null;
  defaultPosition: number;
  mutate: Mutate;
  onClose: () => void;
  busy: boolean;
}) {
  const [picture, setPicture] = useState(value?.image ?? ""),
    [ingredients, setIngredients] = useState(
      value?.ingredients.join(", ") ?? "",
    ),
    [removable, setRemovable] = useState<string[]>(value?.removable ?? []),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [archive, setArchive] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      names = strings(ingredients);
    if (
      await mutate("product.save", {
        ...(value ? { id: value.id } : {}),
        name: String(f.get("name")).trim(),
        description: String(f.get("description")).trim(),
        price: amount(f.get("price")),
        ingredients: names,
        removable: removable.filter((r) => names.includes(r)),
        available: f.has("available"),
        archived: value?.archived ?? false,
        position: value?.position ?? defaultPosition,
        image: picture,
      })
    )
      onClose();
    else setError("No se pudo guardar. Revisa los campos y la conexión.");
  }
  return (
    <Drawer title={value ? "Editar pizza" : "Nueva pizza"} onClose={onClose}>
      <form className="op-form" onSubmit={save}>
        <div className="op-editor-top">
          <div className="op-photo-edit">
            {picture ? (
              <img src={picture} alt="Foto del producto" />
            ) : (
              <Pizza size={48} />
            )}
            <label>
              <ImagePlus size={15} /> {uploading ? "Subiendo…" : "Cambiar foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError("");
                  try {
                    setPicture(await upload(file, "product"));
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "No se pudo subir la foto.",
                    );
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
          <div>
            <Field label="Nombre de la pizza">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={value?.name}
              />
            </Field>
            <Field label="Precio de venta (MXN)">
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={value ? value.price / 100 : undefined}
              />
            </Field>
          </div>
        </div>
        <Field label="Descripción">
          <textarea
            name="description"
            rows={3}
            maxLength={600}
            defaultValue={value?.description}
          />
        </Field>
        <Field label="Ingredientes (separados por comas)">
          <textarea
            rows={3}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </Field>
        <fieldset className="op-checkgroup">
          <legend>El cliente puede quitar</legend>
          {strings(ingredients).length ? (
            strings(ingredients).map((i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={removable.includes(i)}
                  onChange={(e) =>
                    setRemovable(
                      e.target.checked
                        ? [...removable, i]
                        : removable.filter((x) => x !== i),
                    )
                  }
                />{" "}
                {i}
              </label>
            ))
          ) : (
            <small>
              Escribe los ingredientes para elegir cuáles son removibles.
            </small>
          )}
        </fieldset>
        <label className="op-check">
          <input
            type="checkbox"
            name="available"
            defaultChecked={value?.available ?? true}
          />{" "}
          Disponible en la tienda
        </label>
        {error && (
          <p role="alert" className="op-error">
            {error}
          </p>
        )}
        <div className="op-formfoot">
          <button type="button" className="op-secondary" onClick={onClose}>
            Cancelar
          </button>
          <Save busy={busy || uploading} />
        </div>
      </form>
      {value && !value.archived && (
        <div className="op-archive">
          <button className="op-danger" onClick={() => setArchive(!archive)}>
            <Archive size={15} /> Archivar pizza
          </button>
          {archive && (
            <>
              <p>
                La pizza dejará de aparecer en la tienda. Se conservarán las
                ventas históricas.
              </p>
              <button
                className="op-secondary"
                onClick={async () => {
                  if (await mutate("product.archive", { id: value.id }))
                    onClose();
                  else setError("No se pudo archivar.");
                }}
              >
                Confirmar archivo
              </button>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

export function StoreConfig({
  data,
  mutate,
  section,
}: Props & { section: string }) {
  const [saved, setSaved] = useState("");
  const s = data.settings;
  async function save(
    e: FormEvent<HTMLFormElement>,
    extract: (f: FormData) => Partial<Settings>,
    tag: string,
  ) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (await mutate("settings.save", extract(f))) setSaved(tag);
  }
  return (
    <div className="op-config">
      {(section === "all" || section === "Banners / Home") && (
        <Panel title="Portada de la tienda">
          <form
            className="op-form"
            onSubmit={(e) =>
              void save(
                e,
                (f) => ({
                  businessName: String(f.get("businessName")),
                  homeTitle: String(f.get("homeTitle")),
                  homeDescription: String(f.get("homeDescription")),
                  banner: String(f.get("banner")),
                }),
                "home",
              )
            }
          >
            <Field label="Nombre comercial">
              <input
                name="businessName"
                required
                defaultValue={s.businessName}
              />
            </Field>
            <Field label="Título principal">
              <input name="homeTitle" required defaultValue={s.homeTitle} />
            </Field>
            <Field label="Descripción de portada">
              <textarea
                name="homeDescription"
                defaultValue={s.homeDescription}
              />
            </Field>
            <Field label="Banner de aviso">
              <input name="banner" defaultValue={s.banner} />
            </Field>
            <Save />
            {saved === "home" && <small role="status">Portada guardada.</small>}
          </form>
        </Panel>
      )}
      {(section === "all" || section === "Horarios") && (
        <Panel title="Horarios y disponibilidad">
          <form
            key={
              String(s.open) + String(s.pickup) + String(s.delivery) + s.hours
            }
            className="op-form"
            onSubmit={(e) =>
              void save(
                e,
                (f) => ({
                  hours: String(f.get("hours")),
                  pickup: f.has("pickup"),
                  delivery: f.has("delivery"),
                  open: f.has("open"),
                }),
                "hours",
              )
            }
          >
            <Field label="Horario publicado">
              <textarea name="hours" defaultValue={s.hours} />
            </Field>
            {(
              [
                ["open", "Cocina abierta"],
                ["pickup", "Recolección habilitada"],
                ["delivery", "Entrega a domicilio habilitada"],
              ] as const
            ).map(([id, t]) => (
              <label className="op-check" key={id}>
                <input type="checkbox" name={id} defaultChecked={s[id]} /> {t}
              </label>
            ))}
            <Save />
            {saved === "hours" && (
              <small role="status">Disponibilidad guardada.</small>
            )}
          </form>
        </Panel>
      )}
      {(section === "all" || section === "Zonas de entrega") && (
        <Zones data={data} mutate={mutate} />
      )}
      {(section === "all" || section === "Promociones") && (
        <Promotions data={data} mutate={mutate} />
      )}
      {section === "all" && (
        <>
          <Panel title="Horno y capacidad">
            <form
              className="op-form"
              onSubmit={(e) =>
                void save(
                  e,
                  (f) => ({
                    ovenMinutes: Number(f.get("ovenMinutes")),
                    ovenCapacity: Number(f.get("ovenCapacity")),
                    temperature: Number(f.get("temperature")),
                    maxActiveUnits: Number(f.get("maxActiveUnits")),
                    limitDough: f.has("limitDough"),
                  }),
                  "oven",
                )
              }
            >
              {(
                [
                  ["ovenMinutes", "Minutos de horneado"],
                  ["ovenCapacity", "Espacios en el horno"],
                  ["temperature", "Temperatura de referencia (°C)"],
                  ["maxActiveUnits", "Máximo de pizzas activas"],
                ] as const
              ).map(([k, t]) => (
                <Field key={k} label={t}>
                  <input
                    type="number"
                    required
                    name={k}
                    min={1}
                    step={1}
                    defaultValue={s[k]}
                  />
                </Field>
              ))}
              <label className="op-check">
                <input
                  type="checkbox"
                  name="limitDough"
                  defaultChecked={s.limitDough}
                />{" "}
                Limitar ventas a las bolas de masa listas
              </label>
              <Save />
              {saved === "oven" && <small role="status">Horno guardado.</small>}
            </form>
          </Panel>
          <Panel title="Notificaciones">
            <form
              className="op-form"
              onSubmit={(e) =>
                void save(
                  e,
                  (f) => ({
                    notificationEmail: String(f.get("notificationEmail")),
                    notifications: Object.fromEntries(
                      Object.keys(notificationNames).map((k) => [k, f.has(k)]),
                    ),
                  }),
                  "notifications",
                )
              }
            >
              <Field label="Correo operativo">
                <input
                  type="email"
                  required
                  name="notificationEmail"
                  defaultValue={s.notificationEmail}
                />
              </Field>
              {Object.entries(notificationNames).map(([key, title]) => (
                <label key={key} className="op-check">
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={s.notifications[key] !== false}
                  />{" "}
                  {title}
                </label>
              ))}
              <Save />
              {saved === "notifications" && (
                <small role="status">Notificaciones guardadas.</small>
              )}
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
function Zones({ data, mutate }: Props) {
  const [id, setId] = useState<string | null>(null);
  const z = data.zones.find((v) => v.id === id);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate("zone.save", {
        ...(z ? { id: z.id } : {}),
        name: String(f.get("name")),
        fee: amount(f.get("fee")),
        postcodes: strings(String(f.get("postcodes"))),
        enabled: f.has("enabled"),
      })
    )
      setId(null);
  }
  return (
    <Panel
      title="Zonas de entrega"
      action={
        <button className="op-secondary" onClick={() => setId("new")}>
          <Plus size={15} /> Zona
        </button>
      }
    >
      {data.zones.length ? (
        data.zones.map((zone: Zone) => (
          <button
            key={zone.id}
            className="op-editrow"
            onClick={() => setId(zone.id)}
          >
            <span>
              <strong>{zone.name}</strong>
              <small>{zone.postcodes.join(", ")}</small>
            </span>
            <b>{money(zone.fee)}</b>
            <small>{zone.enabled ? "Activa" : "Desactivada"}</small>
            <Pencil size={16} />
          </button>
        ))
      ) : (
        <Empty>
          Añade la cobertura y tarifa acordadas para habilitar entregas.
        </Empty>
      )}
      {id && (
        <Drawer
          title={z ? "Editar zona" : "Nueva zona"}
          onClose={() => setId(null)}
        >
          <form className="op-form" onSubmit={save}>
            <Field label="Nombre">
              <input required name="name" defaultValue={z?.name} />
            </Field>
            <Field label="Códigos postales (separados por comas)">
              <input
                required
                name="postcodes"
                defaultValue={z?.postcodes.join(", ")}
                pattern="[0-9 ,]+"
              />
            </Field>
            <Field label="Tarifa de entrega (MXN)">
              <input
                name="fee"
                type="number"
                required
                min={0}
                step=".01"
                defaultValue={z ? z.fee / 100 : undefined}
              />
            </Field>
            <label className="op-check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={z?.enabled ?? true}
              />{" "}
              Zona activa
            </label>
            <Save />
          </form>
        </Drawer>
      )}
    </Panel>
  );
}
function Promotions({ data, mutate }: Props) {
  const [id, setId] = useState<string | null>(null);
  const p = data.promotions.find((v) => v.id === id);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate("promotion.save", {
        ...(p ? { id: p.id } : {}),
        code: String(f.get("code")).trim().toUpperCase(),
        percent: Number(f.get("percent")),
        enabled: f.has("enabled"),
      })
    )
      setId(null);
  }
  return (
    <Panel
      title="Promociones"
      action={
        <button className="op-secondary" onClick={() => setId("new")}>
          <Plus size={15} /> Promoción
        </button>
      }
    >
      {data.promotions.length ? (
        data.promotions.map((v) => (
          <button className="op-editrow" key={v.id} onClick={() => setId(v.id)}>
            <strong>{v.code}</strong>
            <b>{v.percent}%</b>
            <small>{v.enabled ? "Activa" : "Desactivada"}</small>
            <Pencil size={16} />
          </button>
        ))
      ) : (
        <Empty>Los códigos de descuento aparecerán aquí.</Empty>
      )}
      {id && (
        <Drawer
          title={p ? "Editar promoción" : "Nueva promoción"}
          onClose={() => setId(null)}
        >
          <form className="op-form" onSubmit={save}>
            <Field label="Código de descuento">
              <input required name="code" defaultValue={p?.code} />
            </Field>
            <Field label="Descuento (%)">
              <input
                required
                name="percent"
                type="number"
                min={1}
                max={100}
                defaultValue={p?.percent}
              />
            </Field>
            <label className="op-check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={p?.enabled ?? true}
              />{" "}
              Promoción activa
            </label>
            <Save />
          </form>
        </Drawer>
      )}
    </Panel>
  );
}
