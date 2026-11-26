export function isPublicCatalog() {
  return process.env.COMMERCE_MODE === "public-catalog";
}

export function isVisualPreview() {
  return process.env.COMMERCE_MODE === "visual-preview";
}

export function usesLocalData() {
  const mode = process.env.COMMERCE_MODE;
  if (isPublicCatalog() || mode === "online-sandbox" || mode === "live" || mode === "visual-preview") return false;
  if (!process.env.VERCEL && (mode === "sandbox" || (!mode && process.env.NODE_ENV !== "production"))) return true;
  throw new Error("Configura un modo de datos compatible con el despliegue.");
}

export function isSandbox(): boolean {
  if (isVisualPreview() || process.env.COMMERCE_MODE === "online-sandbox") return true;
  if (isPublicCatalog() || process.env.COMMERCE_MODE === "live") return false;
  if (usesLocalData()) return true;
  throw new Error("Configura COMMERCE_MODE explícitamente.");
}
