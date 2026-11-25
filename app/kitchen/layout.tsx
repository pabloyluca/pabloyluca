import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { manifest: "/instalar/kitchen" };
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return children;
}
