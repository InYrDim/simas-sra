import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getMissingUrgentMasterData } from "@/lib/master-data/dashboard-master-data";
import { getUrgentMasterDataPresence } from "@/lib/master-data/dashboard-master-data-data";

export async function MasterDataWarningBanner({
  tenantId,
  domain,
}: {
  tenantId: string;
  domain: string;
}) {
  const presence = await getUrgentMasterDataPresence(tenantId);
  const missing = getMissingUrgentMasterData(domain, presence);

  if (missing.length === 0) return null;

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Lengkapi data master urgent</AlertTitle>
      <AlertDescription className="text-current/80">
        <p>
          Data berikut belum memiliki record aktif dan diperlukan untuk menjalankan proses akademik:
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {missing.map((item) => (
            <li key={item.key}>
              <Link className="font-medium text-current" href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
