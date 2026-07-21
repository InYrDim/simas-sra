"use client";

import { useState } from "react";

import { createAcademicYearQuickAction } from "@/app/(tenant)/[domain]/(authenticated)/master/tahun-ajaran/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QuickCreateAcademicYearForm({ domain, defaultStartYear }: { domain: string; defaultStartYear: number }) {
  const [startYear, setStartYear] = useState(defaultStartYear);
  const endYear = startYear + 1;
  return (
    <form action={createAcademicYearQuickAction.bind(null, domain)} className="mt-4 space-y-4">
      <div className="space-y-1">
        <Label htmlFor="startYear">Tahun Mulai</Label>
        <Input
          id="startYear"
          name="startYear"
          type="number"
          required
          value={startYear}
          onChange={(event) => setStartYear(Number(event.target.value) || 0)}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Akan dibuat sebagai <span className="font-medium text-foreground">Tahun Ajaran {startYear || "…"}/{startYear ? endYear : "…"}</span>, berjalan 1 Juli {startYear || "…"} – 30 Juni {startYear ? endYear : "…"} (Semester Ganjil: Jul–Des, Genap: Jan–Jun).
      </p>
      <Button type="submit" className="w-full">Buat Tahun Ajaran</Button>
    </form>
  );
}
