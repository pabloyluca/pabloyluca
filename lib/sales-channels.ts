export const platformNames = {
  rappi: "Rappi",
  uber: "Uber Eats",
  didi: "DiDi Food",
} as const;
export type PlatformId = keyof typeof platformNames;
export const platformIds: PlatformId[] = ["rappi", "uber", "didi"];

export const defaultDirect = {
  visible: true,
  eyebrow: "De nuestro horno a tu mesa",
  heading: "Ordena aquí y ahorra hasta",
  percent: 30,
  showPercent: true,
  promo: "Los mejores precios, directo con nosotros.",
  coverage: "Entregas limitadas en zona Huayacán.",
  cta: "Ordenar ahora",
  closed: "Cocina cerrada · Puedes consultar el menú.",
};
export type DirectBanner = typeof defaultDirect;

export function defaultPlatform(id: PlatformId) {
  return {
    visible: true,
    enabled: false,
    url: "",
    description: "Entrega a domicilio",
    cta: "Ordenar en " + platformNames[id],
    includesShipping: false,
    legend: "",
    position: platformIds.indexOf(id),
  };
}
export type PlatformCard = ReturnType<typeof defaultPlatform>;
type ChannelRow = {
  id: string;
  presentation?: Partial<DirectBanner & PlatformCard>;
};
export function storefrontChannels(rows: ChannelRow[]) {
  const direct = rows.find((row) => row.id === "store")?.presentation;
  const platforms = platformIds
    .map((id) => {
      const card = {
        ...defaultPlatform(id),
        ...rows.find((row) => row.id === id)?.presentation,
      };
      return { ...card, id, url: card.enabled ? card.url : "" };
    })
    .filter((card) => card.visible)
    .sort((a, b) => a.position - b.position);
  return { direct: { ...defaultDirect, ...direct }, platforms };
}
export type StorefrontChannels = ReturnType<typeof storefrontChannels>;

export function savingsRange(
  products: { id: string; price: number; archived: boolean }[],
  prices: Record<string, number>[],
) {
  const values = products
    .filter((p) => !p.archived)
    .flatMap((p) =>
      prices
        .map((list) => list[p.id])
        .filter((price) => price > 0)
        .map((price) => (100 * (price - p.price)) / price),
    );
  return values.length ? Math.max(...values) : null;
}
