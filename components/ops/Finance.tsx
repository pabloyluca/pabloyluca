"use client";
import { useState, type FormEvent } from "react";
import { Download, Paperclip, Pencil, Plus } from "lucide-react";
import type { AdminData } from "@/lib/contracts";
import {
  amount,
  DateFilters,
  dayKey,
  Drawer,
  Empty,
  Field,
  formatNum,
  knownSum,
  money,
  Panel,
  periodSales,
  Save,
  sum,
  upload,
  type Mutate,
  type Range,
} from "./shared";

const expenseCats: Record<string, string> = {
  inventory: "Compra de inventario",
  equipment: "Equipamiento",
  packaging: "Empaques operativos",
  services: "Servicios",
  marketing: "Marketing",
  fees: "Comisiones adicionales",
  other: "Otros gastos",
};
type Props = {
  data: AdminData;
  range: Range;
  onRange: (range: Range) => void;
  mutate: Mutate;
  reports: boolean;
};
export function Finance({ data, range, onRange, mutate, reports }: Props) {
  const [dialog, setDialog] = useState("");
  const sales = periodSales(data, range),
    expenses = data.expenses.filter(
      (e) => dayKey(e.date) >= range.from && dayKey(e.date) <= range.to,
    );
  const gross = sum(sales, "gross"),
    discount = sum(sales, "discount"),
    refund = sum(sales, "refund"),
    net = gross - discount - refund,
    fees = knownSum(sales, "fee"),
    costs = knownSum(sales, "cost");
  const byCategory = (cat: string) =>
    expenses
      .filter((e) => e.category === cat)
      .reduce((n, x) => n + x.amount, 0);
  const opEx = expenses
    .filter((e) => !["inventory", "equipment"].includes(e.category))
    .reduce((n, e) => n + e.amount, 0);
  const contribution = costs == null ? null : net - costs;
  const operating =
    range.channel || contribution == null || fees == null
      ? null
      : contribution - fees - opEx;
  const rows = [
    ["Ventas brutas", money(gross)],
    ["Descuentos", money(discount)],
    ["Reembolsos", money(refund)],
    ["Ventas netas", money(net)],
    ["Comisiones", money(fees)],
    ["Costo de producción", money(costs)],
    ["Utilidad bruta", money(contribution)],
    [
      "Gastos operativos",
      range.channel ? "Sin asignar por canal" : money(opEx),
    ],
    ["Utilidad operativa estimada", money(operating)],
    [
      "Margen operativo",
      operating == null || net <= 0
        ? "Pendiente"
        : formatNum((operating / net) * 100) + "%",
    ],
  ];
  const download =
    "/api/reports?" +
    new URLSearchParams({
      from: range.from,
      to: range.to,
      ...(range.channel ? { channel: range.channel } : {}),
    });
  return (
    <>
      <DateFilters range={range} onChange={onRange} channels={data.channels} />
      <div className="op-tools">
        {!reports && (
          <>
            <button className="op-primary" onClick={() => setDialog("sale")}>
              <Plus size={16} /> Registrar venta externa
            </button>
            <button
              className="op-secondary"
              onClick={() => setDialog("expense")}
            >
              <Plus size={16} /> Registrar gasto
            </button>
          </>
        )}
        <a className="op-secondary" href={download} download>
          <Download size={16} /> Exportar CSV
        </a>
      </div>
      <Panel title={reports ? "Resultados del periodo" : "Resumen financiero"}>
        <div className="op-summary">
          {rows.map(([label, v]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <div className="op-config">
        <Panel title="Resultados por canal">
          {data.channels
            .filter((c) => !range.channel || c.id === range.channel)
            .map((c) => {
              const rows = sales.filter((s) => s.channel === c.id);
              return (
                <div className="op-row" key={c.id}>
                  <span>
                    {c.name}
                    <small>{rows.length} ventas</small>
                  </span>
                  <b>
                    {money(
                      sum(rows, "gross") -
                        sum(rows, "discount") -
                        sum(rows, "refund"),
                    )}
                  </b>
                </div>
              );
            })}
        </Panel>
        <Panel title="Flujo de efectivo">
          <div className="op-row">
            <span>Compras de inventario</span>
            <b>{money(byCategory("inventory"))}</b>
          </div>
          <div className="op-row">
            <span>Equipamiento</span>
            <b>{money(byCategory("equipment"))}</b>
          </div>
          <div className="op-row">
            <span>Gastos operativos del negocio</span>
            <b>{money(opEx)}</b>
          </div>
          <p className="op-muted">
            Las compras se registran al pagar. El costo de producción
            corresponde al consumo de las ventas.
          </p>
        </Panel>
      </div>
      {!reports && (
        <Panel title="Comisiones por canal">
          {data.channels.map((c) => (
            <button
              className="op-editrow"
              key={c.id}
              onClick={() => setDialog("channel:" + c.id)}
            >
              <span>{c.name}</span>
              <b>{c.commission == null ? "Sin definir" : c.commission + "%"}</b>
              <Pencil size={14} />
            </button>
          ))}
        </Panel>
      )}
      <Panel title="Registro de ventas">
        {sales.length ? (
          <div className="op-tablewrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Fecha",
                    "Canal",
                    "Pizzas",
                    "Bruto",
                    "Descuento",
                    "Reembolso",
                    "Comisión",
                    "Costo histórico",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>{dayKey(s.date)}</td>
                    <td>
                      {data.channels.find((c) => c.id === s.channel)?.name ??
                        s.channel}
                    </td>
                    <td>{s.units}</td>
                    <td>{money(s.gross)}</td>
                    <td>{money(s.discount)}</td>
                    <td>{money(s.refund)}</td>
                    <td>{money(s.fee)}</td>
                    <td>{money(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Sin ventas en el periodo seleccionado.</Empty>
        )}
      </Panel>
      <Panel title="Gastos del negocio">
        {expenses.length ? (
          <div className="op-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Importe</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{dayKey(e.date)}</td>
                    <td>{e.name}</td>
                    <td>{expenseCats[e.category] ?? e.category}</td>
                    <td>{money(e.amount)}</td>
                    <td>
                      {e.receipt ? (
                        <a
                          className="op-secondary"
                          href={e.receipt}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Paperclip size={13} /> Abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Sin gastos registrados para este periodo.</Empty>
        )}
      </Panel>
      {dialog && (
        <FinanceEditor
          type={dialog}
          data={data}
          mutate={mutate}
          onClose={() => setDialog("")}
        />
      )}
    </>
  );
}
function FinanceEditor({
  type,
  data,
  mutate,
  onClose,
}: {
  type: string;
  data: AdminData;
  mutate: Mutate;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const c = data.channels.find((c) => "channel:" + c.id === type);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setWorking(true);
    setError("");
    try {
      let action: string, payload: object;
      if (c) {
        action = "channel.save";
        payload = {
          id: c.id,
          commission:
            f.get("commission") === "" ? null : Number(f.get("commission")),
        };
      } else if (type === "sale") {
        action = "sale.create";
        payload = {
          channel: f.get("channel"),
          gross: amount(f.get("gross")),
          discount: amount(f.get("discount")),
          fee: f.get("fee") === "" ? null : amount(f.get("fee")),
          cost: f.get("cost") === "" ? null : amount(f.get("cost")),
          units: Number(f.get("units")),
          date: new Date(
            String(f.get("date")) + "T12:00:00-05:00",
          ).toISOString(),
        };
      } else {
        let receipt = "";
        const file = f.get("receipt");
        if (file instanceof File && file.size > 0)
          receipt = await upload(file, "receipt");
        action = "expense.create";
        payload = {
          name: String(f.get("name")),
          category: f.get("category"),
          amount: amount(f.get("amount")),
          date: f.get("date"),
          receipt,
        };
      }
      if (await mutate(action, payload)) onClose();
      else setError("No se pudo registrar el movimiento. Revisa los campos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <Drawer
      title={
        c
          ? "Comisión · " + c.name
          : type === "sale"
            ? "Registrar venta externa"
            : "Registrar gasto"
      }
      onClose={onClose}
    >
      <form className="op-form" onSubmit={save}>
        {c ? (
          <Field label="Comisión de plataforma (%)">
            <input
              type="number"
              name="commission"
              min={0}
              max={100}
              step="any"
              defaultValue={c.commission ?? ""}
            />
          </Field>
        ) : type === "sale" ? (
          <>
            <Field label="Canal">
              <select required name="channel">
                {data.channels
                  .filter((c) => c.id !== "store")
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Fecha">
              <input name="date" required type="date" defaultValue={dayKey()} />
            </Field>
            <Field label="Pizzas vendidas">
              <input type="number" name="units" min={0} step="1" required />
            </Field>
            {[
              ["gross", "Venta bruta (MXN)"],
              ["discount", "Descuento (MXN)"],
              ["fee", "Comisión real (MXN)"],
              ["cost", "Costo de producción validado (MXN)"],
            ].map(([k, t]) => (
              <Field label={t} key={k}>
                <input
                  type="number"
                  name={k}
                  min={0}
                  step=".01"
                  required={k === "gross" || k === "discount"}
                  defaultValue={k === "discount" ? 0 : undefined}
                  placeholder={
                    k === "cost" || k === "fee" ? "Pendiente" : undefined
                  }
                />
              </Field>
            ))}
          </>
        ) : (
          <>
            <Field label="Concepto">
              <input name="name" required />
            </Field>
            <Field label="Categoría">
              <select name="category">
                {Object.entries(expenseCats).map(([k, t]) => (
                  <option value={k} key={k}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Importe (MXN)">
              <input
                name="amount"
                type="number"
                min=".01"
                step=".01"
                required
              />
            </Field>
            <Field label="Fecha">
              <input name="date" required type="date" defaultValue={dayKey()} />
            </Field>
            <Field label="Comprobante opcional">
              <input
                name="receipt"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
              />
            </Field>
          </>
        )}
        {error && (
          <p className="op-error" role="alert">
            {error}
          </p>
        )}
        <Save busy={working} />
      </form>
    </Drawer>
  );
}
