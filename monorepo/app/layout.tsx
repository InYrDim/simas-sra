import type { Metadata } from "next";
import "./globals.css";
import { Geist, DM_Sans, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";

const outfitHeading = Outfit({subsets:['latin'],variable:'--font-heading'});

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

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
      className={cn("h-full antialiased", "font-sans", dmSans.variable, outfitHeading.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
