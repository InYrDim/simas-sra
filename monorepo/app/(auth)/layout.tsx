import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-center items-center p-4">
      <div className="absolute top-8 left-8">
        <Link href="/" className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors">
          <div className="bg-primary p-1.5 rounded-lg">
            <BookOpen className="size-5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight text-lg">SIMAS</span>
        </Link>
      </div>
      <main className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>
    </div>
  );
}
