"use client";

import { useActionState, useMemo, useState } from "react";
import { Boxes, Route, Search } from "lucide-react";

import {
  updateTenantFeaturesAction,
  type FeatureSettingsActionState,
} from "@/app/(provider)/provider/features/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TENANT_FEATURE_DOMAINS, type TenantFeatureDomain } from "@/config/tenant-features";
import {
  PROVIDER_FEATURES,
  type ProviderFeatureSelection,
} from "@/lib/provider/provider-feature-settings";

const initialState: FeatureSettingsActionState = { status: "idle" };
const allDomains = "all" as const;
type DomainFilter = TenantFeatureDomain | typeof allDomains;

export function FeatureSettingsForm({
  tenantId,
  features,
}: {
  tenantId: string;
  features: ProviderFeatureSelection;
}) {
  const [state, formAction, pending] = useActionState(
    updateTenantFeaturesAction.bind(null, tenantId),
    initialState,
  );
  const [domainFilter, setDomainFilter] = useState<DomainFilter>(allDomains);
  const [routeFilter, setRouteFilter] = useState("");
  const normalizedRouteFilter = routeFilter.trim().toLocaleLowerCase("id-ID");

  const visibility = useMemo(() => new Map(
    PROVIDER_FEATURES.map((feature) => [
      feature.key,
      (domainFilter === allDomains || feature.functionalDomain === domainFilter)
        && (!normalizedRouteFilter || feature.routes.some((route) => route.toLocaleLowerCase("id-ID").includes(normalizedRouteFilter))),
    ]),
  ), [domainFilter, normalizedRouteFilter]);
  const visibleCount = [...visibility.values()].filter(Boolean).length;

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="feature-domain-filter">Domain fungsi</Label>
          <Select
            items={[
              { value: allDomains, label: "Semua domain fungsi" },
              ...TENANT_FEATURE_DOMAINS.map(({ key, label }) => ({ value: key, label })),
            ]}
            onValueChange={(value) => setDomainFilter((value ?? allDomains) as DomainFilter)}
            value={domainFilter}
          >
            <SelectTrigger className="w-full" id="feature-domain-filter">
              <Boxes />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allDomains}>Semua domain fungsi</SelectItem>
              {TENANT_FEATURE_DOMAINS.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="feature-route-filter">Rute halaman</Label>
          <div className="relative">
            <Route className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              id="feature-route-filter"
              onChange={(event) => setRouteFilter(event.target.value)}
              placeholder="Contoh: /ppdb, /ulangan, /master/import"
              type="search"
              value={routeFilter}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground md:col-span-2">
          Menampilkan {visibleCount} dari {PROVIDER_FEATURES.length} fitur. Filter hanya mengubah tampilan dan tidak mengubah nilai fitur saat disimpan.
        </p>
      </div>

      {visibleCount === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Search className="mx-auto mb-3 size-5 text-muted-foreground" />
          <p className="font-medium">Fitur tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">Ubah domain fungsi atau kata kunci rute.</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {TENANT_FEATURE_DOMAINS.map((domain) => {
          const domainFeatures = PROVIDER_FEATURES.filter((feature) => feature.functionalDomain === domain.key);
          const hasVisibleFeature = domainFeatures.some((feature) => visibility.get(feature.key));
          return (
            <section hidden={!hasVisibleFeature} key={domain.key} className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">{domain.label}</h3>
                <p className="text-sm text-muted-foreground">{domainFeatures.length} kapabilitas dalam domain fungsi ini.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {domainFeatures.map((feature) => {
                  const requirements = "requires" in feature ? feature.requires : [];
                  return (
                    <label
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                      hidden={!visibility.get(feature.key)}
                      key={feature.key}
                    >
                      <input
                        className="mt-1 size-4 accent-primary"
                        defaultChecked={features[feature.key]}
                        name={feature.key}
                        type="checkbox"
                      />
                      <span className="min-w-0 space-y-2">
                        <span className="block font-medium">{feature.label}</span>
                        <span className="block text-sm text-muted-foreground">{feature.description}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {feature.routes.map((route) => <Badge key={route} variant="outline">{route}</Badge>)}
                        </span>
                        {requirements.length ? (
                          <span className="block text-xs text-muted-foreground">
                            Memerlukan: {requirements.join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {state.status !== "idle" ? (
        <p
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <Button disabled={pending} type="submit">
        {pending ? "Menyimpan…" : "Simpan konfigurasi fitur"}
      </Button>
    </form>
  );
}
