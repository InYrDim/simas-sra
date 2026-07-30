import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  MasterDataGatedArea,
  MissingUrgentMasterData,
} from "@/lib/master-data/dashboard-master-data";

export function MasterDataAccessBlocked({
  area,
  missing,
  domain,
  canManageMasterData,
}: {
  area: MasterDataGatedArea;
  missing: readonly MissingUrgentMasterData[];
  domain: string;
  canManageMasterData: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center">
      <Alert className="border-amber-500/50 bg-amber-500/10 p-6 text-amber-950 dark:text-amber-100">
        <AlertTriangle aria-hidden="true" className="size-5" />
        <AlertTitle className="text-lg">Akses {area} belum tersedia</AlertTitle>
        <AlertDescription className="space-y-4 text-current/80">
          <p>
            Master data urgent berikut harus memiliki record aktif sebelum halaman {area} dapat
            digunakan:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {missing.map((item) => (
              <li key={item.key}>
                {canManageMasterData ? (
                  <Link className="font-medium text-current" href={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </li>
            ))}
          </ul>
          <p>
            {canManageMasterData
              ? "Lengkapi data di atas, lalu buka kembali halaman ini."
              : "Hubungi Admin Sekolah untuk melengkapi data tersebut."}
          </p>
          <Link className="inline-block font-medium text-current" href={`/${domain}/dashboard`}>
            Kembali ke Dasbor
          </Link>
        </AlertDescription>
      </Alert>
    </main>
  );
}
