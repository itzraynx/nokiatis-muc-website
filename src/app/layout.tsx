import type { Metadata, Viewport } from "next";
import { Tajawal, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nokiatis MUC — مشغّل الموسيقى الذكي",
  description:
    "Nokiatis MUC v1.17.3-beta.1 — ذكاء Nokiatis Intelligence يتعلم ذوقك ويرشّح لك الموسيقى، مزامنة سحابية كاملة، ومشغّل ويب بمستوى Spotify.",
  keywords: [
    "Nokiatis",
    "Nokiatis MUC",
    "مشغل موسيقى",
    "Nokiatis Intelligence",
    "ذكاء اصطناعي",
    "مزامنة سحابية",
  ],
  authors: [{ name: "Team Nokiatis" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Nokiatis MUC — v1.17.3-beta.1",
    description: "الذكاء الموسيقي الذي يتذكر من أنت، أينما كنت.",
    siteName: "Nokiatis",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${tajawal.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-50 font-[family-name:var(--font-tajawal)]`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
