import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/global.css";
import { InstallShell } from "@/components/InstallShell";

const site = new URL("https://www.pabloyluca.com");
const title = "Pablo & Luca | Pizza Artesanal en Cancún";
const description =
  "Pizza artesanal de masa de fermentación lenta, ingredientes frescos y horneada al momento. Ordena directo o encuéntranos en Rappi. Cancún · Huayacán.";
const imageUrl = new URL("/branding/og-pabloyluca.jpg", site).href;
const imageAlt =
  "Pablo & Luca Pizza Artesanal en Cancún · Huayacán. Vespa, paisaje italiano y pizza Margherita con los distintivos de Rappi y «Pedido directo −30%».";

export const metadata: Metadata = {
  metadataBase: site,
  applicationName: "Pablo & Luca",
  title,
  description,
  alternates: { canonical: site.href },
  openGraph: {
    title,
    description,
    url: site.href,
    type: "website",
    locale: "es_MX",
    siteName: "Pablo & Luca",
    images: [{
      url: imageUrl,
      secureUrl: imageUrl,
      type: "image/jpeg",
      width: 1200,
      height: 630,
      alt: imageAlt,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: imageUrl, alt: imageAlt }],
  },
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
        {["visual-preview","online-sandbox"].includes(process.env.COMMERCE_MODE || "") && <aside style={{textAlign:"center",padding:"6px 12px",fontSize:13,background:"#eae2cf",color:"#153b28"}}><strong>SANDBOX</strong> · {process.env.COMMERCE_MODE==="visual-preview" ? "Vista de solo lectura · Cocina cerrada" : "Pedidos de prueba · Pago simulado"}</aside>}
        {children}
        <InstallShell />
      </body>
    </html>
  );
}
