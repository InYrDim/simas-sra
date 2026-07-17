import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      className={cn("h-full antialiased")}
    >
      <body className="min-h-full flex flex-col">
         <TooltipProvider >{children}</TooltipProvider>
      </body>
    </html>
  );
}
