import { isVisualPreview } from "@/lib/mode";
import { preview } from "@/lib/preview";
import { Storefront } from "@/components/store/Storefront";
import { getMenu } from "@/lib/domain";
import { isSandbox } from "@/lib/mode";
import "@/styles/store.css";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <Storefront initial={isVisualPreview() ? preview.menu : await getMenu()} sandbox={isSandbox()} />;
}
