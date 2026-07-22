import Link from "next/link";
import type { ReactNode } from "react";

import { MasterDataDetailDialog } from "@/components/master-data/master-data-detail-dialog";
import { MasterDataFilterForm } from "@/components/master-data/master-data-filter-form";
import type { MasterDataQuery } from "@/lib/master-data-workspace";
import { serializeMasterDataQuery } from "@/lib/master-data-workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MasterDataListItem {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  archived: boolean;
  actions?: ReactNode;
}
type Option = { value: string; label: string };

export function MasterDataWorkspace({
  title,
  description,
  basePath,
  query,
  items,
  total,
  detail,
  detailTitle,
  detailDescription,
  children,
  filters,
  sortOptions,
  emptyState,
}: {
  title: string;
  description: string;
  basePath: string;
  query: MasterDataQuery;
  items: MasterDataListItem[];
  total: number;
  detail?: ReactNode;
  detailTitle?: string;
  detailDescription?: string;
  children?: ReactNode;
  filters?: readonly {
    name: string;
    label: string;
    options: readonly Option[];
  }[];
  sortOptions?: readonly Option[];
  emptyState?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const sorts = sortOptions ?? [
    { value: "name-asc", label: "Nama A–Z" },
    { value: "name-desc", label: "Nama Z–A" },
  ];
  return (
    <main aria-labelledby="workspace-title" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Master Data
          </p>
          <h1 id="workspace-title" className="text-2xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </header>
      <MasterDataFilterForm
        action={basePath}
        className="grid items-end gap-3 border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <Label className="lg:col-span-2">
          <span className="text-sm font-medium">Cari</span>
          <Input
            name="q"
            defaultValue={query.search}
            className="mt-1 h-10 w-full"
          />
        </Label>
        <Label>
          <span className="text-sm font-medium">Cakupan arsip</span>
          <Select name="archive" defaultValue={query.archive}>
            <SelectTrigger className="mt-1 h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="archived">Diarsipkan</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
            </SelectContent>
          </Select>
        </Label>
        {filters?.map((filter) => (
          <Label key={filter.name}>
            <span className="text-sm font-medium">{filter.label}</span>
            <Select
              name={filter.name}
              defaultValue={query.filters[filter.name]?.[0] ?? ""}
              items={filter.options}
            >
              <SelectTrigger className="mt-1 h-10 w-full">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        ))}
        <Label>
          <span className="text-sm font-medium">Urutkan</span>
          <Select name="sort" defaultValue={query.sort} items={sorts}>
            <SelectTrigger className="mt-1 h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorts.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <Button type="submit" variant="outline">
          Terapkan filter
        </Button>
      </MasterDataFilterForm>
      <section aria-labelledby="list-heading" className="border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="list-heading" className="font-semibold">
            Daftar {title}
          </h2>
          <span className="text-sm text-muted-foreground">{total} data</span>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[28%] font-semibold">Nama</TableHead>
              <TableHead className="font-semibold">Keterangan</TableHead>
              <TableHead className="w-36 font-semibold">Status</TableHead>
              <TableHead className="w-32 font-semibold">Arsip</TableHead>
              <TableHead className="w-44 text-right font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-48 whitespace-normal text-center">
                  {emptyState ?? (
                    <p className="text-muted-foreground">Belum ada data.</p>
                  )}
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((item) => {
              const selected = query.selected === item.id;
              const href = `${basePath}?${serializeMasterDataQuery(query, {
                selected: item.id,
              })}`;
              return (
                <TableRow key={item.id} data-state={selected ? "selected" : undefined}>
                  <TableCell className="whitespace-normal font-medium">
                    {item.title}
                  </TableCell>
                  <TableCell className="max-w-xl whitespace-normal text-muted-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell>{item.lifecycle}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex border px-2 py-0.5 text-xs font-medium",
                        item.archived
                          ? "bg-muted text-muted-foreground"
                          : "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {item.archived ? "Diarsipkan" : "Aktif"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.actions ?? (
                      <Link
                        href={href}
                        aria-current={selected ? "true" : undefined}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        {selected ? "Terpilih" : "Detail"}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <nav
            aria-label="Paginasi"
            className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"
          >
            <Link
              aria-disabled={query.page === 1}
              className="underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
              href={`${basePath}?${serializeMasterDataQuery(query, {
                page: Math.max(1, query.page - 1),
                selected: null,
              })}`}
            >
              Sebelumnya
            </Link>
            <span>
              Halaman {query.page} dari {pages}
            </span>
            <Link
              aria-disabled={query.page >= pages}
              className="underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
              href={`${basePath}?${serializeMasterDataQuery(query, {
                page: Math.min(pages, query.page + 1),
                selected: null,
              })}`}
            >
              Berikutnya
            </Link>
            <form action={basePath}>
              <input type="hidden" name="q" value={query.search} />
              <input type="hidden" name="archive" value={query.archive} />
              <input type="hidden" name="sort" value={query.sort} />
              {Object.entries(query.filters).flatMap(([name, values]) =>
                values.map((value) => (
                  <input
                    key={`${name}-${value}`}
                    type="hidden"
                    name={name}
                    value={value}
                  />
                ))
              )}
              <Label className="flex items-center">
                Per halaman{" "}
                <Select name="pageSize" defaultValue={String(query.pageSize)}>
                  <SelectTrigger className="ml-2 h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <input type="hidden" name="page" value="1" />
              <Button className="sr-only">Terapkan jumlah per halaman</Button>
            </form>
        </nav>
      </section>
      {query.selected ? (
        <MasterDataDetailDialog
          closeHref={`${basePath}?${serializeMasterDataQuery(query, {
            selected: null,
          })}`}
          title={detailTitle}
          description={detailDescription}
        >
          {detail ?? (
            <p className="text-muted-foreground">
              Data yang dipilih tidak tersedia.
            </p>
          )}
        </MasterDataDetailDialog>
      ) : null}
    </main>
  );
}
