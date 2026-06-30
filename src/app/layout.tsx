import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", axes: ["opsz"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "RecipeGo",
  description: "Save recipes and build smart shopping lists.",
};

// Run server functions next to the Supabase database (Tokyo, ap-northeast-1)
// so per-request DB round-trips stay local instead of crossing the Pacific.
export const preferredRegion = "hnd1";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen">
        <I18nProvider locale={locale}>
          {children}
          <Toaster richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
