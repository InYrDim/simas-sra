"use client";

import type { ReactNode } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubjectSubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : null}
      {pending ? "Menyimpan…" : children}
    </Button>
  );
}
