import { isSandbox } from "@/lib/mode";
import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { Admin } from "@/components/ops/Admin";
import "@/styles/ops.css";

export const metadata: Metadata = {
  title: "Centro de mando · Pablo & Luca",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePageRole(["OWNER", "ADMIN"]);
  const sandbox = isSandbox();
  return <Admin sandbox={sandbox} hasTestKitchen={!sandbox && Boolean(process.env.KDS_SANDBOX_URL)} />;
}
