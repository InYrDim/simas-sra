"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function EffectiveDateField() {
  const [date, setDate] = useState<Date>();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="effective-date">Tanggal efektif</Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id="effective-date"
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="mr-2 size-4" />
          {date ? format(date, "PPP") : <span>Pilih tanggal</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} />
        </PopoverContent>
      </Popover>
      <input
        type="hidden"
        name="effectiveDate"
        value={date ? format(date, "yyyy-MM-dd") : ""}
        required
      />
    </div>
  );
}
