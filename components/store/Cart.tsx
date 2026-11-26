"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Pencil,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import type {
  CartLine,
  CheckoutInput,
  CheckoutResult,
  Menu,
  Mode,
} from "@/lib/contracts";
import { Dialog } from "./Dialog";
import { linePrice, cartQuote, money, requestJson } from "./utils";

interface Props {
  menu: Menu;
  cart: CartLine[];
  onClose: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  sandbox: boolean;
  refresh: () => void;
  online: boolean;
}
export function Cart({
  menu,
  cart,
  onClose,
  onEdit,
  onRemove,
  sandbox,
  refresh,
  online,
}: Props) {
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [mode, setMode] = useState<Mode>(
    menu.settings.pickup ? "pickup" : "delivery",
  );
  const [postcode, setPostcode] = useState("");
  const [zoneChoice, setZoneChoice] = useState("");
  const [promo, setPromo] = useState("");
  const [code, setCode] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const zones = menu.zones.filter(
    (z) => z.enabled && z.postcodes.includes(postcode.trim()),
  );
  const zone =
    zones.find((z) => z.id === zoneChoice) ??
    (zones.length === 1 ? zones[0] : undefined);
  const fee = mode === "delivery" ? (zone?.fee ?? 0) : 0;
  const quote = cartQuote(menu, cart, promo, fee);
  const validMode =
    mode === "pickup"
      ? menu.settings.pickup
      : menu.settings.delivery && menu.zones.some((z) => z.enabled);
  const invalid = cart.some((line) => {
    const product = menu.products.find((p) => p.id === line.productId);
    return (
      !product?.available ||
      (line.cheese
        ? !product.veganAvailable
        : product.standardAvailable === false) ||
      line.removed.some((i) => !product.removable.includes(i))
    );
  });
  const delivery = menu.settings.delivery && menu.zones.some((z) => z.enabled);
  const blocked =
    !menu.settings.open ||
    !cart.length ||
    invalid ||
    !online ||
    (!menu.settings.pickup && !delivery);
  function applyPromo() {
    const active = cartQuote(menu, cart, code, fee).promotion;
    setPromo(active ? active.code : "");
    setCouponMsg(
      active
        ? `Aplicado · ${active.percent}% de descuento`
        : "Código no disponible.",
    );
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || blocked || !validMode || (mode === "delivery" && !zone)) return;
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    const input: CheckoutInput = {
      expectedTotal: quote.total,
      items: cart,
      name: value("name"),
      phone: value("phone"),
      email: value("email"),
      mode,
      notes: value("notes"),
      promoCode: promo || undefined,
      ...(mode === "delivery"
        ? {
            address: value("address"),
            postcode: postcode.trim(),
            zoneId: zone?.id,
            references: value("references"),
          }
        : {}),
    };
    try {
      const hashArray = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(input)),
      );
      const fingerprint = Array.from(new Uint8Array(hashArray))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      let key = crypto.randomUUID() as string;
      try {
        const previous = JSON.parse(
          sessionStorage.getItem("pl:pending-checkout") || "null",
        );
        if (
          previous?.fingerprint === fingerprint &&
          typeof previous.key === "string" &&
          Date.now() - previous.since < 15 * 60000
        )
          key = previous.key;
        sessionStorage.setItem(
          "pl:pending-checkout",
          JSON.stringify({ fingerprint, key, since: Date.now() }),
        );
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
      const result = await requestJson<CheckoutResult & { paymentUrl: string }>(
        "/api/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(input),
        },
      );
      if (!result.paymentUrl)
        throw new Error(
          "El proveedor aún no generó el enlace de pago. Vuelve a intentar.",
        );
      try {
        sessionStorage.setItem(
          "pl:submitted-cart",
          JSON.stringify({ token: result.token, cart: JSON.stringify(cart) }),
        );
      } catch {
        /* The payment flow is independent of storage. */
      }
      window.location.assign(result.paymentUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar el pago.");
      refresh();
      setBusy(false);
    }
  }
  const totals = (
    <dl className="pl-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(quote.subtotal)}</dd>
      </div>
      <div>
        <dt>
          {step === "cart"
            ? "Envío"
            : mode === "pickup"
              ? "Recolección"
              : "Envío"}
        </dt>
        <dd>
          {step === "cart"
            ? delivery
              ? "Se calcula en entrega"
              : "$0"
            : mode === "delivery" && !zone
              ? "Por calcular"
              : money(fee)}
        </dd>
      </div>
      {quote.discount > 0 && (
        <div>
          <dt>Descuento</dt>
          <dd>−{money(quote.discount)}</dd>
        </div>
      )}
      <div className="pl-total">
        <dt>
          {step === "cart" && delivery ? "Total antes de envío" : "Total"}
        </dt>
        <dd>
          <small>MXN</small>
          {money(quote.total)}
        </dd>
      </div>
    </dl>
  );
  return (
    <Dialog
      title={step === "checkout" ? "Entrega y pago" : "Tu carrito"}
      onClose={() => {
        if (!busy) onClose();
      }}
      variant="side"
    >
      <div className="pl-dialog-body">
        {!cart.length ? (
          <div className="pl-empty">
            <ShoppingBag size={42} />
            <h3>Tu carrito está vacío</h3>
            <p>Elige una pizza del menú para empezar.</p>
            <button className="pl-primary" onClick={onClose}>
              Explorar el menú
            </button>
          </div>
        ) : (
          <>
            {step === "cart" ? (
              <>
                <ul className="pl-cart-lines">
                  {cart.map((line, i) => {
                    const product = menu.products.find(
                      (p) => p.id === line.productId,
                    );
                    return (
                      <li key={i}>
                        {product && <img src={product.image} alt="" />}
                        <div>
                          <h3>
                            {line.quantity} ×{" "}
                            {product?.name ?? "Producto retirado"}
                          </h3>
                          {line.cheese && (
                            <p>
                              Queso vegano +
                              {money(menu.settings.veganSurcharge ?? 0)}
                            </p>
                          )}
                          {line.removed.length > 0 && (
                            <p>Sin {line.removed.join(", ")}</p>
                          )}
                          {line.note && <p>{line.note}</p>}
                          {!product?.available && (
                            <p className="pl-danger">Ya no está disponible.</p>
                          )}
                          <div className="pl-line-actions">
                            {product && (
                              <button
                                onClick={() => onEdit(i)}
                                aria-label={`Editar ${product.name}`}
                              >
                                <Pencil size={13} />
                                Editar
                              </button>
                            )}
                            <button
                              aria-label={`Eliminar ${product?.name ?? "pizza"}`}
                              onClick={() => onRemove(i)}
                            >
                              <Trash2 size={13} />
                              Eliminar
                            </button>
                          </div>
                        </div>
                        <strong>
                          {money(linePrice(menu, line) * line.quantity)}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
                <details className="pl-promo">
                  <summary>¿Tienes un código de promoción?</summary>
                  <div>
                    <input
                      aria-label="Código de promoción"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={48}
                    />
                    <button type="button" onClick={applyPromo}>
                      Aplicar
                    </button>
                  </div>
                  {couponMsg && <p role="status">{couponMsg}</p>}
                </details>
                {totals}
                <button
                  className="pl-primary pl-wide"
                  disabled={blocked}
                  onClick={() => {
                    setStep("checkout");
                    setError("");
                  }}
                >
                  Continuar a entrega <ArrowRight size={17} />
                </button>
              </>
            ) : (
              <form onSubmit={checkout} className="pl-checkout">
                <button
                  className="pl-back"
                  type="button"
                  disabled={busy}
                  onClick={() => setStep("cart")}
                >
                  <ArrowLeft size={14} />
                  Volver al carrito
                </button>
                <details className="pl-checkout-items">
                  <summary>
                    Ver pizzas y personalizaciones (
                    {cart.reduce((sum, line) => sum + line.quantity, 0)})
                  </summary>
                  <ul className="pl-cart-lines">
                    {cart.map((line, index) => {
                      const product = menu.products.find(
                        (p) => p.id === line.productId,
                      );
                      return (
                        <li key={index}>
                          {product && <img src={product.image} alt="" />}
                          <div>
                            <h3>
                              {line.quantity} × {product?.name}
                            </h3>
                            {line.cheese && (
                              <p>
                                Queso vegano +
                                {money(menu.settings.veganSurcharge ?? 0)}
                              </p>
                            )}
                            {line.removed.length > 0 && (
                              <p>Sin {line.removed.join(", ")}</p>
                            )}
                            {line.note && <p>{line.note}</p>}
                          </div>
                          <strong>
                            {money(linePrice(menu, line) * line.quantity)}
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                </details>
                <fieldset className="pl-modes">
                  <legend>¿Cómo quieres recibir tu pedido?</legend>
                  {menu.settings.pickup && (
                    <button
                      type="button"
                      className={mode === "pickup" ? "selected" : ""}
                      onClick={() => setMode("pickup")}
                    >
                      <Store />
                      Recolección{mode === "pickup" && <Check size={14} />}
                    </button>
                  )}
                  {delivery && (
                    <button
                      type="button"
                      className={mode === "delivery" ? "selected" : ""}
                      onClick={() => setMode("delivery")}
                    >
                      <Truck />A domicilio
                      {mode === "delivery" && <Check size={14} />}
                    </button>
                  )}
                </fieldset>
                <label className="pl-field">
                  Nombre
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <div className="pl-field-pair">
                  <label className="pl-field">
                    Teléfono
                    <input
                      name="phone"
                      required
                      type="tel"
                      autoComplete="tel"
                      minLength={8}
                      maxLength={20}
                    />
                  </label>
                  <label className="pl-field">
                    Correo electrónico
                    <input
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      maxLength={180}
                    />
                  </label>
                </div>
                {mode === "delivery" && (
                  <>
                    <label className="pl-field">
                      Código postal
                      <input
                        required
                        autoComplete="postal-code"
                        value={postcode}
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        onChange={(e) => {
                          setPostcode(e.target.value);
                          setZoneChoice("");
                        }}
                      />
                    </label>
                    {postcode.length === 5 &&
                      (zones.length === 0 ? (
                        <p className="pl-danger">
                          Este código postal está fuera de cobertura.
                        </p>
                      ) : zones.length === 1 ? (
                        <p className="pl-note">
                          {zone?.name} · Envío {money(fee)}
                        </p>
                      ) : (
                        <label className="pl-field">
                          Zona de entrega
                          <select
                            required
                            value={zoneChoice}
                            onChange={(e) => setZoneChoice(e.target.value)}
                          >
                            <option value="">Selecciona tu zona</option>
                            {zones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name} · {money(z.fee)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    <label className="pl-field">
                      Dirección
                      <input
                        required
                        minLength={5}
                        name="address"
                        autoComplete="street-address"
                        maxLength={250}
                        placeholder="Calle, número y colonia"
                      />
                    </label>
                    <label className="pl-field">
                      Referencias de entrega <span>Opcional</span>
                      <input name="references" maxLength={250} />
                    </label>
                  </>
                )}
                <label className="pl-field">
                  Notas del pedido <span>Opcional</span>
                  <textarea name="notes" rows={2} maxLength={300} />
                </label>
                {totals}
                {sandbox && (
                  <p className="pl-note">
                    Pedido de prueba en sandbox. El pago se simulará sin cargo.
                  </p>
                )}
                <button
                  className="pl-primary pl-wide"
                  disabled={
                    blocked ||
                    busy ||
                    !validMode ||
                    (mode === "delivery" && !zone)
                  }
                >
                  <CreditCard size={17} />
                  {busy
                    ? "Preparando pago…"
                    : sandbox
                      ? "Continuar al pago de prueba"
                      : "Pagar con Mercado Pago"}
                </button>
              </form>
            )}
            {blocked && (
              <p className="pl-danger" role="status">
                {!online
                  ? "Sin conexión. Recupera la red para continuar."
                  : !menu.settings.open
                    ? "La cocina está cerrada. Conservaremos tu carrito."
                    : invalid
                      ? "Revisa los productos que cambiaron antes de continuar."
                      : "La cocina todavía no tiene modalidades de entrega activas."}
              </p>
            )}
            {error && (
              <p className="pl-danger" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
