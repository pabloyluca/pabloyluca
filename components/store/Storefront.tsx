"use client";
import { SalesChannels } from "./SalesChannels";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bike,
  Check,
  ChevronRight,
  Flame,
  Leaf,
  MapPin,
  Menu as MenuIcon,
  Pizza,
  ShoppingBag,
  Wheat,
} from "lucide-react";
import { Live } from "@/components/Live";
import type { CartLine, Menu, Product } from "@/lib/contracts";
import { Cart } from "./Cart";
import { Dialog } from "./Dialog";
import { ProductEditor, Stepper } from "./ProductEditor";
import { CART_KEY, linePrice, money, requestJson, restoreCart } from "./utils";

type Editor = { id: string; quantity: number; index?: number };
type Info = "about" | "zones" | "nav" | null;
const logo = "/media/logo-transparente.webp";

function KitchenBadge({ open }: { open: boolean }) {
  return (
    <div className={`pl-badge ${open ? "open" : "closed"}`}>
      <i aria-hidden="true" />
      <span>
        <strong>{open ? "Estamos horneando" : "Cocina cerrada"}</strong>
        <small>{open ? "Pedidos abiertos" : "Volvemos pronto"}</small>
      </span>
    </div>
  );
}

function Card({
  product,
  surcharge,
  onOpen,
}: {
  product: Product;
  surcharge: number;
  onOpen: (id: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <article
      className={`pl-product ${!product.available ? "unavailable" : ""}`}
    >
      <button
        type="button"
        className="pl-product-photo"
        onClick={() => onOpen(product.id, qty)}
        aria-label={`Personalizar ${product.name}`}
      >
        <img
          loading="lazy"
          width="226"
          height="159"
          src={product.image}
          alt={product.name}
        />
        {!product.available && <span>Agotada</span>}
      </button>
      <div className="pl-product-body">
        <button
          type="button"
          className="pl-product-title"
          onClick={() => onOpen(product.id, qty)}
        >
          <h3>{product.name}</h3>
          <strong>{money(product.price)}</strong>
        </button>
        {product.cheeseMode === "native" &&
          product.dietClass === "vegan" &&
          product.dietVerified && (
            <small className="pl-vegan">
              <Leaf size={13} /> VEGANA
            </small>
          )}
        <p>{product.description}</p>
        {product.canSwap && (
          <small className="pl-cheese-hint">
            Disponible con queso vegano +{money(surcharge)}
          </small>
        )}
        <div className="pl-product-actions">
          <Stepper name={product.name} quantity={qty} onChange={setQty} />
          <button
            type="button"
            className="pl-add"
            disabled={!product.available}
            onClick={() => onOpen(product.id, qty)}
            aria-label={`Agregar ${product.name}`}
          >
            Agregar <span>+</span>
          </button>
        </div>
        <small className={`pl-stock ${product.available ? "is-in" : ""}`}>
          <i />
          {product.available ? "Disponible" : "Agotada"}
        </small>
      </div>
      <button
        type="button"
        className="pl-row-open"
        aria-label={`Ver opciones de ${product.name}`}
        onClick={() => onOpen(product.id, qty)}
      >
        <ChevronRight size={18} />
      </button>
    </article>
  );
}

export function Storefront({
  initial,
  sandbox,
}: {
  initial: Menu;
  sandbox: boolean;
}) {
  const [menu, setMenu] = useState(initial);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [restored, setRestored] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [info, setInfo] = useState<Info>(null);
  const [toast, setToast] = useState("");
  const [postcode, setPostcode] = useState("");
  const loadingVersion = useRef(0);
  const refresh = useCallback(() => {
    const version = ++loadingVersion.current;
    requestJson<Menu>("/api/menu")
      .then((data) => {
        if (version === loadingVersion.current) {
          setMenu(data);
          setSyncError(false);
        }
      })
      .catch(() => {
        if (version === loadingVersion.current) setSyncError(true);
      });
  }, []);
  useEffect(() => {
    setCart(restoreCart());
    setRestored(true);
    setOnline(navigator.onLine);
    const reconnected = () => setOnline(true);
    const offline = () => setOnline(false);
    const cartChanged = (event: StorageEvent) => {
      if (event.key === CART_KEY) setCart(restoreCart());
    };
    window.addEventListener("online", reconnected);
    window.addEventListener("offline", offline);
    window.addEventListener("pl:change", refresh);
    window.addEventListener("storage", cartChanged);
    return () => {
      window.removeEventListener("online", reconnected);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pl:change", refresh);
      window.removeEventListener("storage", cartChanged);
    };
  }, [refresh]);
  useEffect(() => {
    if (restored) {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch {
        /* Usable in memory. */
      }
    }
  }, [cart, restored]);
  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(""), 3800);
      return () => window.clearTimeout(id);
    }
  }, [toast]);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const total = cart.reduce((s, i) => s + i.quantity * linePrice(menu, i), 0);
  const products = menu.products
    .filter((p) => !p.archived)
    .sort((a, b) => a.position - b.position);
  const selected = products.find((p) => p.id === editor?.id);
  const zones = menu.zones.filter((z) => z.enabled);
  const postcodeZones = zones.filter((z) => z.postcodes.includes(postcode));
  const gotoCart = () => {
    setToast("");
    setInfo(null);
    setOpenCart(true);
  };
  const editProduct = (index: number) => {
    const line = cart[index];
    setOpenCart(false);
    setEditor({ id: line.productId, quantity: line.quantity, index });
  };
  const closeEditor = () => {
    if (editor?.index !== undefined) setOpenCart(true);
    setEditor(null);
  };
  function saveProduct(line: CartLine) {
    if (editor?.index !== undefined) {
      const index = editor.index;
      setCart((previous) =>
        previous.map((old, i) => (i === index ? line : old)),
      );
      setOpenCart(true);
    } else {
      setCart((previous) => [...previous, line]);
      setToast(
        `${line.quantity === 1 ? selected?.name : `${line.quantity} × ${selected?.name}`} en tu carrito`,
      );
    }
    setEditor(null);
  }
  const zoneDialog = (
    <>
      <p className="pl-prose">
        Consulta la cobertura de entrega a domicilio en Huayacán, Cancún, y la
        tarifa de tu zona.
      </p>
      {menu.settings.delivery && zones.length > 0 ? (
        <>
          <label className="pl-field">
            Tu código postal
            <input
              inputMode="numeric"
              maxLength={5}
              value={postcode}
              placeholder="Cinco dígitos"
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {postcode.length === 5 && (
            <p className="pl-note" role="status">
              {postcodeZones.length
                ? postcodeZones
                    .map((z) => `${z.name} · Envío ${money(z.fee)}`)
                    .join(" / ")
                : "Este código postal está fuera de nuestra cobertura."}
            </p>
          )}
        </>
      ) : (
        <p className="pl-note">
          La entrega a domicilio está desactivada por el momento.
        </p>
      )}
      {menu.settings.pickup && (
        <p className="pl-prose">
          <strong>Recolección disponible.</strong> Selecciona esta modalidad al
          hacer tu pedido.
        </p>
      )}
      {menu.settings.hours && (
        <p className="pl-prose">
          <strong>Horarios</strong>
          <br />
          {menu.settings.hours}
        </p>
      )}
    </>
  );
  return (
    <main className="pl-store" id="inicio">
      <Live audience="public" />
      <header className="pl-header">
        <div className="pl-wrap pl-nav">
          <button
            className="pl-hamb pl-icon-btn"
            type="button"
            aria-label="Abrir navegación"
            onClick={() => setInfo("nav")}
          >
            <MenuIcon />
          </button>
          <a
            href="#inicio"
            className="pl-brand"
            aria-label="Pablo y Luca, inicio"
          >
            <img
              src={logo}
              alt="Pablo & Luca · Pizza artesanal"
              width="680"
              height="314"
            />
          </a>
          <nav aria-label="Navegación principal">
            <a className="active" href="#menu">
              Menú
            </a>
            <button onClick={() => setInfo("about")}>Nuestra pizza</button>
            <button onClick={() => setInfo("zones")}>Zona de entrega</button>
          </nav>
          <button
            type="button"
            className="pl-cart-button"
            onClick={gotoCart}
            aria-label={`Carrito (${count})`}
          >
            <ShoppingBag size={18} />
            <span>Carrito</span>
            <b>{count}</b>
          </button>
        </div>
      </header>
      {!online || syncError ? (
        <div className="pl-alert" role="status">
          {!online
            ? "Sin conexión. Puedes consultar el menú guardado."
            : "No pudimos actualizar la disponibilidad."}{" "}
          {online && <button onClick={refresh}>Reintentar</button>}
        </div>
      ) : null}
      {menu.settings.banner && (
        <div className="pl-banner">{menu.settings.banner}</div>
      )}
      <section className="pl-hero">
        <div className="pl-wrap pl-hero-inner">
          <div className="pl-hero-copy">
            <KitchenBadge open={menu.settings.open} />
            <h1>
              {menu.settings.homeTitle || "Pizza artesanal como en Italia"}
            </h1>
            <span className="pl-brush" aria-hidden="true" />
            <p>
              {menu.settings.homeDescription ||
                "Masa de fermentación lenta, ingredientes reales y el sabor que se comparte."}
            </p>
            <a className="pl-hero-link" href="#menu">
              Ver el menú <ArrowDown size={15} />
            </a>
          </div>
          <picture className="pl-hero-art" aria-hidden="true">
            {products[0]?.image && (
              <source media="(max-width: 680px)" srcSet={products[0].image} />
            )}
            <img
              className="pl-town"
              src="/media/vespa-toscana.webp"
              width="364"
              height="302"
              alt=""
              fetchPriority="high"
            />
          </picture>
        </div>
      </section>
      <SalesChannels menu={menu} />
      <section
        className="pl-menu pl-wrap"
        id="menu"
        aria-labelledby="pl-menu-title"
      >
        <div className="pl-menu-head">
          <div className="pl-title-ornament">
            <i />
            <h2 id="pl-menu-title" tabIndex={-1}>
              Nuestro Menú
            </h2>
            <i />
          </div>
          <p>
            <Pizza size={15} />
            Pizzas artesanales de 30 cm <span>·</span> Precios en MXN
          </p>
        </div>
        {products.length ? (
          <div className="pl-grid">
            {products.map((product) => (
              <Card
                key={product.id}
                product={product}
                surcharge={menu.settings.veganSurcharge ?? 0}
                onOpen={(id, quantity) => setEditor({ id, quantity })}
              />
            ))}
          </div>
        ) : (
          <p className="pl-note">El menú se está preparando. Vuelve pronto.</p>
        )}
        <p className="pl-note">
          Contamos con opciones de queso vegetal. Todos nuestros productos se
          preparan en una cocina compartida.
        </p>
        <div className="pl-features">
          <div>
            <Leaf />
            <span>Ingredientes reales</span>
          </div>
          <div>
            <Wheat />
            <span>Masa de fermentación lenta</span>
          </div>
          <div>
            <Flame />
            <span>Horneada al momento</span>
          </div>
          <button onClick={() => setInfo("zones")}>
            <Bike />
            <span>Huayacán, Cancún</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
      <footer className="pl-footer">
        <div className="pl-wrap">
          <a href="#inicio" aria-label="Volver al inicio">
            <img src={logo} alt="Pablo & Luca" />
          </a>
          <span>
            <MapPin size={15} /> Huayacán · Cancún, México
          </span>
          {sandbox && <small>Sandbox · pedidos de prueba</small>}
        </div>
      </footer>
      {count > 0 && !openCart && !editor && !info && (
        <button type="button" className="pl-float-cart" onClick={gotoCart}>
          <ShoppingBag size={19} />
          <b>{count}</b>
          <span>Ver carrito</span>
          <strong>{money(total)}</strong>
          <ArrowRight size={16} />
        </button>
      )}
      {toast && !openCart && !editor && !info && (
        <div className="pl-toast" role="status">
          <Check size={17} />
          {toast}
          <button onClick={gotoCart}>Ver carrito</button>
        </div>
      )}
      {selected && editor && (
        <ProductEditor
          key={`${editor.id}:${editor.index ?? "new"}`}
          product={selected}
          surcharge={menu.settings.veganSurcharge ?? 0}
          initial={
            editor.index !== undefined
              ? cart[editor.index]
              : {
                  productId: selected.id,
                  quantity: editor.quantity,
                  removed: [],
                  note: "",
                }
          }
          editing={editor.index !== undefined}
          onClose={closeEditor}
          onSave={saveProduct}
        />
      )}
      {openCart && (
        <Cart
          menu={menu}
          sandbox={sandbox}
          cart={cart}
          online={online}
          onClose={() => setOpenCart(false)}
          onEdit={editProduct}
          onRemove={(index) => setCart((c) => c.filter((_, i) => i !== index))}
          refresh={refresh}
        />
      )}
      {info && (
        <Dialog
          title={
            info === "about"
              ? "Nuestra pizza"
              : info === "zones"
                ? "Zona de entrega"
                : "Pablo & Luca"
          }
          onClose={() => setInfo(null)}
        >
          <div className="pl-dialog-body">
            {info === "nav" ? (
              <nav className="pl-mobile-nav">
                <a href="#menu" onClick={() => setInfo(null)}>
                  Menú <ChevronRight />
                </a>
                <button onClick={() => setInfo("about")}>
                  Nuestra pizza <ChevronRight />
                </button>
                <button onClick={() => setInfo("zones")}>
                  Zona de entrega <ChevronRight />
                </button>
              </nav>
            ) : info === "zones" ? (
              zoneDialog
            ) : (
              <div className="pl-about">
                <img
                  src="/media/vespa-original.webp"
                  alt="Vespa de Pablo & Luca"
                />
                <h3>Pizza artesanal en Huayacán</h3>
                <p>
                  Preparamos pizzas de aproximadamente 30 cm con masa de
                  fermentación lenta. Cada una entra al horno cuando la pides.
                </p>
                <p>
                  Elige tu pizza en el menú, revisa sus ingredientes y dinos
                  cómo la prefieres.
                </p>
                <button
                  onClick={() => {
                    setInfo(null);
                    document.getElementById("menu")?.scrollIntoView();
                  }}
                  className="pl-primary"
                >
                  Ver las pizzas <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </main>
  );
}
