import { TrackingView } from "@/components/store/TrackingView";
import type { Metadata } from "next";
import "@/styles/store.css";

export const metadata: Metadata = {
  title: "Seguimiento del pedido · Pablo & Luca",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TrackingView token={token} />;
}
