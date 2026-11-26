import "server-only";
import type { Menu } from "./contracts";
import published from "./published-menu.json";
import { getMenu } from "./domain";
import { isPublicCatalog, isVisualPreview } from "./mode";

export async function storefrontMenu(): Promise<Menu> {
  if (isPublicCatalog() || isVisualPreview()) {
    return { ...published, settings: { ...published.settings, open: false } } as Menu;
  }
  return getMenu();
}
