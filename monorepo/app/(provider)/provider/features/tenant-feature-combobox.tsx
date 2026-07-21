"use client";

import { useRouter } from "next/navigation";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type TenantOption = Readonly<{
  id: string;
  name: string;
  domain: string;
  npsn: string;
}>;

function tenantLabel(tenant: TenantOption) {
  return `${tenant.name} — ${tenant.npsn} (${tenant.domain})`;
}

export function TenantFeatureCombobox({
  tenants,
  selectedTenantId,
}: {
  tenants: readonly TenantOption[];
  selectedTenantId: string;
}) {
  const router = useRouter();
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;

  return (
    <Combobox
      itemToStringLabel={tenantLabel}
      itemToStringValue={(tenant) => tenant.id}
      items={tenants}
      onValueChange={(tenant) => {
        if (tenant) router.push(`/provider/features?tenantId=${encodeURIComponent(tenant.id)}`);
      }}
      value={selectedTenant}
    >
      <ComboboxInput className="w-full" placeholder="Cari nama sekolah, NPSN, atau domain…" />
      <ComboboxContent>
        <ComboboxEmpty>Tenant tidak ditemukan.</ComboboxEmpty>
        <ComboboxList>
          {(tenant: TenantOption) => (
            <ComboboxItem key={tenant.id} value={tenant}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{tenant.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {tenant.npsn} · {tenant.domain}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
