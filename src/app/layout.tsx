import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen">
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
