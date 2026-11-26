import { notFound } from "next/navigation";
import { isCatalogCMS } from "@/lib/mode";
import { ActivationForm } from "./ActivationForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Activar acceso · Pablo & Luca", referrer: "no-referrer" } as const;
export default function Activate() {
  if (!isCatalogCMS()) notFound();
  return <div className="pl-entry"><main>
    <img src="/media/logo-original.webp" alt="Pablo & Luca" />
    <h1>Activa tu acceso</h1>
    <ActivationForm />
  </main></div>;
}
