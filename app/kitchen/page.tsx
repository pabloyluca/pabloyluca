import { isSandbox } from "@/lib/mode";
import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { Kitchen } from "@/components/ops/Kitchen";
import "@/styles/ops.css";

export const metadata: Metadata = {
  title: "Cocina · Pablo & Luca",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requirePageRole(["OWNER", "ADMIN", "KITCHEN"]);
  return <Kitchen sandbox={isSandbox()} />;
}
