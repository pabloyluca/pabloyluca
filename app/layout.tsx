import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/global.css";
import { InstallShell } from "@/components/InstallShell";

export const metadata: Metadata = {
  title: "Pablo & Luca · Pizza artesanal en Huayacán",
  description: "Pizza artesanal de fermentación lenta en Huayacán, Cancún.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: "#103d28",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <InstallShell />
      </body>
    </html>
  );
}
