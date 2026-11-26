"use client";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  ChefHat,
  Package,
  Pencil,
  Pizza,
  Plus,
  Trash2,
  Wheat,
} from "lucide-react";
import type {
  AdminData,
  Ingredient,
  Product,
  RecipeItem,
} from "@/lib/contracts";
import {
  amount,
  dayKey,
  Drawer,
  Empty,
  Field,
  formatNum,
  recipeEstimate,
  localStamp,
  money,
  Panel,
  Save,
  type Mutate,
} from "./shared";
export { Finance } from "./Finance";

type Props = { data: AdminData; mutate: Mutate };
const factors: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  ml: 1,
  L: 1000,
  fl_oz: 29.5735295625,
  pz: 1,
};
const units: Record<Ingredient["unit"], string[]> = {
  g: ["g", "kg", "oz"],
  ml: ["ml", "L", "fl_oz"],
  pz: ["pz"],
};
const unitLabel = (u: string) =>
  u === "fl_oz" ? "oz líquida" : u === "oz" ? "oz de peso" : u;
const categories: RecipeItem["category"][] = [
  "masa",
  "salsa",
  "toppings",
  "empaque",
  "otros",
];
const titles: Record<string, string> = {
  preparing: "Preparando",
  fermenting: "Fermentando",
  ready: "Listas",
  waste: "Merma",
  used: "Utilizadas",
  reserved: "Reservadas",
  purchase: "Compra",
  consumption: "Consumo",
  adjustment: "Ajuste",
  production: "Producción",
  reversal: "Reversión",
  release: "Liberación",
};
const formText = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const stamp = (value: string) => new Date(value + ":00-05:00").toISOString();
function inputStamp(value?: string) {
  if (!value) return "";
  return new Date(Date.parse(value) - 5 * 3600000).toISOString().slice(0, 16);
}

function portionFor(data: AdminData, ingredient: Ingredient) {
  const row = data.recipes
    .flatMap((recipe) => recipe.items)
    .find((item) => item.ingredientId === ingredient.id);
  return row ? row.quantity * factors[row.unit] : 0;
}

function PortionCost({
  data,
  ingredient,
}: {
  data: AdminData;
  ingredient: Ingredient;
}) {
  const portion = portionFor(data, ingredient);
  const pack = ingredient.purchaseQuantity * factors[ingredient.purchaseUnit];
  if (!portion || !pack || ingredient.unitCost == null) return null;
  return (
    <p>
      Porción de {formatNum(portion)} {ingredient.unit} ·{" "}
      {money(Math.round(portion * ingredient.unitCost))}
      {ingredient.referencePrice != null && (
        <>
          {" "}
          · A precio regular{" "}
          {money(Math.round((ingredient.referencePrice * portion) / pack))}
        </>
      )}
      <br />
      {Math.floor(pack / portion)} porciones por presentación ·{" "}
      {formatNum(pack % portion)} {ingredient.unit} restantes
    </p>
  );
}

function CheeseContribution({ data }: { data: AdminData }) {
  const base = data.ingredients.find((i) => i.cheeseRole === "base");
  const plant = data.ingredients.find((i) => i.cheeseRole === "vegan");
  const surcharge = data.settings.veganSurcharge;
  if (
    !base ||
    base.unitCost == null ||
    !plant ||
    plant.unitCost == null ||
    surcharge == null
  )
    return null;
  const portion = portionFor(data, plant);
  if (!portion) return null;
  const baseCost = Math.round(base.unitCost * portion);
  const plantCost = Math.round(plant.unitCost * portion);
  const delta = plantCost - baseCost;
  return (
    <Panel title="Sustitución de queso">
      <p>
        {formatNum(portion)} g · Mozzarella {money(baseCost)} · Queso vegetal{" "}
        {money(plantCost)}
      </p>
      <p>
        Costo incremental {money(delta)} · Suplemento {money(surcharge)}
      </p>
      <strong>
        Contribución incremental directa · {money(surcharge - delta)}
      </strong>
      {data.channels
        .filter((c) => c.commission != null)
        .map((c) => (
          <p key={c.id}>
            {c.name} ({formatNum(c.commission!)} %) ·{" "}
            {money(
              surcharge - Math.round((surcharge * c.commission!) / 100) - delta,
            )}
          </p>
        ))}
    </Panel>
  );
}

export function Recipes({ data, mutate }: Props) {
  const [edit, setEdit] = useState<Product | null>(null),
    [mode, setMode] = useState("recetas");
  return (
    <>
      <div className="op-tabs">
        <button
          className={mode === "recetas" ? "selected" : ""}
          onClick={() => setMode("recetas")}
        >
          <ChefHat size={16} /> Recetario
        </button>
        <button
          className={mode === "sim" ? "selected" : ""}
          onClick={() => setMode("sim")}
        >
          <Calculator size={16} /> Simulador de rentabilidad
        </button>
      </div>
      {mode === "sim" ? (
        <>
          <CheeseContribution data={data} />
          <Simulator data={data} />
        </>
      ) : (
        <div className="op-recipes">
          {data.products
            .filter((p) => !p.archived)
            .map((p) => {
              const r = data.recipes.find((x) => x.productId === p.id),
                complete = r?.cost != null;
              return (
                <Panel key={p.id} title={p.name}>
                  <div className="op-feature">
                    {p.image ? (
                      <img src={p.image} alt="" loading="lazy" />
                    ) : (
                      <Pizza />
                    )}
                    <div>
                      <small>
                        {complete ? "Costo de producción" : "Costo parcial"}
                      </small>
                      <strong>
                        {money(recipeEstimate(r, data.ingredients))}
                      </strong>
                      <small>Precio de venta · {money(p.price)}</small>
                    </div>
                  </div>
                  {r?.costPending && (
                    <small>Costeo estimado · Pendiente de validación</small>
                  )}
                  {complete &&
                    data.channels
                      .filter(
                        (c) =>
                          c.productPrices?.[p.id] != null &&
                          c.commission != null,
                      )
                      .map((c) => {
                        const price = c.productPrices![p.id];
                        return (
                          <p key={c.id}>
                            {c.name} · Contribución bruta{" "}
                            {money(
                              price -
                                Math.round((price * c.commission!) / 100) -
                                r.cost!,
                            )}
                          </p>
                        );
                      })}
                  {complete ? (
                    <p>
                      Contribución bruta directa · {money(p.price - r.cost!)} ·{" "}
                      {p.price
                        ? Math.round(((p.price - r.cost!) / p.price) * 100)
                        : 0}
                      %
                    </p>
                  ) : (
                    <p className="op-hint">
                      <AlertTriangle size={15} /> Receta incompleta · margen
                      pendiente
                    </p>
                  )}
                  <button className="op-secondary" onClick={() => setEdit(p)}>
                    <Pencil size={15} /> Editar receta
                  </button>
                </Panel>
              );
            })}
        </div>
      )}
      {edit && (
        <RecipeEditor
          product={edit}
          data={data}
          mutate={mutate}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
function RecipeEditor({
  data,
  mutate,
  product,
  onClose,
}: Props & { product: Product; onClose: () => void }) {
  const recipe = data.recipes.find((r) => r.productId === product.id);
  const [items, setItems] = useState<RecipeItem[]>(recipe?.items ?? []),
    [costPending, setCostPending] = useState(recipe?.costPending ?? false),
    [complete, setComplete] = useState(recipe?.complete ?? false),
    [error, setError] = useState("");
  const update = (idx: number, change: Partial<RecipeItem>) =>
    setItems(items.map((r, i) => (i === idx ? { ...r, ...change } : r)));
  const costs = items.map((r) => {
    const ing = data.ingredients.find((i) => i.id === r.ingredientId);
    return ing?.unitCost != null
      ? ing.unitCost * r.quantity * (factors[r.unit] ?? 0)
      : null;
  });
  const total = Math.round(
    Number(costs.reduce<number>((n, v) => n + (v ?? 0), 0).toFixed(4)),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (
      await mutate("recipe.save", {
        productId: product.id,
        complete,
        costPending,
        items,
      })
    )
      onClose();
    else setError("No se pudo guardar la receta. Revisa las porciones.");
  }
  return (
    <Drawer title={"Receta · " + product.name} onClose={onClose}>
      <form className="op-form" onSubmit={save}>
        {product.image && (
          <img className="op-recipe-photo" src={product.image} alt="" />
        )}
        {items.map((r, idx) => {
          const ing = data.ingredients.find((i) => i.id === r.ingredientId);
          return (
            <div className="op-line-item" key={idx}>
              <div className="op-form-grid">
                <Field label="Insumo">
                  <select
                    required
                    value={r.ingredientId}
                    onChange={(e) => {
                      const i = data.ingredients.find(
                        (v) => v.id === e.target.value,
                      )!;
                      update(idx, { ingredientId: i.id, unit: i.unit });
                    }}
                  >
                    {data.ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Categoría">
                  <select
                    value={r.category}
                    onChange={(e) =>
                      update(idx, {
                        category: e.target.value as RecipeItem["category"],
                      })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input
                    required
                    type="number"
                    step="any"
                    min=".0001"
                    value={r.quantity || ""}
                    onChange={(e) =>
                      update(idx, { quantity: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Unidad">
                  <select
                    value={r.unit}
                    onChange={(e) => update(idx, { unit: e.target.value })}
                  >
                    {units[ing?.unit ?? "g"].map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="op-row">
                <small>
                  Costo ·{" "}
                  {money(costs[idx] == null ? null : Math.round(costs[idx]!))}
                </small>
                <button
                  className="op-icon"
                  type="button"
                  aria-label={"Quitar ingrediente " + (idx + 1)}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        <button
          className="op-secondary"
          disabled={!data.ingredients.length}
          type="button"
          onClick={() => {
            const i = data.ingredients[0];
            setItems([
              ...items,
              {
                ingredientId: i.id,
                quantity: 1,
                unit: i.unit,
                category: "toppings",
              },
            ]);
          }}
        >
          <Plus size={16} /> Añadir insumo
        </button>
        {categories.map((c) => (
          <div key={c} className="op-row">
            <span>{c}</span>
            <b>
              {money(
                Math.round(
                  items.reduce(
                    (n, r, i) => n + (r.category === c ? (costs[i] ?? 0) : 0),
                    0,
                  ),
                ),
              )}
            </b>
          </div>
        ))}
        <div className="op-total">
          <span>
            {complete && !costs.includes(null)
              ? "Costo total"
              : "Costo parcial conocido"}
          </span>
          <strong>
            {money(costs.some((value) => value != null) ? total : null)}
          </strong>
        </div>
        <label className="op-check">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
          />{" "}
          Receta completa, con todos los gramajes y costos
        </label>
        <label className="op-check">
          <input
            type="checkbox"
            checked={costPending}
            onChange={(e) => setCostPending(e.target.checked)}
          />
          Costos pendientes de validación
        </label>
        {error && (
          <p className="op-error" role="alert">
            {error}
          </p>
        )}
        <Save />
      </form>
    </Drawer>
  );
}
function Simulator({ data }: { data: AdminData }) {
  const [selected, setSelected] = useState(""),
    p = data.products.find((p) => p.id === selected);
  const recipe = data.recipes.find((r) => r.productId === p?.id);
  const [inputs, setInputs] = useState({
    price: "",
    cost: "",
    platform: "0",
    processing: "",
    pack: "0",
    discount: "0",
    extra: "0",
    target: "30",
  });
  const fields = {
    price: "Precio de venta (MXN)",
    cost: "Costo de ingredientes (MXN)",
    platform: "Comisión de plataforma (%)",
    processing: "Procesamiento (%)",
    pack: "Empaque adicional (MXN)",
    discount: "Descuento (MXN)",
    extra: "Otros costos variables (MXN)",
    target: "Margen objetivo (%)",
  };
  const v = (k: keyof typeof fields) => Number(inputs[k]);
  const gross = v("price") - v("discount"),
    after = gross * (1 - (v("platform") + v("processing")) / 100),
    production = v("cost") + v("pack") + v("extra"),
    profit = after - production;
  const valid =
    Object.keys(fields).every(
      (k) =>
        inputs[k as keyof typeof fields] !== "" &&
        Number.isFinite(v(k as keyof typeof fields)) &&
        v(k as keyof typeof fields) >= 0,
    ) &&
    gross > 0 &&
    v("platform") + v("processing") <= 100;
  const targetBase = 1 - (v("platform") + v("processing") + v("target")) / 100;
  const out = (n: number) => (valid ? money(Math.round(n * 100)) : "Pendiente");
  return (
    <Panel title="Simulador de rentabilidad">
      <Field label="Pizza">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            const pd = data.products.find((x) => x.id === e.target.value),
              r = data.recipes.find((x) => x.productId === pd?.id);
            setInputs({
              ...inputs,
              price: pd ? String(pd.price / 100) : "",
              cost: r?.cost != null ? String(r.cost / 100) : "",
            });
          }}
        >
          <option value="">Escenario manual</option>
          {data.products
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </Field>
      {p && recipe?.cost == null && (
        <p className="op-hint">
          <AlertTriangle size={15} /> Receta parcial. Ingresa el costo total del
          escenario para calcular rentabilidad.
        </p>
      )}
      <div className="op-form-grid sim">
        {(Object.keys(fields) as (keyof typeof fields)[]).map((k) => (
          <Field key={k} label={fields[k]}>
            <input
              type="number"
              min={0}
              max={
                ["platform", "processing", "target"].includes(k)
                  ? 100
                  : undefined
              }
              step="any"
              value={inputs[k]}
              onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <div className="op-summary">
        {[
          ["Ingreso bruto", out(v("price"))],
          ["Ingreso tras descuentos y comisiones", out(after)],
          ["Costo de producción", out(production)],
          ["Utilidad por pizza", out(profit)],
          [
            "Margen",
            valid ? formatNum((profit / gross) * 100) + "%" : "Pendiente",
          ],
          [
            "Precio objetivo",
            targetBase > 0
              ? out(production / targetBase + v("discount"))
              : "Inviable",
          ],
        ].map(([a, b]) => (
          <div key={a}>
            <small>{a}</small>
            <strong>{b}</strong>
          </div>
        ))}
      </div>
      <h3>Comparación por canal</h3>
      {data.channels.map((ch) => (
        <div className="op-row" key={ch.id}>
          <span>{ch.name}</span>
          <small>
            {ch.commission == null ? "Comisión pendiente" : ch.commission + "%"}
          </small>
          <b>
            {ch.commission == null
              ? "Pendiente"
              : out(
                  gross * (1 - (ch.commission + v("processing")) / 100) -
                    production,
                )}
          </b>
        </div>
      ))}
    </Panel>
  );
}
export function Inventory({ data, mutate }: Props) {
  const [tab, setTab] = useState("Insumos"),
    [dialog, setDialog] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const close = () => {
    setDialog("");
    setSelected(null);
  };
  const ing = data.ingredients.find((i) => i.id === selected);
  return (
    <>
      <div className="op-tabs">
        {["Insumos", "Movimientos", "Producción de masa"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="op-tools">
        <button
          className="op-primary"
          onClick={() =>
            setDialog(tab === "Producción de masa" ? "dough" : "purchase")
          }
        >
          <Plus size={16} />
          {tab === "Producción de masa" ? "Nuevo lote" : "Registrar compra"}
        </button>
        {tab !== "Producción de masa" && (
          <>
            <button
              className="op-secondary"
              onClick={() => setDialog("movement")}
            >
              Registrar movimiento
            </button>
            <button
              className="op-secondary"
              onClick={() => setDialog("ingredient")}
            >
              Nuevo insumo
            </button>
          </>
        )}
      </div>
      {tab === "Insumos" && (
        <div className="op-resources">
          {data.ingredients.map((i) => (
            <Panel title={i.name} key={i.id} action={<Package size={20} />}>
              <div className="op-stock">
                <strong>
                  {formatNum(i.stock)} <small>{i.unit}</small>
                </strong>
                <span>
                  {i.stock <= i.minimum ? "Nivel crítico" : "En existencia"}
                </span>
                <progress
                  max={Math.max(i.minimum * 2, i.stock, 1)}
                  value={Math.max(0, i.stock)}
                  className={i.stock <= i.minimum ? "low" : ""}
                />
              </div>
              {i.referencePrice != null && (
                <p>Compra regular de referencia · {money(i.referencePrice)}</p>
              )}
              {(i.cheeseRole === "vegan" || i.referencePrice != null) && (
                <PortionCost data={data} ingredient={i} />
              )}
              <p className="op-muted">
                Mínimo · {formatNum(i.minimum)} {i.unit}
              </p>
              <div className="op-row">
                <small>Última presentación</small>
                <b>{i.presentation || "Pendiente"}</b>
              </div>
              <div className="op-row">
                <small>Precio de compra</small>
                <b>
                  {i.purchaseQuantity ? money(i.purchasePrice) : "Pendiente"}
                </b>
              </div>
              <div className="op-row">
                <small>Costo / {i.unit}</small>
                <b>
                  {i.unitCost != null
                    ? "$" + formatNum(i.unitCost / 100)
                    : "Pendiente"}
                </b>
              </div>
              <button
                className="op-secondary"
                onClick={() => {
                  setSelected(i.id);
                  setDialog("ingredient");
                }}
              >
                <Pencil size={14} /> Editar insumo
              </button>
            </Panel>
          ))}
        </div>
      )}
      {tab === "Movimientos" && (
        <Panel title="Historial de movimientos">
          {data.movements.length ? (
            <div className="op-tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Recurso</th>
                    <th>Movimiento</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((m) => (
                    <tr key={m.id}>
                      <td>{localStamp(m.date)}</td>
                      <td>
                        {data.ingredients.find((i) => i.id === m.ingredientId)
                          ?.name ?? "Masa"}
                      </td>
                      <td>{titles[m.type] ?? m.type}</td>
                      <td>{formatNum(m.quantity)}</td>
                      <td>{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aún no hay movimientos.</Empty>
          )}
        </Panel>
      )}
      {tab === "Producción de masa" && (
        <div className="op-resources">
          {data.dough.map((b, i) => (
            <Panel
              title={"Lote · " + dayKey(b.preparedAt)}
              key={b.id}
              action={<Wheat />}
            >
              <p className="op-badge">{titles[b.status] ?? b.status}</p>
              <div className="op-stock">
                <strong>
                  {b.remaining - (b.held ?? 0)} / {b.balls}{" "}
                  <small>bolas libres</small>
                </strong>
                <progress max={b.balls || 1} value={b.remaining} />
              </div>
              <div className="op-row">
                <small>Reservadas · utilizadas · merma</small>
                <b>
                  {b.held ?? 0} · {b.used ?? 0} · {b.waste ?? 0}
                </b>
              </div>
              <div className="op-row">
                <small>Peso por bola</small>
                <b>{b.ballWeight} g</b>
              </div>
              <div className="op-row">
                <small>Fermentación</small>
                <b>{b.fermentHours} h</b>
              </div>
              <div className="op-row">
                <small>Caducidad</small>
                <b>{localStamp(b.expiresAt)}</b>
              </div>
              <div className="op-form">
                <Field label={"Estado del lote " + (i + 1)}>
                  <select
                    value={b.status}
                    onChange={(e) =>
                      void mutate("dough.status", {
                        id: b.id,
                        status: e.target.value,
                      })
                    }
                  >
                    {[
                      "preparing",
                      "fermenting",
                      "ready",
                      "waste",
                      ...([
                        "preparing",
                        "fermenting",
                        "ready",
                        "waste",
                      ].includes(b.status)
                        ? []
                        : [b.status]),
                    ].map((v) => (
                      <option key={v} value={v}>
                        {titles[v] ?? v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Panel>
          ))}
          {!data.dough.length && (
            <Empty>Registra el primer lote de masa.</Empty>
          )}
        </div>
      )}
      {dialog && (
        <Drawer
          title={
            dialog === "ingredient"
              ? ing
                ? "Editar insumo"
                : "Nuevo insumo"
              : dialog === "purchase"
                ? "Registrar compra"
                : dialog === "dough"
                  ? "Nuevo lote de masa"
                  : "Registrar movimiento"
          }
          onClose={close}
        >
          {dialog === "dough" ? (
            <DoughForm mutate={mutate} onClose={close} />
          ) : (
            <StockForm
              data={data}
              mutate={mutate}
              type={dialog}
              ingredient={ing}
              onClose={close}
            />
          )}
        </Drawer>
      )}
    </>
  );
}
function StockForm({
  data,
  mutate,
  type,
  ingredient,
  onClose,
}: Props & { type: string; ingredient?: Ingredient; onClose: () => void }) {
  const [pick, setPick] = useState(
      ingredient?.id ?? data.ingredients[0]?.id ?? "",
    ),
    i = data.ingredients.find((x) => x.id === pick);
  const [error, setError] = useState(""),
    [base, setBase] = useState<Ingredient["unit"]>(ingredient?.unit ?? "g");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let action: string, payload: object;
    if (type === "ingredient") {
      action = "ingredient.save";
      payload = {
        ...(ingredient ? { id: ingredient.id } : {}),
        name: formText(f, "name"),
        supplier: formText(f, "supplier"),
        presentation: formText(f, "presentation"),
        unit: base,
        minimum: Number(f.get("minimum")),
        purchaseQuantity: Number(f.get("purchaseQuantity")),
        purchasePrice: amount(f.get("purchasePrice")),
        purchaseDate: formText(f, "purchaseDate") || null,
        purchaseUnit: formText(f, "purchaseUnit"),
      };
    } else if (type === "purchase") {
      action = "purchase.create";
      payload = {
        ingredientId: pick,
        quantity: Number(f.get("quantity")),
        unit: formText(f, "unit"),
        price: amount(f.get("price")),
        supplier: formText(f, "supplier"),
        date: formText(f, "date"),
      };
    } else {
      action = "movement.create";
      payload = {
        ingredientId: pick,
        type: formText(f, "type"),
        quantity: Number(f.get("quantity")),
        reason: formText(f, "reason"),
      };
    }
    if (await mutate(action, payload)) onClose();
    else
      setError(
        "No se pudo registrar la operación. Revisa los valores y la existencia disponible.",
      );
  }
  return (
    <form className="op-form" onSubmit={submit}>
      {type === "ingredient" ? (
        <>
          <Field label="Nombre del insumo">
            <input required name="name" defaultValue={ingredient?.name} />
          </Field>
          <Field label="Proveedor">
            <input name="supplier" defaultValue={ingredient?.supplier} />
          </Field>
          <Field label="Presentación de compra">
            <input
              name="presentation"
              defaultValue={ingredient?.presentation}
            />
          </Field>
          <Field label="Unidad base">
            <select
              value={base}
              disabled={!!ingredient}
              onChange={(e) => setBase(e.target.value as Ingredient["unit"])}
            >
              {Object.keys(units).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label={"Nivel mínimo (" + base + ")"}>
            <input
              type="number"
              min={0}
              step="any"
              required
              name="minimum"
              defaultValue={ingredient?.minimum ?? 0}
            />
          </Field>
          <Field label="Cantidad de la presentación">
            <input
              type="number"
              min={0}
              step="any"
              name="purchaseQuantity"
              defaultValue={ingredient?.purchaseQuantity ?? 0}
            />
          </Field>
          <Field label="Unidad de compra">
            <select
              key={base}
              name="purchaseUnit"
              defaultValue={ingredient?.purchaseUnit ?? base}
            >
              {units[base].map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio de compra (MXN)">
            <input
              type="number"
              min={0}
              step=".01"
              name="purchasePrice"
              defaultValue={ingredient ? ingredient.purchasePrice / 100 : ""}
            />
          </Field>
          <Field label="Fecha de referencia">
            <input
              type="date"
              name="purchaseDate"
              defaultValue={ingredient?.purchaseDate ?? ""}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Insumo">
            <select
              required
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              {data.ingredients.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={
              type === "purchase"
                ? "Cantidad comprada"
                : "Cantidad (" + (i?.unit ?? "unidad base") + ")"
            }
          >
            <input
              required
              name="quantity"
              type="number"
              min={type === "purchase" ? 0.0001 : undefined}
              step="any"
            />
          </Field>
          {type === "purchase" ? (
            <>
              <Field label="Unidad de compra">
                <select
                  name="unit"
                  key={pick}
                  defaultValue={i?.purchaseUnit ?? i?.unit}
                >
                  {units[i?.unit ?? "g"].map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Precio total de compra (MXN)">
                <input
                  name="price"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                />
              </Field>
              <Field label="Proveedor">
                <input name="supplier" key={pick} defaultValue={i?.supplier} />
              </Field>
              <Field label="Fecha de compra">
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={dayKey()}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Tipo de movimiento">
                <select name="type">
                  {[
                    "consumption",
                    "waste",
                    "adjustment",
                    "production",
                    "reversal",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {titles[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo del movimiento">
                <textarea name="reason" required />
              </Field>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      <Save label={type === "purchase" ? "Registrar compra" : "Guardar"} />
      {type === "ingredient" && ingredient && (
        <section>
          <h3>Historial de precios de compra</h3>
          {data.purchases
            .filter((v) => v.ingredientId === ingredient.id)
            .map((v) => (
              <div className="op-row" key={v.id}>
                <span>
                  {dayKey(v.date)}
                  <small>
                    {formatNum(v.quantity)} {unitLabel(v.unit)} ·{" "}
                    {v.supplier || "Proveedor sin registrar"}
                  </small>
                </span>
                <b>{money(v.price)}</b>
              </div>
            ))}
          {!data.purchases.some((v) => v.ingredientId === ingredient.id) && (
            <Empty>Aún no hay compras registradas.</Empty>
          )}
        </section>
      )}
    </form>
  );
}
function DoughForm({
  mutate,
  onClose,
}: {
  mutate: Mutate;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const numeric = Object.fromEntries(
      [
        "flour",
        "hydration",
        "yeast",
        "salt",
        "ballWeight",
        "balls",
        "fermentHours",
      ].map((k) => [k, Number(f.get(k))]),
    );
    if (
      await mutate("dough.save", {
        ...numeric,
        preparedAt: stamp(formText(f, "preparedAt")),
        fermentStart: stamp(formText(f, "fermentStart")),
        expiresAt: stamp(formText(f, "expiresAt")),
        status: formText(f, "status"),
      })
    )
      onClose();
    else
      setError("No se pudo guardar el lote. Revisa las fechas y cantidades.");
  }
  return (
    <form className="op-form" onSubmit={submit}>
      <div className="op-form-grid">
        {[
          ["preparedAt", "Preparación"],
          ["fermentStart", "Inicio de fermentación"],
          ["expiresAt", "Caducidad operativa"],
        ].map(([k, t]) => (
          <Field key={k} label={t + " (Cancún)"}>
            <input
              type="datetime-local"
              required
              name={k}
              defaultValue={
                k === "expiresAt" ? "" : inputStamp(new Date().toISOString())
              }
            />
          </Field>
        ))}
        {[
          ["flour", "Harina (g)"],
          ["hydration", "Hidratación (%)"],
          ["yeast", "Levadura (g)"],
          ["salt", "Sal (g)"],
          ["ballWeight", "Peso por bola (g)"],
          ["balls", "Número de bolas"],
          ["fermentHours", "Fermentación (horas)"],
        ].map(([k, t]) => (
          <Field label={t} key={k}>
            <input
              type="number"
              name={k}
              required
              min={k === "balls" ? 1 : 0}
              step={k === "balls" ? 1 : "any"}
            />
          </Field>
        ))}
      </div>
      <Field label="Estado inicial">
        <select name="status">
          {["preparing", "fermenting", "ready"].map((s) => (
            <option value={s} key={s}>
              {titles[s]}
            </option>
          ))}
        </select>
      </Field>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      <Save label="Registrar lote" />
    </form>
  );
}
