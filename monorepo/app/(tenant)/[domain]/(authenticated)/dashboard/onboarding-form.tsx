"use client";

import { useActionState } from "react";

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/(tenant)/[domain]/(authenticated)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: OnboardingActionState = { status: "idle" };

export function OnboardingForm({
  domain,
  defaultSchoolYear,
}: {
  domain: string;
  defaultSchoolYear: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction.bind(null, domain),
    initialState,
  );

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Selesaikan konfigurasi awal sekolah</CardTitle>
        <CardDescription>
          Atur tahun ajaran dan zona waktu. Masa trial satu bulan dimulai setelah konfigurasi ini disimpan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="schoolYear">Tahun ajaran aktif</Label>
            <Input
              defaultValue={defaultSchoolYear}
              id="schoolYear"
              name="schoolYear"
              placeholder="2026/2027"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Zona waktu</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              defaultValue="Asia/Jakarta"
              id="timezone"
              name="timezone"
              required
            >
              <option value="Asia/Jakarta">WIB — Asia/Jakarta</option>
              <option value="Asia/Makassar">WITA — Asia/Makassar</option>
              <option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
            </select>
          </div>
          {state.status === "error" ? (
            <p className="text-destructive text-sm md:col-span-2" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button disabled={pending} type="submit">
              {pending ? "Menyimpan…" : "Selesaikan onboarding dan mulai trial"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
