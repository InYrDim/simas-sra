import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProviderApplications } from "@/lib/provider-application-data";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/provider-applications";
import { cn } from "@/lib/utils";



type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function applicationsUrl(
  current: { search?: string; status?: string; sort?: string },
  page: number,
) {
  const params = new URLSearchParams({ tab: "applications", page: String(page) });
  if (current.search) params.set("search", current.search);
  if (current.status && current.status !== "all") params.set("status", current.status);
  if (current.sort && current.sort !== "newest") params.set("sort", current.sort);
  return `/provider/tenants?${params}`;
}

export default async function ProviderTenantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tab = valueOf(params.tab) === "applications" ? "applications" : "tenants";

  if (tab === "tenants") {
    return (
      <div className="space-y-6">
        <PageHeading />
        <Tabs active="tenants" />
        <Card>
          <CardHeader><CardTitle>Daftar Tenant</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Daftar Tenant akan tersedia pada tahap pengelolaan Tenant berikutnya.
          </CardContent>
        </Card>
      </div>
    );
  }

  const search = valueOf(params.search)?.trim();
  const rawStatus = valueOf(params.status);
  const status = (["pending", "approved", "rejected"] as const).includes(
    rawStatus as ApplicationStatus,
  )
    ? (rawStatus as ApplicationStatus)
    : "all";
  const rawSort = valueOf(params.sort);
  const sort = (["oldest", "school-asc", "school-desc"] as const).includes(
    rawSort as "oldest" | "school-asc" | "school-desc",
  )
    ? (rawSort as "oldest" | "school-asc" | "school-desc")
    : "newest";
  const requestedPage = Number(valueOf(params.page));
  const result = await listProviderApplications({
    search,
    status,
    sort,
    page: Number.isInteger(requestedPage) ? requestedPage : 1,
  });
  const current = { search, status, sort };

  return (
    <div className="space-y-6">
      <PageHeading />
      <Tabs active="applications" />
      <Card>
        <CardHeader>
          <CardTitle>Pengajuan SIMAS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]" method="get">
            <input name="tab" type="hidden" value="applications" />
            <Input
              aria-label="Cari Pengajuan SIMAS"
              defaultValue={search}
              name="search"
              placeholder="Cari sekolah, NPSN, email, atau penanggung jawab"
            />
            <select
              aria-label="Filter status"
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
              defaultValue={status}
              name="status"
            >
              <option value="all">Semua status</option>
              <option value="pending">Menunggu peninjauan</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
            <select
              aria-label="Urutkan Pengajuan SIMAS"
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
              defaultValue={sort}
              name="sort"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="school-asc">Nama A–Z</option>
              <option value="school-desc">Nama Z–A</option>
            </select>
            <Button type="submit">Terapkan</Button>
          </form>

          {result.applications.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Tidak ada Pengajuan SIMAS yang cocok dengan filter ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sekolah</TableHead>
                  <TableHead>NPSN</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dikirim</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">{application.schoolName}</TableCell>
                    <TableCell>{application.npsn}</TableCell>
                    <TableCell>{application.contactEmail}</TableCell>
                    <TableCell>
                      <Badge variant={application.status === "rejected" ? "destructive" : "outline"}>
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {application.submittedAt.toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        href={`/provider/tenants/applications/${application.id}`}
                      >
                        Lihat detail
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">{result.total} Pengajuan SIMAS</p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={result.page <= 1}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  result.page <= 1 && "pointer-events-none opacity-50",
                )}
                href={applicationsUrl(current, Math.max(1, result.page - 1))}
              >
                Sebelumnya
              </Link>
              <span>Halaman {result.page} dari {result.pageCount}</span>
              <Link
                aria-disabled={result.page >= result.pageCount}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  result.page >= result.pageCount && "pointer-events-none opacity-50",
                )}
                href={applicationsUrl(current, Math.min(result.pageCount, result.page + 1))}
              >
                Berikutnya
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Tenant</h1>
      <p className="mt-1 text-muted-foreground">Kelola Tenant dan Pengajuan SIMAS.</p>
    </div>
  );
}

function Tabs({ active }: { active: "tenants" | "applications" }) {
  return (
    <nav aria-label="Bagian pengelolaan Tenant" className="flex gap-2 border-b">
      <Link
        aria-current={active === "tenants" ? "page" : undefined}
        className={cn("px-4 py-2 text-sm", active === "tenants" && "border-b-2 border-primary font-medium")}
        href="/provider/tenants"
      >
        Tenant
      </Link>
      <Link
        aria-current={active === "applications" ? "page" : undefined}
        className={cn("px-4 py-2 text-sm", active === "applications" && "border-b-2 border-primary font-medium")}
        href="/provider/tenants?tab=applications"
      >
        Pengajuan SIMAS
              </Link>
    </nav>
  );
}
