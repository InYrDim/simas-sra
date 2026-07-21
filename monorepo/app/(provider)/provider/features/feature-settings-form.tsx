"use client";

import { useActionState } from "react";

import {
  updateTenantFeaturesAction,
  type FeatureSettingsActionState,
} from "@/app/(provider)/provider/features/actions";
import { Button } from "@/components/ui/button";
import {
  PROVIDER_FEATURES,
  type ProviderFeatureSelection,
} from "@/lib/provider-feature-settings";

const initialState: FeatureSettingsActionState = { status: "idle" };

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

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDER_FEATURES.map((feature) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            key={feature.key}
          >
            <input
              className="mt-1 size-4 accent-primary"
              defaultChecked={features[feature.key]}
              name={feature.key}
              type="checkbox"
            />
            <span>
              <span className="block font-medium">{feature.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {feature.description}
              </span>
            </span>
          </label>
        ))}
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
