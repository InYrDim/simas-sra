"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { dummyUpdateSettings } from "@/app/(tenant)/[domain]/(authenticated)/dashboard/actions";

export function PocTrialAction({ domain }: { domain: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await dummyUpdateSettings(domain, formData);

        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success(result.message);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server",
        );
      }
    });
  }

  return (
    <form action={handleSubmit}>
      <input name="setting" type="hidden" value="test_value" />
      <Button disabled={isPending} type="submit" variant="outline">
        {isPending ? "Menyimpan..." : "Ubah Pengaturan (POC Read-Only)"}
      </Button>
    </form>
  );
}
