"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProviderSettingsAction } from "./actions";

export function ProviderSettingsForm({ defaultTrialDays }: { defaultTrialDays: number }) {
  const [state, action, pending] = useActionState(async (prev: any, formData: FormData) => {
    try {
      await updateProviderSettingsAction(formData);
      return { success: true, message: "Pengaturan berhasil disimpan." };
    } catch (error) {
      return { success: false, message: "Gagal menyimpan pengaturan." };
    }
  }, { success: false, message: "" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Trial Default</CardTitle>
        <CardDescription>Atur durasi trial default untuk tenant baru (dalam hari).</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultTrialDays">Durasi Trial (hari)</Label>
            <Input id="defaultTrialDays" name="defaultTrialDays" type="number" defaultValue={defaultTrialDays} min={1} required />
          </div>
          {state.message && (
            <p className={`text-sm ${state.success ? "text-green-600" : "text-destructive"}`}>
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
