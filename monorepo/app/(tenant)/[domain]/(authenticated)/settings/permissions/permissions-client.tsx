'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type PermissionExplorerFilters = {
  query?: string;
  module?: string;
  assignable?: 'all' | 'assignable' | 'admin-only';
};

type RegistryPermission = {
  key: string;
  module: string;
  resource: string;
  action: string;
  classification: string;
  assignable: boolean;
  lifecycle: string;
  dependencies: readonly string[];
};

function matchesQuery(permission: { key: string; module: string; action: string; resource: string }, query: string) {
  const term = query.toLowerCase();
  if (!term) return true;
  return [permission.key, permission.module, permission.action, permission.resource].some((value) =>
    value.toLowerCase().includes(term),
  );
}

function filterRegistry(registry: readonly RegistryPermission[], filters: PermissionExplorerFilters) {
  const query = filters.query?.trim();
  const module = filters.module?.trim();
  const assignable = filters.assignable;

  return registry.filter((permission) => {
    if (module && permission.module !== module) return false;
    if (!matchesQuery(permission, query ?? '')) return false;
    if (assignable === 'assignable' && permission.classification !== 'tenant-assignable') return false;
    if (assignable === 'admin-only' && permission.classification !== 'school-admin-only') return false;
    return true;
  });
}

function SearchForm({
  filters,
  setFilters,
  modules,
}: {
  filters: PermissionExplorerFilters;
  setFilters: Dispatch<SetStateAction<PermissionExplorerFilters>>;
  modules: readonly string[];
}) {
  return (
    <form className="flex flex-wrap items-end gap-3">
      <div className="flex flex-1 min-w-[220px] flex-col gap-2">
        <Label htmlFor="query">Cari permission</Label>
        <Input
          id="query"
          name="query"
          placeholder="module, key, atau aksi..."
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="module">Module</Label>
        <Select
          name="module"
          value={filters.module}
          onValueChange={(module) => setFilters((current) => ({ ...current, module: module ?? '' }))}
        >
          <SelectTrigger id="module" className="min-w-[180px]">
            <SelectValue placeholder="Semua module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua module</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module} value={module}>
                {module}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="assignable">Assignable</Label>
        <Select
          name="assignable"
          value={filters.assignable}
          onValueChange={(assignable) =>
            setFilters((current) => ({
              ...current,
              assignable: (assignable ?? 'all') as PermissionExplorerFilters['assignable'],
            }))
          }
        >
          <SelectTrigger id="assignable" className="min-w-[180px]">
            <SelectValue placeholder="Semua" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="assignable">Bisa di-assign</SelectItem>
            <SelectItem value="admin-only">School-admin-only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </form>
  );
}

function RegistryTable({ registry }: { registry: readonly RegistryPermission[] }) {
  if (registry.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada permission yang cocok dengan filter saat ini.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Module</TableHead>
            <TableHead className="w-[320px]">Key</TableHead>
            <TableHead>Classification</TableHead>
            <TableHead>Assignable</TableHead>
            <TableHead>Dependencies</TableHead>
            <TableHead>Lifecycle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registry.map((permission) => (
            <TableRow key={permission.key}>
              <TableCell className="font-mono text-xs">{permission.module}</TableCell>
              <TableCell className="font-mono text-xs">{permission.key}</TableCell>
              <TableCell className="text-xs">{permission.classification}</TableCell>
              <TableCell className="text-xs">{permission.assignable ? 'Ya' : 'Tidak'}</TableCell>
              <TableCell className="text-xs">{permission.dependencies.length ? permission.dependencies.join(', ') : '-'}</TableCell>
              <TableCell className="text-xs">{permission.lifecycle}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PermissionExplorerClient({
  initialRegistry,
  modules,
}: {
  initialRegistry: { registry: readonly RegistryPermission[]; modules: string[]; filters: PermissionExplorerFilters };
  modules: readonly string[];
}) {
  const registry = initialRegistry.registry;
  const [filters, setFilters] = useState(initialRegistry.filters);
  const visible = filterRegistry(registry, filters);

  return (
    <div className="space-y-6">
      <SearchForm filters={filters} setFilters={setFilters} modules={modules} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{visible.length} permission ditampilkan</span>
      </div>
      <RegistryTable registry={visible} />
    </div>
  );
}
