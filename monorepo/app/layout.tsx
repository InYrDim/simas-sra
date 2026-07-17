import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import { Geist, JetBrains_Mono } from "next/font/google";


const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Geist({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});
// example usage of creating custom font variables
// const outfitHeading = Outfit({subsets:['latin'],variable:'--font-heading'});
// const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SIMAS - Sistem Informasi Manajemen Sekolah",
  description: "Sistem Informasi Manajemen Sekolah",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", fontSans.variable, fontSerif.variable, fontMono.variable)}
    >
      <body className="min-h-full flex flex-col">
         <TooltipProvider >{children}</TooltipProvider>
      </body>
    </html>
  );
}
