"use client";

import { useActionState } from "react";
import { Eye, EyeOff } from "lucide-react";

import {
  updateTenantMenuVisibilityAction,
  type MenuVisibilityActionState,
} from "@/app/(provider)/provider/features/menu-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import type { TenantMenuVisibility } from "@/lib/features/tenant-menu-visibility";

const initialState: MenuVisibilityActionState = { status: "idle" };

export function MenuVisibilityForm({
  tenantId,
  visibility,
}: {
  tenantId: string;
  visibility: TenantMenuVisibility;
}) {
  const [state, formAction, pending] = useActionState(
    updateTenantMenuVisibilityAction.bind(null, tenantId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nonaktifkan tombol untuk menyembunyikannya dari sidebar Tenant. Menyembunyikan
        item induk juga menyembunyikan seluruh sub-item, dan akses langsung lewat URL
        akan diblokir di server.
      </p>

      <div className="space-y-3">
        {tenantMenuItems.map((item) => {
          const parentHidden = visibility[item.key] === false;
          return (
            <div key={item.key} className="rounded-lg border">
              <label className="flex items-center justify-between gap-3 p-4">
                <span className="flex items-center gap-2 font-medium">
                  {parentHidden ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                  {item.title}
                </span>
                <Switch
                  defaultChecked={!parentHidden}
                  name={item.key}
                  uncheckedValue="off"
                  value="on"
                />
              </label>
              {item.items?.length ? (
                <div className="space-y-2 border-t bg-muted/20 p-4 pl-8">
                  {item.items.map((child) => {
                    const childHidden = parentHidden || visibility[child.key] === false;
                    return (
                      <label
                        key={child.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className={childHidden ? "text-muted-foreground" : undefined}>
                          {child.title}
                        </span>
                        <Switch
                          defaultChecked={!childHidden}
                          disabled={parentHidden}
                          name={child.key}
                          uncheckedValue="off"
                          value="on"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
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
        {pending ? "Menyimpan…" : "Simpan visibilitas menu"}
      </Button>
    </form>
  );
}
