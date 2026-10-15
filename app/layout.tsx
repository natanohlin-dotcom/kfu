import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lato } from "next/font/google";
import "./globals.css";

// Grafiska profilen: Lato för brödtext, The Seasons för rubriker med Cormorant Garamond som reserv (DESIGN.md §3)
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "KFU – I-sektionen",
    template: "%s · KFU",
  },
  icons: { icon: "/brand/kfu-logo.svg" },
  description: "Arbetsyta för kapitalförvaltningsutskottet, Industriell ekonomi, Uppsala universitet.",
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${lato.variable} ${cormorant.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
