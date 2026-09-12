import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsAppAkunLoading() {
  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-6"
      role="status"
      aria-live="polite"
      aria-label="Memuat halaman Akun Bot WhatsApp"
    >
      <span className="sr-only">Memuat halaman Akun Bot WhatsApp…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}