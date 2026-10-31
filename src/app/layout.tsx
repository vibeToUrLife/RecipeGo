import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", axes: ["opsz"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "RecipeGo",
  description: "Save recipes and build smart shopping lists.",
  // On an iPhone's home screen it's named RecipeGo and opens full screen (see
  // manifest.ts). The default status bar keeps the page below it, so the sticky
  // header, and the room pill row pinned under it, stay where they are.
  appleWebApp: { title: "RecipeGo", statusBarStyle: "default" },
};

// The phone's status bar and browser bar take the header's colour in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0907" },
  ],
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
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
