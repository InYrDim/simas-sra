"use client";

import { Button } from "@/components/ui/button";

export default function SecurityHistoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[45vh] place-items-center p-6" role="alert">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold">Riwayat keamanan tidak dapat dimuat</h1>
        <p className="text-sm text-muted-foreground">Coba lagi. Jika masalah berlanjut, sertakan correlation ID dari permintaan Anda kepada operator.</p>
        <Button onClick={reset} type="button" variant="outline">Coba lagi</Button>
      </div>
    </main>
  );
}
