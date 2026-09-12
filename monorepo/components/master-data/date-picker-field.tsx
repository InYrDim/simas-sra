"use client";

import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function initialDate(value?: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePickerField({
  name,
  label,
  value,
  required = false,
  error,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
  error?: string;
}) {
  const [date, setDate] = useState<Date | undefined>(() => initialDate(value));
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hiddenInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [date]);

  return (
    <Field orientation="vertical" className="gap-1" data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <FieldContent>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                id={name}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${name}-error` : undefined}
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
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          value={date ? format(date, "yyyy-MM-dd") : ""}
          required={required}
        />
      </FieldContent>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </Field>
  );
}
