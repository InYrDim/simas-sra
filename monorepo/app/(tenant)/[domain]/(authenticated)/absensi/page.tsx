import Link from "next/link";

import { createHttpTenantAuthorizationEvaluator, tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import {
  ATTENDANCE_LAYER_LABELS,
  ATTENDANCE_LAYERS,
  ATTENDANCE_MODE_LABELS,
  type AttendanceLayer,
} from "@/lib/attendance/attendance-config";

export default async function AbsensiPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "absensi.attendance.load";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  enforceAuthorizedTenantOperation(result, { domain, operationId });

  const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
  const config = tenant ? await getAbsensiConfig(tenant.id) : null;
  const activeLayers = config
    ? ATTENDANCE_LAYERS.filter((layer): layer is AttendanceLayer => Boolean(config.activeLayers[layer]))
    : [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Absensi</h1>
        <Link
          href={`/${domain}/absensi/settings`}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Pengaturan
        </Link>
      </div>

      {activeLayers.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <p className="text-muted-foreground">
            Belum ada lapisan absensi yang aktif. Buka{" "}
            <Link href={`/${domain}/absensi/settings`} className="underline">
              Pengaturan Absensi
            </Link>{" "}
            untuk mengaktifkan lapisan dan memilih mode pencatatan.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeLayers.map((layer) => (
            <Link
              key={layer}
              href={`/${domain}/absensi/${layer}`}
              className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:bg-muted"
            >
              <h2 className="text-lg font-semibold">{ATTENDANCE_LAYER_LABELS[layer]}</h2>
              <p className="text-sm text-muted-foreground">
                Mode: {config!.activeLayers[layer]!.map((m) => ATTENDANCE_MODE_LABELS[m]).join(", ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
