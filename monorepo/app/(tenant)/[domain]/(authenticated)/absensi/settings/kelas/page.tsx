import Link from "next/link";
import { notFound } from "next/navigation";

import { saveKelasCloseToleranceAction } from "../../actions";
import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { readAbsensiSettings } from "@/lib/attendance/attendance-config";
import {
  DEFAULT_KELAS_CLOSE_TOLERANCE_MINUTES,
  KELAS_CLOSE_TOLERANCE_MAX_MINUTES,
  KELAS_CLOSE_TOLERANCE_MIN_MINUTES,
  readKelasCloseToleranceMinutes,
} from "@/lib/attendance/attendance-config";
import { KelasToleranceForm } from "./kelas-tolerance-form";

export default async function AbsensiKelasSettingsPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "absensi.settings.save";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  enforceAuthorizedTenantOperation(result, { domain, operationId });

  const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
  if (!tenant) notFound();

  const tolerance = readKelasCloseToleranceMinutes(tenant.settings);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Toleransi Penutupan Kelas</h1>
        <Link href={`/${domain}/absensi/settings`} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          Kembali
        </Link>
      </div>

      <section className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 max-w-xl">
        <p className="text-sm text-muted-foreground">
          Menentukan berapa lama sesi Absensi Kelas tetap terbuka setelah jam selesai pelajaran pada Slot
          Jadwal. Jendela sesi = jam selesai slot + toleransi ini. Default {DEFAULT_KELAS_CLOSE_TOLERANCE_MINUTES} menit.
        </p>
        <KelasToleranceForm domain={domain} current={tolerance} min={KELAS_CLOSE_TOLERANCE_MIN_MINUTES} max={KELAS_CLOSE_TOLERANCE_MAX_MINUTES} />
      </section>
    </div>
  );
}
