"use client";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { CartLine, Product } from "@/lib/contracts";
import { Dialog } from "./Dialog";
import { money } from "./utils";

export function Stepper({
  quantity,
  onChange,
  name,
}: {
  quantity: number;
  onChange: (q: number) => void;
  name: string;
}) {
  return (
    <div className="pl-stepper" aria-label={`Cantidad de ${name}`}>
      <button
        type="button"
        aria-label={`Quitar una ${name}`}
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
      >
        <Minus size={15} />
      </button>
      <output>{quantity}</output>
      <button
        type="button"
        aria-label={`Añadir una ${name}`}
        disabled={quantity >= 50}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function ProductEditor({
  product,
  surcharge,
  initial,
  editing,
  onClose,
  onSave,
}: {
  product: Product;
  surcharge: number;
  initial: CartLine;
  editing: boolean;
  onClose: () => void;
  onSave: (line: CartLine) => void;
}) {
  const [quantity, setQuantity] = useState(initial.quantity);
  const [removed, setRemoved] = useState(
    initial.removed.filter((i) => product.removable.includes(i)),
  );
  const [vegan, setVegan] = useState(
    initial.cheese === "vegan" ||
      (!editing &&
        product.standardAvailable === false &&
        !!product.veganAvailable),
  );
  const unitPrice = product.price + (vegan ? surcharge : 0);
  const allowed = vegan
    ? product.canSwap && product.veganAvailable
    : (product.standardAvailable ?? product.available);
  const [note, setNote] = useState(initial.note);
  return (
    <Dialog title="Personaliza tu pizza" onClose={onClose}>
      <div className="pl-dialog-body">
        <div className="pl-edit-product">
          <img src={product.image} alt={product.name} />
          <div>
            <h3>{product.name}</h3>
            <strong>{money(unitPrice)}</strong>
            <p>{product.description}</p>
          </div>
        </div>
        {product.canSwap && (
          <fieldset className="pl-checks pl-cheese">
            <legend>Elige tu queso</legend>
            <label>
              <input
                type="radio"
                name="cheese"
                checked={!vegan}
                disabled={product.standardAvailable === false}
                onChange={() => setVegan(false)}
              />
              Mozzarella tradicional — Incluido
            </label>
            <label>
              <input
                type="radio"
                name="cheese"
                checked={vegan}
                disabled={!product.veganAvailable}
                onChange={() => {
                  setVegan(true);
                  setRemoved(
                    removed.filter((r) => !product.cheeseLabels?.includes(r)),
                  );
                }}
              />
              Queso vegano — +{money(surcharge)}
              {!product.veganAvailable && " · Agotado"}
            </label>
            {vegan && (
              <small>
                {product.dietClass === "option" && product.dietVerified
                  ? "Opción vegana"
                  : "Con queso vegetal"}
              </small>
            )}
          </fieldset>
        )}
        {product.removable.length > 0 && (
          <fieldset className="pl-checks">
            <legend>Quitar ingredientes</legend>
            {product.removable
              .filter((i) => !vegan || !product.cheeseLabels?.includes(i))
              .map((ingredient) => (
                <label key={ingredient}>
                  <input
                    type="checkbox"
                    checked={removed.includes(ingredient)}
                    onChange={(event) =>
                      setRemoved(
                        event.target.checked
                          ? [...removed, ingredient]
                          : removed.filter((i) => i !== ingredient),
                      )
                    }
                  />
                  {ingredient}
                </label>
              ))}
          </fieldset>
        )}
        <label className="pl-field">
          Instrucciones especiales <span>Opcional</span>
          <textarea
            maxLength={300}
            rows={3}
            placeholder="Ej. Cortada en ocho rebanadas"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {quantity > 1 && (
          <small>
            Esta personalización se aplicará a las {quantity} pizzas.
          </small>
        )}
        <div className="pl-edit-actions">
          <Stepper
            quantity={quantity}
            onChange={setQuantity}
            name={product.name}
          />
          <button
            className="pl-primary"
            type="button"
            disabled={!allowed}
            onClick={() =>
              onSave({
                productId: product.id,
                ...(vegan ? { cheese: "vegan" as const } : {}),
                removed,
                note: note.trim(),
                quantity,
              })
            }
          >
            <ShoppingBag size={17} />
            {editing ? "Guardar cambios" : "Agregar al carrito"} ·{" "}
            {money(unitPrice * quantity)}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
