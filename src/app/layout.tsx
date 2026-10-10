import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SiteFooter from "../components/SiteFooter";

const displayFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Nunito_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "MediMate｜藥局與藥品查詢",
  description: "以繁體中文查詢藥局與藥品公開資訊。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
