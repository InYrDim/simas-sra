"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { dummyUpdateSettings } from "@/app/(tenant)/[domain]/(authenticated)/dashboard/actions";

export function PocTrialAction() {
  const [isPending, startTransition] = useTransition();

  const handleAction = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("setting", "test_value");
        const result = await dummyUpdateSettings(formData);
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.success) {
          toast.success(result.message);
        }
      } catch (error: any) {
        toast.error(error.message || "Terjadi kesalahan pada server");
      }
    });
  };

  return (
    <Button 
      onClick={handleAction} 
      disabled={isPending}
      variant="outline"
    >
      {isPending ? "Menyimpan..." : "Ubah Pengaturan (POC Read-Only)"}
    </Button>
  );
}
