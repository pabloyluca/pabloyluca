import { ArrowRight, ArrowUpRight, Truck } from "lucide-react";
import { platformNames, storefrontChannels } from "@/lib/sales-channels";
import type { Menu } from "@/lib/contracts";
import "@/styles/sales-channels.css";

export function SalesChannels({ menu }: { menu: Menu }) {
  const { direct, platforms } = menu.commercial ?? storefrontChannels([]);
  const { open } = menu.settings;
  return (
    <div className="pl-commercial pl-wrap">
      {direct.visible && (
        <section className="pl-direct" aria-labelledby="direct-heading">
          <div className="pl-direct-copy">
            <p className="pl-direct-eyebrow">{direct.eyebrow}</p>
            <h2 id="direct-heading">
              {direct.showPercent
                ? direct.heading
                : direct.heading.replace(/\s+hasta$/i, "")}{" "}
              {direct.showPercent && <strong>{direct.percent}%</strong>}
            </h2>
            <p className="pl-direct-promo">{direct.promo}</p>
            <p
              className="pl-direct-zone"
              title={
                menu.settings.delivery
                  ? "Entrega directa habilitada"
                  : "Entrega directa pausada"
              }
            >
              <Truck size={17} aria-hidden="true" />
              {open && !menu.settings.delivery
                ? menu.settings.pickup
                  ? "Solo recolección en tienda."
                  : "Entrega directa pausada."
                : direct.coverage}
            </p>
          </div>
          <div className="pl-direct-action">
            <span className="pl-scooter" aria-hidden="true" />
            <a
              href="#menu"
              onClick={(event) => {
                const menuTitle = document.getElementById("pl-menu-title");
                if (
                  !menuTitle ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                menuTitle.focus({ preventScroll: true });
                menuTitle.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                  block: "start",
                });
              }}
            >
              {open ? direct.cta : "Ver el menú"} <ArrowRight size={19} />
            </a>
            {!open && <small>{direct.closed}</small>}
          </div>
        </section>
      )}
      {platforms.length > 0 && (
        <section className="pl-partners" aria-labelledby="partners-heading">
          <h2 id="partners-heading">También estamos en tus apps favoritas</h2>
          <div className="pl-partner-grid">
            {platforms.map((card) => (
              <article
                className={"pl-partner pl-partner-" + card.id}
                key={card.id}
              >
                <img
                  className="pl-wordmark"
                  src={
                    "/media/" +
                    { rappi: "rappi", uber: "uber-eats", didi: "didi-food" }[
                      card.id
                    ] +
                    ".svg"
                  }
                  alt={platformNames[card.id]}
                />
                <p>
                  <span className="pl-scooter" aria-hidden="true" />
                  {card.description}
                </p>
                {(card.includesShipping || card.legend) && (
                  <small>
                    {card.includesShipping ? "Incluye envío" : card.legend}
                  </small>
                )}
                {card.enabled && card.url ? (
                  <a
                    className="pl-platform-cta"
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {card.cta}
                    <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span
                    className="pl-platform-cta"
                    aria-label={platformNames[card.id] + ": próximamente"}
                  >
                    Próximamente
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
