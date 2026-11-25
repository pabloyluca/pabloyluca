import { Storefront } from "@/components/store/Storefront";
import { getMenu } from "@/lib/domain";
import { isSandbox } from "@/lib/mode";
import "@/styles/store.css";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <Storefront initial={await getMenu()} sandbox={isSandbox()} />;
}
