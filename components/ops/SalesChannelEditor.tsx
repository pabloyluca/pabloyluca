"use client";
import { useState } from "react";
import type { AdminData } from "@/lib/contracts";
import {
  defaultDirect,
  defaultPlatform,
  platformIds,
  platformNames,
  savingsRange,
  type PlatformId,
  type PlatformCard,
} from "@/lib/sales-channels";
import { Field, Panel, Save, money, type Mutate } from "./shared";

function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (value: boolean) => void;
}) {
  return (
    <label className="op-check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => change(e.target.checked)}
      />
      {label}
    </label>
  );
}

const directLabels = {
  eyebrow: "Antetítulo",
  heading: "Encabezado",
  promo: "Texto promocional",
  coverage: "Texto de cobertura",
  cta: "CTA de venta directa",
  closed: "Mensaje de cocina cerrada",
} as const;
const platformLabels = {
  description: "Descripción",
  cta: "Texto del CTA",
  legend: "Leyenda alternativa",
} as const;

export function SalesChannelEditor({
  data,
  mutate,
  busy,
}: {
  data: AdminData;
  mutate: Mutate;
  busy: boolean;
}) {
  const row = (id: string) =>
    data.channels.find((channel) => channel.id === id);
  const [direct, setDirect] = useState(() => ({
    ...defaultDirect,
    ...row("store")?.presentation,
  }));
  const [delivery, setDelivery] = useState(data.settings.delivery);
  const [platforms, setPlatforms] = useState(() =>
    platformIds
      .map((id) => ({
        id,
        card: { ...defaultPlatform(id), ...row(id)?.presentation },
        prices: { ...row(id)?.productPrices },
      }))
      .sort((a, b) => a.card.position - b.card.position),
  );
  const [saved, setSaved] = useState(false);
  function changeCard(id: PlatformId, patch: Partial<PlatformCard>) {
    setPlatforms((list) =>
      list.map((p) =>
        p.id === id ? { ...p, card: { ...p.card, ...patch } } : p,
      ),
    );
  }
  function move(index: number, delta: number) {
    setPlatforms((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
    setSaved(false);
  }
  const maximum = savingsRange(
    data.products,
    platforms.map((p) => p.prices),
  );
  return (
    <form
      className="op-channel-editor"
      onChange={() => setSaved(false)}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(
          await mutate("channel.presentation", {
            direct,
            delivery,
            platforms: platforms.map((p, position) => ({
              ...p,
              card: { ...p.card, position },
            })),
          }),
        );
      }}
    >
      <Panel title="Venta directa">
        <div className="op-channel-checks">
          <Toggle
            label="Mostrar banner"
            value={direct.visible}
            change={(visible) => setDirect({ ...direct, visible })}
          />
          <Toggle
            label="Mostrar porcentaje"
            value={direct.showPercent}
            change={(showPercent) => setDirect({ ...direct, showPercent })}
          />
          <Toggle
            label="Activar entregas directas"
            value={delivery}
            change={setDelivery}
          />
        </div>
        <div className="op-form-grid">
          {Object.entries(directLabels).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                required
                maxLength={160}
                value={direct[key as keyof typeof directLabels]}
                onChange={(e) =>
                  setDirect({ ...direct, [key]: e.target.value })
                }
              />
            </Field>
          ))}
          <Field label="Ahorro anunciado (%)">
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={direct.percent}
              onChange={(e) =>
                setDirect({ ...direct, percent: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        {direct.showPercent && (
          <p className="op-hint" role="status">
            {maximum === null
              ? "Faltan precios por plataforma para verificar el ahorro anunciado."
              : Math.abs(direct.percent - maximum) > 0.005
                ? "Revisa el porcentaje anunciado. El ahorro máximo con los precios configurados es " +
                  maximum.toFixed(2) +
                  "%."
                : "El ahorro anunciado coincide con los precios configurados."}
          </p>
        )}
      </Panel>
      {platforms.map(({ id, card, prices }, index) => (
        <Panel
          key={id}
          title={platformNames[id]}
          action={
            <div className="op-channel-actions">
              <button
                type="button"
                disabled={!index}
                aria-label={"Subir " + platformNames[id]}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === platforms.length - 1}
                aria-label={"Bajar " + platformNames[id]}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </div>
          }
        >
          <div className="op-channel-checks">
            <Toggle
              label="Mostrar tarjeta"
              value={card.visible}
              change={(visible) => changeCard(id, { visible })}
            />
            <Toggle
              label="Aceptar pedidos en la plataforma"
              value={card.enabled}
              change={(enabled) => changeCard(id, { enabled })}
            />
            <Toggle
              label="Incluye envío"
              value={card.includesShipping}
              change={(includesShipping) =>
                changeCard(id, { includesShipping })
              }
            />
          </div>
          <div className="op-form-grid">
            <Field label="URL de la sucursal">
              <input
                type="url"
                maxLength={1500}
                pattern="https://.+"
                placeholder="https://"
                value={card.url}
                onChange={(e) => changeCard(id, { url: e.target.value })}
              />
            </Field>
            {Object.entries(platformLabels).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  required={key !== "legend"}
                  maxLength={160}
                  value={card[key as keyof typeof platformLabels]}
                  onChange={(e) => changeCard(id, { [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <details>
            <summary>
              Precios por pizza · Comisión ERP {row(id)?.commission ?? "—"}%
            </summary>
            <div className="op-form-grid">
              {data.products
                .filter((p) => !p.archived)
                .map((p) => (
                  <Field
                    key={p.id}
                    label={p.name + " · Directo " + money(p.price)}
                  >
                    <input
                      aria-label={platformNames[id] + " · " + p.name + " (MXN)"}
                      type="number"
                      min=".01"
                      step=".01"
                      max="1000000"
                      placeholder="Precio en plataforma (MXN)"
                      value={
                        prices[p.id] === undefined ? "" : prices[p.id] / 100
                      }
                      onChange={(e) => {
                        const next = { ...prices };
                        if (e.target.value === "") delete next[p.id];
                        else
                          next[p.id] = Math.round(Number(e.target.value) * 100);
                        setPlatforms((list) =>
                          list.map((item) =>
                            item.id === id ? { ...item, prices: next } : item,
                          ),
                        );
                      }}
                    />
                  </Field>
                ))}
            </div>
          </details>
        </Panel>
      ))}
      <div>
        <Save busy={busy} label="Guardar canales" />
        {saved && <span role="status"> Canales guardados.</span>}
      </div>
    </form>
  );
}
